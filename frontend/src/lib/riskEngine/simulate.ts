import { DimensionKey, SpiderNode, SpiderEdge } from '../types';
import { SimulationLever, WPRiskState, SimulationResult } from './types';
import { 
  calculateDimensionScore, 
  classifyMilestoneDelay, 
  classifyCompletionSlippage,
  classifyBacklog,
  classifyOperationalIncident,
  classifyCostVariance,
  classifyCpiSpi,
  classifyCashflow,
  classifyPaymentRejection,
  classifySupplierConcentration,
  classifySupplierPerformance
} from './detection';
import { propagateRisk } from './propagation';
import { detectMitigations } from './mitigation';
import { computeResidualRisk, computeCRI } from './residual';

// Helper: Graph traversal to find blast radius (downstream nodes)
function computeBlastRadius(startNodeId: string, edges: SpiderEdge[], maxDepth = 3): string[] {
  const impacted = new Set<string>();
  let currentLevel = new Set<string>([startNodeId]);
  
  for (let depth = 0; depth < maxDepth; depth++) {
    const nextLevel = new Set<string>();
    for (const edge of edges) {
      if (currentLevel.has(edge.source) && !impacted.has(edge.target)) {
        impacted.add(edge.target);
        nextLevel.add(edge.target);
      }
    }
    if (nextLevel.size === 0) break;
    currentLevel = nextLevel;
  }
  
  return Array.from(impacted);
}

// Master Simulation Runner
export function simulateWPRisk(
  targetNode: SpiderNode,
  levers: SimulationLever[],
  allNodes: SpiderNode[],
  allEdges: SpiderEdge[],
  dataQualityConfidence: number
): SimulationResult {
  
  // 1. Create a simulated copy of the node's metrics based on lever inputs
  const simulatedMetrics = { ...targetNode.data.metrics };
  
  for (const lever of levers) {
    if (lever.id === 'cpi') simulatedMetrics.cpi = lever.simulatedValue;
    if (lever.id === 'spi') simulatedMetrics.spi = lever.simulatedValue;
    if (lever.id === 'completionPct') simulatedMetrics.completionPct = lever.simulatedValue;
    if (lever.id === 'supplierCount') simulatedMetrics.supplierCount = lever.simulatedValue;
    if (lever.id === 'budgetVariance') simulatedMetrics.budgetVariance = lever.simulatedValue;
    if (lever.id === 'backlogRatio') simulatedMetrics.backlogRatio = lever.simulatedValue / 100; // Assuming UI gives %, metrics stores ratio
  }

  // Helper mapping to raw state values if metric is missing
  const getM = (key: keyof typeof simulatedMetrics, fallback = 0) => simulatedMetrics[key] as number || fallback;

  // 2. LAYER 2: DETECTION (Recompute base risks with new metrics)
  // Schedule
  const msRisk = classifyMilestoneDelay(getM('delayedProp'), getM('avgDelayDays'), getM('atRiskCount'));
  const slipRisk = classifyCompletionSlippage(getM('slippageRatio'), getM('completionShortfall'), false, false); // Assuming no flags for simple sim
  const scheduleDim = calculateDimensionScore([msRisk.class, slipRisk.class]);
  
  // Operational
  const backlogRisk = classifyBacklog(getM('backlogRatio'), getM('onHoldCount'), getM('totalSO'));
  const opsIncRisk = classifyOperationalIncident(getM('emergencyCount'), getM('unresolvedCount'), getM('totalSO_ops'));
  const operationalDim = calculateDimensionScore([backlogRisk.class, opsIncRisk.class]);

  // Cost & Financial
  const costVarRisk = classifyCostVariance(getM('budgetVariance') / 100); // UI gives %, compute needs ratio
  const cpiSpiRisk = classifyCpiSpi(getM('cpi', undefined as any), getM('spi', undefined as any), 'On Track'); // Default to On Track for now
  const costDim = calculateDimensionScore([costVarRisk.class, cpiSpiRisk.class]);

  // Cashflow
  const cfDevRisk = classifyCashflow(getM('cashflowDevRatio'));
  const pmtRejRisk = classifyPaymentRejection(getM('rejectionRatio'), getM('rejectedCount'));
  const cashflowDim = calculateDimensionScore([cfDevRisk.class, pmtRejRisk.class]);

  // Supplier
  const concRisk = classifySupplierConcentration(getM('supplierCount'), getM('keySupplierSpendShare'));
  const perfRisk = classifySupplierPerformance(getM('nonCompliantRatio'), getM('avgSupplierScore', 100), getM('poorRatings'), getM('nonCompliantCount'));
  const supplierDim = calculateDimensionScore([concRisk.class, perfRisk.class]);

  const detected: WPRiskState['detected'] = {
    costFinancial: { score: costDim.score, class: costDim.class, drivers: [costVarRisk.driver, cpiSpiRisk.driver] },
    cashflow: { score: cashflowDim.score, class: cashflowDim.class, drivers: [cfDevRisk.driver, pmtRejRisk.driver] },
    schedule: { score: scheduleDim.score, class: scheduleDim.class, drivers: [msRisk.driver, slipRisk.driver] },
    operational: { score: operationalDim.score, class: operationalDim.class, drivers: [backlogRisk.driver, opsIncRisk.driver] },
    supplier: { score: supplierDim.score, class: supplierDim.class, drivers: [concRisk.driver, perfRisk.driver] }
  };

  // 3. LAYER 3: PROPAGATION (Walk graph for extra pressure)
  // Create a mock lookup for the propagation engine using the newly detected scores
  const scoreLookup: Record<string, Record<DimensionKey, number>> = {};
  for (const n of allNodes) {
    if (n.id === targetNode.id) continue;
    scoreLookup[n.id] = {
      costFinancial: n.data.dimensions?.costFinancial?.score || 20,
      cashflow: n.data.dimensions?.cashflow?.score || 20,
      schedule: n.data.dimensions?.schedule?.score || 20,
      operational: n.data.dimensions?.operational?.score || 20,
      supplier: n.data.dimensions?.supplier?.score || 20,
    };
  }
  
  const propagated = propagateRisk(targetNode.id, allNodes, allEdges, scoreLookup);

  // 4. LAYER 4: MITIGATION
  // Create a temporary simulated node to pass into mitigations
  const simulatedNode = { ...targetNode, data: { ...targetNode.data, metrics: simulatedMetrics } };
  const mitigations = detectMitigations(simulatedNode);

  // 5. LAYER 5: RESIDUAL & CRI
  const residual = computeResidualRisk(detected, propagated, mitigations);
  const cri = computeCRI(residual, dataQualityConfidence);

  // 6. LAYER 8: BLAST RADIUS
  const impactedNodeIds = computeBlastRadius(targetNode.id, allEdges);
  
  // Calculate financial exposure (sum of planned costs of impacted nodes)
  let totalExposure = 0;
  for (const nId of impactedNodeIds) {
    const node = allNodes.find(n => n.id === nId);
    if (node && node.data.metrics.plannedCost) {
      totalExposure += node.data.metrics.plannedCost;
    }
  }

  // 7. ASSEMBLE STATE
  const state: WPRiskState = {
    detected,
    propagated,
    mitigations,
    residual,
    cri,
    blastRadius: {
      impactedNodeIds,
      totalExposure
    }
  };

  return {
    wpId: targetNode.id,
    levers,
    state,
    delta: {
      criDelta: cri.score - (targetNode.data.riskScore || 0)
    }
  };
}
