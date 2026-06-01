import { DimensionKey, SpiderNode, SpiderEdge } from '../types';
import { PropagationRule, MitigationFactor } from './types';

// The rules defining how risk spreads downstream, now using baseProbability
export const PROPAGATION_RULES: PropagationRule[] = [
  {
    id: 'prop-contract-supplier',
    sourceSignal: 'contract.NonCompliant',
    targetDimension: 'supplier',
    baseProbability: 0.85, 
    basePressure: 20, 
    description: 'Non-compliant contract heavily inflates supplier risk.',
    condition: (node) => node.type === 'contract' && node.data.metrics?.complianceStatus === 'Non-Compliant',
  },
  {
    id: 'prop-contract-cost',
    sourceSignal: 'contract.NonCompliant',
    targetDimension: 'costFinancial',
    baseProbability: 0.60,
    basePressure: 15,
    description: 'Non-compliant contract may increase cost risk due to potential re-procurement.',
    condition: (node) => node.type === 'contract' && node.data.metrics?.complianceStatus === 'Non-Compliant',
  },
  {
    id: 'prop-milestone-schedule',
    sourceSignal: 'milestone.Delayed',
    targetDimension: 'schedule',
    baseProbability: 0.90,
    basePressure: 25,
    description: 'Delayed upstream milestone highly likely to block downstream schedule.',
    condition: (node) => node.type === 'milestone' && (node.data.status === 'Delayed' || (node.data.metrics?.delayDays || 0) > 0),
  },
  {
    id: 'prop-milestone-cashflow',
    sourceSignal: 'milestone.Delayed',
    targetDimension: 'cashflow',
    baseProbability: 0.50,
    basePressure: 15,
    description: 'Delayed upstream milestone may defer milestone payments, straining cashflow.',
    condition: (node) => node.type === 'milestone' && (node.data.status === 'Delayed' || (node.data.metrics?.delayDays || 0) > 0),
  },
  {
    id: 'prop-wp-ops',
    sourceSignal: 'workPackage.HighOps',
    targetDimension: 'schedule',
    baseProbability: 0.70,
    basePressure: 10,
    description: 'Upstream operational incidents likely delay downstream delivery.',
    condition: (node) => node.type === 'workPackage' && node.data.dimensions?.operational?.class === 'High',
  }
];

export function propagateRisk(
  targetWpId: string,
  nodes: SpiderNode[],
  edges: SpiderEdge[],
  detectedScores: Record<string, Record<DimensionKey, number>>,
  targetNodeMitigations: MitigationFactor[]
): Record<DimensionKey, number> {
  // Initialize extra pressure to 0
  const propagatedPressure: Record<DimensionKey, number> = {
    costFinancial: 0,
    cashflow: 0,
    schedule: 0,
    operational: 0,
    supplier: 0
  };

  // Find edges where this WP is connected
  const connectedEdges = edges.filter(e => e.target === targetWpId || e.source === targetWpId);
  if (connectedEdges.length === 0) return propagatedPressure;

  for (const edge of connectedEdges) {
    const isIncoming = edge.target === targetWpId;
    const connectedNodeId = isIncoming ? edge.source : edge.target;
    
    const connectedNode = nodes.find(n => n.id === connectedNodeId);
    if (!connectedNode) continue;

    // Apply rules based on connected node's state
    for (const rule of PROPAGATION_RULES) {
      if (rule.condition(connectedNode)) {
        
        // 1. Calculate reduced probability from mitigations
        let actualProbability = rule.baseProbability;
        const relevantMitigations = targetNodeMitigations.filter(m => m.active && m.dimension === rule.targetDimension);
        for (const m of relevantMitigations) {
           actualProbability *= (1 - m.reduction); // Mitigations reduce the CHANCE of propagation
        }
        
        // 2. Probabilistic Roll (Seeded by node IDs to remain deterministic per refresh, but acts as controlled randomness)
        const hashStr = targetWpId + connectedNodeId + rule.id;
        let hash = 0;
        for (let i = 0; i < hashStr.length; i++) {
            hash = Math.imul(31, hash) + hashStr.charCodeAt(i) | 0;
        }
        const roll = Math.abs(hash) / 2147483647; // Pseudo-random float [0, 1]

        // 3. Evaluate if risk propagates
        if (roll <= actualProbability) {
           // 4. Contextual Balancing & Randomisation
           // Multiply base pressure by a random variance factor [0.85, 1.15] to avoid rigid chains
           const variance = 0.85 + (Math.abs(hash % 100) / 100) * 0.30;
           
           // Contextual weight (e.g., if the downstream node is critical)
           let contextMultiplier = 1.0;
           const targetNode = nodes.find(n => n.id === targetWpId);
           if (targetNode?.data.subtitle?.includes('Support')) contextMultiplier = 0.5; // Low priority absorbs shock better
           if (targetNode?.data.subtitle?.includes('Core') || targetNode?.data.subtitle?.includes('Integration')) contextMultiplier = 1.2;
           
           propagatedPressure[rule.targetDimension] += (rule.basePressure * variance * contextMultiplier);
        }
      }
    }
  }

  // Cap max propagation pressure to avoid absurd scores
  for (const dim in propagatedPressure) {
    propagatedPressure[dim as DimensionKey] = Math.min(propagatedPressure[dim as DimensionKey], 40);
  }

  return propagatedPressure;
}
