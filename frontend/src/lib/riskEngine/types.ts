import { DimensionKey, TrendDirection, SpiderNode, SpiderEdge } from '../types';

export type RiskClass = 'High' | 'Medium' | 'Low' | 'No Data';

export interface ScenarioResult {
  id: string;
  name: string;
  description: string;
  score: number;             // 0.0 to 1.0 representing probability/confidence
  confidence: 'High' | 'Medium' | 'Low';
  residualScore: number;
  residualClass: 'High' | 'Medium' | 'Low';
  shortTermActions: string[];
  midTermActions: string[];
  longTermActions: string[];
}

export interface SimulationLever {
  id: string;                    // e.g., 'cpi', 'supplierCount', 'completionPct'
  label: string;                 // e.g., "CPI", "Supplier Count"
  currentValue: number;          // The baseline value from state.json
  simulatedValue: number;        // User-adjusted value
  min: number;
  max: number;
  step: number;
  unit: string;                  // e.g., '%', 'days', 'ratio', ''
  dimensionKey: DimensionKey;    // Which dimension this lever primarily affects
}

export interface PropagationRule {
  id: string;
  sourceSignal: string;          // e.g., 'supplier.complianceIssue'
  targetDimension: DimensionKey; // e.g., 'schedule'
  baseProbability: number;       // Probability of propagation (0.0 - 1.0)
  basePressure: number;          // Magnitude of score increase if propagation triggers
  description: string;           // Human-readable explanation
  condition: (node: SpiderNode) => boolean; // Evaluates if the source node emits this signal
}

export interface MitigationFactor {
  id: string;
  label: string;                 // e.g., "Multiple suppliers available"
  signal: string;                // Identifier for the mitigation
  reduction: number;             // Risk score reduction (0.0 to 1.0, e.g., 0.15 = 15% reduction)
  active: boolean;               // Whether this mitigation applies to the current WP
  dimension: DimensionKey;       // Which dimension this mitigates
  description: string;
}

export interface WPRiskState {
  detected: Record<DimensionKey, { score: number; class: RiskClass; drivers: string[] }>;
  propagated: Record<DimensionKey, number>; // Extra pressure added by graph propagation
  mitigations: MitigationFactor[];
  residual: Record<DimensionKey, { score: number; class: RiskClass }>;
  cri: {
    score: number;
    class: RiskClass;
  };
  blastRadius: {
    impactedNodeIds: string[];
    totalExposure: number;
  };
  activeScenarios: ScenarioResult[];
}

export interface SimulationResult {
  wpId: string;
  levers: SimulationLever[];
  state: WPRiskState;
  delta: {
    criDelta: number;
    // We can expand this with more delta comparisons later
  };
}
