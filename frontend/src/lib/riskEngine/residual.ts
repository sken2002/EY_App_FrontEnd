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
    // 1. Base score + Propagation pressure
    let rawScore = detected[dim].score + (propagated[dim] || 0);
    rawScore = Math.min(rawScore, 100); // Cap at 100
    
    // 2. Find active mitigations for this dimension
    const activeMitigations = mitigations.filter(m => m.active && m.dimension === dim);
    
    // 3. Apply reduction (additive percentages for simplicity)
    let totalReduction = 0;
    for (const m of activeMitigations) {
      totalReduction += m.reduction;
    }
    totalReduction = Math.min(totalReduction, 0.8); // Cap reduction at 80%
    
    // 4. Calculate residual score
    let finalScore = rawScore * (1 - totalReduction);
    finalScore = Math.round(Math.max(finalScore, 0)); // Floor at 0
    
    // 5. Reclassify based on final score
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
  
  // Weights from EY Framework
  const weights: Record<DimensionKey, number> = {
    costFinancial: 0.25,
    cashflow: 0.20,
    schedule: 0.20,
    operational: 0.10,
    supplier: 0.20
  };

  let cri = 0;
  for (const [dim, weight] of Object.entries(weights)) {
    cri += residual[dim as DimensionKey].score * weight;
  }

  // Apply confidence modifier
  cri = Math.round(cri * dataQualityConfidence);

  let criClass: RiskClass = 'Low';
  if (cri >= 65) criClass = 'High';
  else if (cri >= 40) criClass = 'Medium';

  return { score: cri, class: criClass };
}
