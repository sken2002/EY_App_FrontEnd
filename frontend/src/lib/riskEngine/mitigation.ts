import { SpiderNode } from '../types';
import { MitigationFactor } from './types';

// Hardcoded checks for resilience/balancing factors
export function detectMitigations(node: SpiderNode): MitigationFactor[] {
  const metrics = node.data.metrics || {};
  const trends = node.data.trends || {};
  
  const factors: MitigationFactor[] = [
    {
      id: 'multi-supplier',
      label: 'Multiple suppliers available',
      signal: 'supplierCount',
      reduction: 0.15, // 15% reduction
      active: (metrics.supplierCount || 0) >= 3,
      dimension: 'supplier',
      description: 'Diversified supply base reduces concentration risk',
    },
    {
      id: 'budget-buffer',
      label: 'Budget buffer exists',
      signal: 'budgetVariance',
      reduction: 0.10, // 10% reduction
      active: (metrics.budgetVariance || 0) > 5,
      dimension: 'costFinancial',
      description: 'Remaining budget headroom absorbs cost pressure',
    },
    {
      id: 'high-completion',
      label: 'Work package >80% complete',
      signal: 'completionPct',
      reduction: 0.20, // 20% reduction
      active: (metrics.completionPct || 0) > 80,
      dimension: 'schedule',
      description: 'Near-completion reduces residual schedule risk',
    },
    {
      id: 'backlog-declining',
      label: 'Backlog trend improving',
      signal: 'backlogTrend',
      reduction: 0.10, // 10% reduction
      active: trends.operational === 'improving',
      dimension: 'operational',
      description: 'Declining backlog indicates operational recovery',
    },
    {
      id: 'low-priority',
      label: 'Non-critical work package',
      signal: 'priority',
      reduction: 0.10, // 10% reduction
      active: node.data.subtitle?.includes('Support') || false, // Crude proxy for low priority for PoC
      dimension: 'schedule',
      description: 'Lower priority allows schedule flexibility',
    }
  ];

  return factors;
}
