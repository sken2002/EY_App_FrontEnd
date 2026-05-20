import { DimensionKey, SpiderNode, SpiderEdge } from '../types';
import { PropagationRule, WPRiskState } from './types';

// The rules defining how risk spreads downstream
export const PROPAGATION_RULES: PropagationRule[] = [
  {
    id: 'prop-supplier-schedule',
    sourceSignal: 'supplier.High',
    targetDimension: 'schedule',
    pressureChange: 15, // Adds 15 points to schedule score
    description: 'Supplier risk increases delivery schedule pressure',
    condition: (node) => node.data.dimensions?.supplier?.class === 'High',
  },
  {
    id: 'prop-supplier-cost',
    sourceSignal: 'supplier.High',
    targetDimension: 'costFinancial',
    pressureChange: 10,
    description: 'Supplier risk increases cost (potential re-procurement)',
    condition: (node) => node.data.dimensions?.supplier?.class === 'High',
  },
  {
    id: 'prop-schedule-cashflow',
    sourceSignal: 'schedule.High',
    targetDimension: 'cashflow',
    pressureChange: 10,
    description: 'Schedule delay defers milestone payments, straining cashflow',
    condition: (node) => node.data.dimensions?.schedule?.class === 'High',
  },
  {
    id: 'prop-cost-cashflow',
    sourceSignal: 'costFinancial.High',
    targetDimension: 'cashflow',
    pressureChange: 15,
    description: 'Cost overrun directly strains cashflow',
    condition: (node) => node.data.dimensions?.costFinancial?.class === 'High',
  },
  {
    id: 'prop-ops-schedule',
    sourceSignal: 'operational.High',
    targetDimension: 'schedule',
    pressureChange: 10,
    description: 'Operational incidents / backlog delay delivery',
    condition: (node) => node.data.dimensions?.operational?.class === 'High',
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
