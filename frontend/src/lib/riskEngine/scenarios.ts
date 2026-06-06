import { SpiderNode } from '../types';
import { ScenarioResult, WPRiskState, MitigationFactor } from './types';

// Helper to determine mitigation reduction
function calculateMitigationReduction(mitigations: MitigationFactor[], expectedSignals: string[], maxReduction: number): number {
  let reduction = 0;
  for (const m of mitigations) {
    if (m.active && expectedSignals.includes(m.signal)) {
      reduction += m.reduction;
    }
  }
  return Math.min(reduction, maxReduction);
}

// -----------------------------------------------------------------------------
// Scenario 1: Supplier → Delivery → Cost
// -----------------------------------------------------------------------------
export function evaluateScenario1(node: SpiderNode, state: WPRiskState): ScenarioResult {
  let score = 0;
  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  
  const m = node.data.metrics;
  const supplierClass = state.detected.supplier.class;

  if (supplierClass !== 'Medium' && supplierClass !== 'High') {
    return {
      id: 'S1',
      name: 'Supplier → Delivery → Cost',
      description: 'Weak supplier performance increases probability of milestone delay and downstream cost escalation.',
      score: 0, confidence: 'Low', residualScore: 0, residualClass: 'Low',
      shortTermActions: [], midTermActions: [], longTermActions: []
    };
  }

  // 1. Baseline activation
  score += 0.20;

  // 2. Supplier-side propagation evidence
  if ((m.nonCompliantRatio || 0) >= 0.30) score += 0.10;
  if ((m.poorRatings || 0) >= 1) score += 0.10;
  if ((m.keySupplierSpendShare || 0) >= 0.50) score += 0.10;

  // 3. Delivery-side confirming signals
  if ((m.delayedProp || 0) >= 0.30) score += 0.25;
  if ((m.avgDelayDays || 0) >= 20) score += 0.10;
  if ((m.completionShortfall || 0) >= 0.40) score += 0.10;

  // 4. Cost-side confirming signals
  if ((m.budgetVariance || 0) / 100 > 0.05) score += 0.10;
  if (m.cpi !== undefined && m.spi !== undefined && m.cpi !== null && m.spi !== null) {
    if (m.cpi < 0.95 && m.spi < 1.00) score += 0.20;
    else if (m.cpi < 0.95) score += 0.10;
  }

  score = Math.min(score, 1.00);

  if (score >= 0.70) confidence = 'High';
  else if (score >= 0.40) confidence = 'Medium';

  const reduction = calculateMitigationReduction(state.mitigations, ['supplier.auditTriggered', 'supplier.diversificationActive', 'supplier.enhancedMonitoring'], 0.25);
  const residualScore = score * (1 - reduction);
  const residualClass = residualScore >= 0.70 ? 'High' : residualScore >= 0.40 ? 'Medium' : 'Low';

  return {
    id: 'S1',
    name: 'Supplier → Delivery → Cost',
    description: 'Weak supplier performance increases probability of milestone delay and downstream cost escalation.',
    score, confidence, residualScore, residualClass,
    shortTermActions: [
      'Increase milestone review frequency',
      'Require weekly supplier reporting',
      'Introduce escalation checkpoints'
    ],
    midTermActions: [
      'Trigger supplier audit or remediation process',
      'Investigate repeated non-compliance or poor supplier ratings',
      'Strengthen supplier governance controls'
    ],
    longTermActions: [
      'Diversify supplier base where feasible',
      'Reduce dependency on key suppliers',
      'Improve supplier resilience planning for critical work packages'
    ]
  };
}

