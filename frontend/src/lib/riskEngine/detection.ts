import { RiskClass } from './types';

// Helper to calculate score from sub-classes (matches Python compute_dimension_score)
const SEVERITY_SCORES: Record<RiskClass, number> = { 'High': 85, 'Medium': 55, 'Low': 20, 'No Data': 20 };
const SEVERITY_ORDER: Record<RiskClass, number> = { 'High': 3, 'Medium': 2, 'Low': 1, 'No Data': 0 };

export function calculateDimensionScore(classes: RiskClass[]): { score: number; class: RiskClass } {
  let totalScore = 0;
  for (const cls of classes) {
    totalScore += SEVERITY_SCORES[cls] || 20;
  }
  const avgScore = Math.round(totalScore / Math.max(classes.length, 1));
  
  let riskClass: RiskClass = 'Low';
  if (avgScore >= 70) riskClass = 'High';
  else if (avgScore >= 40) riskClass = 'Medium';
  
  return { score: avgScore, class: riskClass };
}

// --- Schedule Dimension (Milestone Delay + Completion Slippage) ---
export function classifyMilestoneDelay(delayedProp: number, avgDelayDays: number, atRiskCount: number): { class: RiskClass; driver: string } {
  if (delayedProp >= 0.70) return { class: 'High', driver: 'High delay proportion (≥70%)' };
  if (avgDelayDays >= 45 && delayedProp >= 0.30) return { class: 'High', driver: 'Severe delay days with significant proportion' };
  if (atRiskCount >= 2 && delayedProp >= 0.20) return { class: 'High', driver: 'Multiple at-risk milestones' };
  if (delayedProp > 0 || avgDelayDays > 0 || atRiskCount >= 1) return { class: 'Medium', driver: 'Delay or at-risk signals present' };
  return { class: 'Low', driver: 'No delays detected' };
}

export function classifyCompletionSlippage(slippageRatio: number, completionShortfall: number, wpStatusRiskFlag: boolean, pastPlannedEnd: boolean): { class: RiskClass; driver: string } {
  if (wpStatusRiskFlag) return { class: 'High', driver: 'Status flagged as risk' };
  if (slippageRatio >= 0.15) return { class: 'High', driver: `Slippage ratio ${(slippageRatio * 100).toFixed(0)}%` };
  if (completionShortfall >= 0.85) return { class: 'High', driver: `Completion shortfall ${(completionShortfall * 100).toFixed(0)}%` };
  if (slippageRatio > 0) return { class: 'Medium', driver: 'Minor slippage' };
  if (completionShortfall >= 0.40 && pastPlannedEnd) return { class: 'Medium', driver: `Completion shortfall past planned end` };
  return { class: 'Low', driver: 'On track' };
}

// --- Operational Dimension (SO Backlog + Operational Incident) ---
export function classifyBacklog(backlogRatio: number, onHoldCount: number, totalSO: number): { class: RiskClass; driver: string } {
  if (totalSO < 5) return { class: 'Low', driver: 'Low order volume' };
  if (backlogRatio >= 0.90 || onHoldCount >= 3) return { class: 'High', driver: `Backlog ${(backlogRatio * 100).toFixed(0)}%, ${onHoldCount} on hold` };
  if (backlogRatio >= 0.70 || onHoldCount >= 2) return { class: 'Medium', driver: `Backlog ${(backlogRatio * 100).toFixed(0)}%` };
  return { class: 'Low', driver: 'Manageable backlog' };
}

export function classifyOperationalIncident(emergencyCount: number, unresolvedCount: number, totalSO_ops: number): { class: RiskClass; driver: string } {
  const emergencyRatio = totalSO_ops > 0 ? emergencyCount / totalSO_ops : 0;
  if (emergencyCount >= 2 || (totalSO_ops >= 3 && emergencyRatio >= 0.30)) return { class: 'High', driver: `${emergencyCount} emergencies` };
  if (unresolvedCount >= 2 || totalSO_ops >= 5) return { class: 'Medium', driver: `${unresolvedCount} unresolved` };
  return { class: 'Low', driver: 'No operational incidents' };
}

