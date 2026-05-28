import { DimensionKey, SpiderNode, SpiderEdge } from '../types';
import { PropagationRule, WPRiskState } from './types';

// The rules defining how risk spreads downstream
export const PROPAGATION_RULES: PropagationRule[] = [
  {
    id: 'prop-contract-supplier',
    sourceSignal: 'contract.NonCompliant',
    targetDimension: 'supplier',
    pressureChange: 20, 
    description: 'Non-compliant contract directly inflates supplier risk.',
    condition: (node) => node.type === 'contract' && node.data.metrics?.complianceStatus === 'Non-Compliant',
  },
  {
    id: 'prop-contract-cost',
    sourceSignal: 'contract.NonCompliant',
    targetDimension: 'costFinancial',
    pressureChange: 15,
    description: 'Non-compliant contract increases cost risk due to potential re-procurement.',
    condition: (node) => node.type === 'contract' && node.data.metrics?.complianceStatus === 'Non-Compliant',
  },
  {
    id: 'prop-milestone-schedule',
    sourceSignal: 'milestone.Delayed',
    targetDimension: 'schedule',
    pressureChange: 25,
    description: 'Delayed upstream milestone directly blocks downstream schedule.',
    condition: (node) => node.type === 'milestone' && (node.data.status === 'Delayed' || (node.data.metrics?.delayDays || 0) > 0),
  },
  {
    id: 'prop-milestone-cashflow',
    sourceSignal: 'milestone.Delayed',
    targetDimension: 'cashflow',
    pressureChange: 15,
    description: 'Delayed upstream milestone defers milestone payments, straining cashflow.',
    condition: (node) => node.type === 'milestone' && (node.data.status === 'Delayed' || (node.data.metrics?.delayDays || 0) > 0),
  },
  {
    id: 'prop-wp-ops',
    sourceSignal: 'workPackage.HighOps',
    targetDimension: 'schedule',
    pressureChange: 10,
    description: 'Upstream operational incidents / backlog delay downstream delivery.',
    condition: (node) => node.type === 'workPackage' && node.data.dimensions?.operational?.class === 'High',
  }
];

export function propagateRisk(
  targetWpId: string,
  nodes: SpiderNode[],
  edges: SpiderEdge[],
  detectedScores: Record<string, Record<DimensionKey, number>>
): Record<DimensionKey, number> {
  // Initialize extra pressure to 0
  const propagatedPressure: Record<DimensionKey, number> = {
    costFinancial: 0,
    cashflow: 0,
    schedule: 0,
    operational: 0,
    supplier: 0
  };

  // Find edges where this WP is the target
  const incomingEdges = edges.filter(e => e.target === targetWpId);
  if (incomingEdges.length === 0) return propagatedPressure;

  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) continue;

    // Apply rules based on source node's state
    for (const rule of PROPAGATION_RULES) {
      if (rule.condition(sourceNode)) {
        propagatedPressure[rule.targetDimension] += rule.pressureChange;
      }
    }
  }

  // Cap max propagation pressure to avoid absurd scores
  for (const dim in propagatedPressure) {
    propagatedPressure[dim as DimensionKey] = Math.min(propagatedPressure[dim as DimensionKey], 40);
  }

  return propagatedPressure;
}