// -----------------------------------------------------------------------------
// Scenario 2: Supplier Concentration → SPOF → Project Stall
// -----------------------------------------------------------------------------
export function evaluateScenario2(node: SpiderNode, state: WPRiskState): ScenarioResult {
  let score = 0;
  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  
  const m = node.data.metrics;
  // Concentration is part of the supplier dimension. For simplicity, check supplier overall.
  const supplierClass = state.detected.supplier.class;

  if (supplierClass !== 'Medium' && supplierClass !== 'High') {
    return {
      id: 'S2',
      name: 'Supplier Concentration → SPOF → Project Stall',
      description: 'Supplier concentration increases the probability of a single point of failure and project disruption.',
      score: 0, confidence: 'Low', residualScore: 0, residualClass: 'Low',
      shortTermActions: [], midTermActions: [], longTermActions: []
    };
  }

  score += 0.20;

  if (m.supplierCount === 1) score += 0.25;
  else if ((m.keySupplierSpendShare || 0) >= 0.50) score += 0.20;

  if ((m.delayedProp || 0) >= 0.30) score += 0.20;
  if ((m.avgDelayDays || 0) >= 20) score += 0.10;
  if ((m.completionShortfall || 0) >= 0.40) score += 0.10;

  if ((m.backlogRatio || 0) >= 0.50) score += 0.10;
  if ((m.unresolvedCount || 0) >= 2) score += 0.10;
  if ((m.emergencyCount || 0) >= 1) score += 0.10;

  score = Math.min(score, 1.00);

  if (score >= 0.70) confidence = 'High';
  else if (score >= 0.40) confidence = 'Medium';

  const reduction = calculateMitigationReduction(state.mitigations, ['supplier.backupOnboarded', 'supplier.contingencyIdentified', 'delivery.recoveryPlan'], 0.25);
  const residualScore = score * (1 - reduction);
  const residualClass = residualScore >= 0.70 ? 'High' : residualScore >= 0.40 ? 'Medium' : 'Low';

  return {
    id: 'S2',
    name: 'Supplier Concentration → SPOF → Project Stall',
    description: 'Supplier concentration increases the probability of a single point of failure and project disruption.',
    score, confidence, residualScore, residualClass,
    shortTermActions: [
      'Increase monitoring of supplier-dependent work packages',
      'Review milestone delays more frequently',
      'Identify whether any open service orders are linked to supplier bottlenecks'
    ],
    midTermActions: [
      'Prepare contingency supplier options',
      'Create a delivery recovery plan',
      'Prioritise unresolved operational issues that may block the work package'
    ],
    longTermActions: [
      'Reduce single-supplier dependency',
      'Diversify supplier base where feasible',
      'Avoid assigning critical work packages to overly concentrated supplier structures'
    ]
  };
}

// -----------------------------------------------------------------------------
// Scenario 3: Delivery → Cost → Supplier
// -----------------------------------------------------------------------------
export function evaluateScenario3(node: SpiderNode, state: WPRiskState): ScenarioResult {
  let score = 0;
  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  
  const m = node.data.metrics;
  const scheduleClass = state.detected.schedule.class;

  if (scheduleClass !== 'Medium' && scheduleClass !== 'High') {
    return {
      id: 'S3',
      name: 'Delivery → Cost → Supplier',
      description: 'Schedule slippage increases the probability of cost pressure and supplier tension.',
      score: 0, confidence: 'Low', residualScore: 0, residualClass: 'Low',
      shortTermActions: [], midTermActions: [], longTermActions: []
    };
  }

  score += 0.20;

  if ((m.slippageRatio || 0) >= 0.15) score += 0.35;
  else if ((m.slippageRatio || 0) >= 0.10) score += 0.20;

  if ((m.completionShortfall || 0) >= 0.40) score += 0.10;
  if ((m.delayedProp || 0) >= 0.30) score += 0.15;

  if ((m.budgetVariance || 0) / 100 > 0.05) score += 0.10;
  if (m.cpi !== undefined && m.spi !== undefined && m.cpi !== null && m.spi !== null) {
    if (m.cpi < 0.95 && m.spi < 1.00) score += 0.20;
    else if (m.cpi < 0.95) score += 0.10;
  }

  if ((m.nonCompliantRatio || 0) > 0) score += 0.10;
  if ((m.poorRatings || 0) >= 1) score += 0.10;

  score = Math.min(score, 1.00);

  if (score >= 0.70) confidence = 'High';
  else if (score >= 0.40) confidence = 'Medium';

  const reduction = calculateMitigationReduction(state.mitigations, ['delivery.resourceReallocation', 'cost.controlReview', 'contract.renegotiationActive'], 0.25);
  const residualScore = score * (1 - reduction);
  const residualClass = residualScore >= 0.70 ? 'High' : residualScore >= 0.40 ? 'Medium' : 'Low';

  return {
    id: 'S3',
    name: 'Delivery → Cost → Supplier',
    description: 'Schedule slippage increases the probability of cost pressure and supplier tension.',
    score, confidence, residualScore, residualClass,
    shortTermActions: [
      'Reallocate resources to delayed work packages',
      'Increase delivery review frequency',
      'Monitor slippage and milestone delays closely'
    ],
    midTermActions: [
      'Review cost drivers and investigate CPI deterioration',
      'Assess whether cost pressure is linked to supplier performance'
    ],
    longTermActions: [
      'Renegotiate contract terms where necessary',
      'Adjust payment schedules to reduce dispute pressure',
      'Strengthen supplier governance for delayed work packages'
    ]
  };
}