// --- Cost & Financial Dimension (VAC% + CPI/SPI) ---
export function classifyCostVariance(vacPct: number): { class: RiskClass; driver: string } {
  if (vacPct < -0.10) return { class: 'High', driver: `EAC overshoots BAC by ${Math.abs(vacPct * 100).toFixed(1)}%` };
  if (vacPct < -0.05) return { class: 'Medium', driver: `EAC exceeds BAC by ${Math.abs(vacPct * 100).toFixed(1)}%` };
  return { class: 'Low', driver: `VAC within tolerance` };
}

export function classifyCpiSpi(cpi: number | null, spi: number | null, perfStatus: string): { class: RiskClass; driver: string } {
  if (cpi === null || spi === null) return { class: 'Low', driver: 'No CPI/SPI data' };
  const contradiction = (perfStatus === 'On Track' && cpi < 0.9) ? ' ⚠ CONTRADICTION' : '';
  if (cpi < 0.9 && spi < 0.9) return { class: 'High', driver: `CPI=${cpi.toFixed(2)}, SPI=${spi.toFixed(2)}${contradiction}` };
  if (cpi < 1.0 || spi < 1.0) return { class: 'Medium', driver: `CPI=${cpi.toFixed(2)}, SPI=${spi.toFixed(2)}${contradiction}` };
  return { class: 'Low', driver: `CPI=${cpi.toFixed(2)}, SPI=${spi.toFixed(2)}` };
}

// --- Cashflow Dimension (Deviation + Payment Rejection) ---
export function classifyCashflow(devRatio: number): { class: RiskClass; driver: string } {
  const dev = Math.abs(devRatio);
  if (dev > 0.15) return { class: 'High', driver: `Cashflow deviation ${(devRatio * 100).toFixed(1)}%` };
  if (dev > 0.05) return { class: 'Medium', driver: `Minor deviation ${(devRatio * 100).toFixed(1)}%` };
  return { class: 'Low', driver: 'Cashflow on track' };
}

export function classifyPaymentRejection(rejectionRatio: number, rejectedCount: number): { class: RiskClass; driver: string } {
  if (rejectionRatio >= 0.20) return { class: 'High', driver: `${rejectedCount} rejections (${(rejectionRatio * 100).toFixed(0)}%)` };
  if (rejectionRatio >= 0.10) return { class: 'Medium', driver: `${rejectedCount} rejections (${(rejectionRatio * 100).toFixed(0)}%)` };
  return { class: 'Low', driver: 'Low rejection rate' };
}

// --- Supplier Dimension (Concentration + Performance) ---
export function classifySupplierConcentration(supplierCount: number, keySupplierSpendShare: number): { class: RiskClass; driver: string } {
  if (supplierCount === 0) return { class: 'No Data', driver: 'No contract data' };
  if (supplierCount === 1) return { class: 'High', driver: 'Single supplier (SPOF)' };
  if (keySupplierSpendShare >= 0.70) return { class: 'High', driver: `Key supplier spend share ${(keySupplierSpendShare * 100).toFixed(0)}%` };
  if (supplierCount <= 2 || keySupplierSpendShare >= 0.50) return { class: 'Medium', driver: `${supplierCount} suppliers` };
  return { class: 'Low', driver: 'Diversified supply base' };
}

export function classifySupplierPerformance(nonCompliantRatio: number, avgScore: number, poorRatings: number, nonCompliantCount: number): { class: RiskClass; driver: string } {
  if (nonCompliantRatio >= 0.75 && avgScore < 50) return { class: 'High', driver: `${nonCompliantCount} non-compliant, avg score ${avgScore.toFixed(0)}%` };
  if (poorRatings >= 2 && nonCompliantRatio >= 0.50) return { class: 'High', driver: `${poorRatings} poor ratings, NCR ${(nonCompliantRatio * 100).toFixed(0)}%` };
  if (nonCompliantRatio >= 0.50 || avgScore < 60) return { class: 'Medium', driver: `Score ${avgScore.toFixed(0)}%, ${nonCompliantCount} non-compliant` };
  if (nonCompliantCount >= 1) return { class: 'Medium', driver: `${nonCompliantCount} non-compliant contract(s)` };
  return { class: 'Low', driver: 'Suppliers performing well' };
}
