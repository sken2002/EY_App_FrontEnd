import { DimensionKey } from '../types';
import { MitigationFactor, RiskClass } from './types';
import { calculateDimensionScore } from './detection'; // Assuming we want to use the same bucketing logic if needed

// Compute residual score per dimension: (Detected + Propagated) * (1 - MitigationReduction)
export function computeResidualRisk(
  detected: Record<DimensionKey, { score: number; class: RiskClass }>,
  propagated: Record<DimensionKey, number>,
  mitigations: MitigationFactor[]
): Record<DimensionKey, { score: number; class: RiskClass }> {
  
  const residual: Record<DimensionKey, { score: number; class: RiskClass }> = {
    costFinancial: { score: 0, class: 'Low' },
    cashflow: { score: 0, class: 'Low' },
    schedule: { score: 0, class: 'Low' },
    operational: { score: 0, class: 'Low' },
    supplier: { score: 0, class: 'Low' },
  };

  const dimensions: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];

  for (const dim of dimensions) {
    // 1. Base score + Propagation pressure (Propagation is now probabilistically mitigated)
    let rawScore = detected[dim].score + (propagated[dim] || 0);
    let finalScore = Math.min(Math.round(rawScore), 100); // Cap at 100
    
    // 2. Reclassify based on final score
    let finalClass: RiskClass = 'Low';
    if (finalScore >= 70) finalClass = 'High';
    else if (finalScore >= 40) finalClass = 'Medium';
    
    residual[dim] = { score: finalScore, class: finalClass };
  }

  return residual;
}

export function computeCRI(
  residual: Record<DimensionKey, { score: number; class: RiskClass }>,
  dataQualityConfidence: number
): { score: number; class: RiskClass } {
  
  // Calculate Perfect Average
  let cri = 0;
  const dimensions: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];
  for (const dim of dimensions) {
    cri += residual[dim].score;
  }
  cri = Math.round(cri / 5);

  let criClass: RiskClass = 'Low';
  if (cri >= 65) criClass = 'High';
  else if (cri >= 40) criClass = 'Medium';

  return { score: cri, class: criClass };
}