// -----------------------------------------------------------------------------
// Scenario 4: Delivery → Operations Feedback Loop
// -----------------------------------------------------------------------------
export function evaluateScenario4(node: SpiderNode, state: WPRiskState): ScenarioResult {
  let score = 0;
  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  
  const m = node.data.metrics;
  const scheduleClass = state.detected.schedule.class;

  if (scheduleClass !== 'Medium' && scheduleClass !== 'High') {
    return {
      id: 'S4',
      name: 'Delivery → Operations Feedback Loop',
      description: 'Milestone delay increases the probability of service order backlog and operational bottlenecks.',
      score: 0, confidence: 'Low', residualScore: 0, residualClass: 'Low',
      shortTermActions: [], midTermActions: [], longTermActions: []
    };
  }

  score += 0.20;

  if ((m.delayedProp || 0) >= 0.30) score += 0.25;
  if ((m.avgDelayDays || 0) >= 20) score += 0.10;
  if ((m.atRiskCount || 0) >= 2) score += 0.15;
  if ((m.completionShortfall || 0) >= 0.40) score += 0.10;

  if ((m.backlogRatio || 0) >= 0.80) score += 0.30;
  else if ((m.backlogRatio || 0) >= 0.50) score += 0.20;

  if ((m.totalSO || 0) >= 3) score += 0.10;
  if ((m.onHoldCount || 0) >= 1) score += 0.10;

  score = Math.min(score, 1.00);

  if (score >= 0.70) confidence = 'High';
  else if (score >= 0.40) confidence = 'Medium';

  const reduction = calculateMitigationReduction(state.mitigations, ['operations.temporaryCapacity', 'operations.soPrioritisation', 'delivery.resequencing'], 0.25);
  const residualScore = score * (1 - reduction);
  const residualClass = residualScore >= 0.70 ? 'High' : residualScore >= 0.40 ? 'Medium' : 'Low';

  return {
    id: 'S4',
    name: 'Delivery → Operations Feedback Loop',
    description: 'Milestone delay increases the probability of service order backlog and operational bottlenecks.',
    score, confidence, residualScore, residualClass,
    shortTermActions: [
      'Increase review frequency for delayed milestones',
      'Prioritise critical service orders',
      'Identify whether open or on-hold service orders are blocking delivery progress'
    ],
    midTermActions: [
      'Add temporary operational capacity',
      'Resequence work packages where downstream work is blocked',
      'Clear high-priority backlog items first'
    ],
    longTermActions: [
      'Improve delivery-to-operations coordination',
      'Build early-warning backlog controls',
      'Strengthen planning around operational handover points'
    ]
  };
}

// -----------------------------------------------------------------------------
// Scenario 5: Cashflow → Delivery
// -----------------------------------------------------------------------------
export function evaluateScenario5(node: SpiderNode, state: WPRiskState): ScenarioResult {
  let score = 0;
  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  
  const m = node.data.metrics;
  const cfClass = state.detected.cashflow.class;

  if (cfClass !== 'Medium' && cfClass !== 'High') {
    return {
      id: 'S5',
      name: 'Cashflow → Delivery',
      description: 'Cashflow deviation increases the probability of work slowdown and schedule delay.',
      score: 0, confidence: 'Low', residualScore: 0, residualClass: 'Low',
      shortTermActions: [], midTermActions: [], longTermActions: []
    };
  }

  score += 0.20;

  const cfDev = Math.abs(m.cashflowDevRatio || 0);
  if (cfDev > 0.15) score += 0.30;
  else if (cfDev > 0.05) score += 0.15;

  if ((m.rejectionRatio || 0) >= 0.20) score += 0.15;

  if ((m.delayedProp || 0) >= 0.30) score += 0.20;
  if ((m.avgDelayDays || 0) >= 20) score += 0.10;
  if ((m.completionShortfall || 0) >= 0.40) score += 0.10;

  score = Math.min(score, 1.00);

  if (score >= 0.70) confidence = 'High';
  else if (score >= 0.40) confidence = 'Medium';

  const reduction = calculateMitigationReduction(state.mitigations, ['cashflow.emergencyFinancing', 'cashflow.criticalPaymentsPrioritised'], 0.25);
  const residualScore = score * (1 - reduction);
  const residualClass = residualScore >= 0.70 ? 'High' : residualScore >= 0.40 ? 'Medium' : 'Low';

  return {
    id: 'S5',
    name: 'Cashflow → Delivery',
    description: 'Cashflow deviation increases the probability of work slowdown and schedule delay.',
    score, confidence, residualScore, residualClass,
    shortTermActions: [
      'Prioritise critical payments',
      'Review rejected or delayed payment items',
      'Monitor whether cashflow gaps are linked to milestone delays'
    ],
    midTermActions: [
      'Secure short-term financing support',
      'Restructure payment schedules',
      'Create a delivery recovery plan for affected work packages'
    ],
    longTermActions: [
      'Strengthen cashflow forecasting',
      'Separate cashflow monitoring from cost variance analysis',
      'Build early-warning controls for liquidity-driven delivery slowdown'
    ]
  };
}

// -----------------------------------------------------------------------------
// Engine Runner
// -----------------------------------------------------------------------------
export function runScenarioEngine(node: SpiderNode, state: WPRiskState): ScenarioResult[] {
  const s1 = evaluateScenario1(node, state);
  const s2 = evaluateScenario2(node, state);
  const s3 = evaluateScenario3(node, state);
  const s4 = evaluateScenario4(node, state);
  const s5 = evaluateScenario5(node, state);

  // Return only scenarios with a non-zero score, sorted by highest score first
  return [s1, s2, s3, s4, s5]
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
}
