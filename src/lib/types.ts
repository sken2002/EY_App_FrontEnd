export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type RiskClass = 'High' | 'Medium' | 'Low' | 'No Data';
export type TrendDirection = 'improving' | 'stable' | 'declining' | 'insufficient_data';

export type DimensionKey = 'costFinancial' | 'cashflow' | 'schedule' | 'operational' | 'supplier';

export interface RiskSubComponent {
  class: RiskClass;
  driver: string;
}

export interface DimensionRisk {
  score: number;
  class: RiskClass;
  driver: string;
  subComponents: Record<string, RiskSubComponent>;
}

export interface SpiderNodeData {
  label: string;
  subtitle: string;
  status: string;
  priority?: string;
  riskScore: number;
  severity: Severity;
  metrics: Record<string, any>;
  dimensions?: Record<DimensionKey, DimensionRisk>;
  trends?: Record<string, TrendDirection>;
  owner?: string;
  contractorId?: string;
  supplierId?: string;
  workPackageId?: string;
}

export interface SpiderNode {
  id: string;
  type: string;
  data: SpiderNodeData;
  position: { x: number; y: number };
}

export interface SpiderEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data: {
    relationship: string;
    weight: number;
    description: string;
  };
  animated: boolean;
  style: any;
}

export interface PillarBreakdown {
  high: number;
  medium: number;
  low: number;
  noData?: number;
}

export interface DimensionRiskIndex {
  label: string;
  icon: string;
  weight: number;
  score: number;
  severity: Severity;
  activeAlerts: number;
  breakdown: PillarBreakdown;
  paymentRejectionRate?: number;
  trend?: TrendDirection;
}

export interface DataQualityIndex {
  label: string;
  icon: string;
  weight: number;
  confidenceModifier: number;
  totalIssues: number;
  criticalIssues: number;
  inventoryScore: number;
  issueScore: number;
}

export interface CompositeRiskIndex {
  weightedScore: number;
  confidence: number;
  severity: Severity;
  breakdown: PillarBreakdown;
}

export interface RiskIndex {
  costFinancial: DimensionRiskIndex;
  cashflow: DimensionRiskIndex;
  schedule: DimensionRiskIndex;
  operational: DimensionRiskIndex;
  supplier: DimensionRiskIndex;
  dataQuality: DataQualityIndex;
  compositeRiskIndex: CompositeRiskIndex;
}

export interface RemediationStep {
  id: string;
  priority: string;
  action: string;
  owner: string;
  riskReduction: number;
}

export interface AgentAnalysis {
  executiveSummary: string;
  impactNarrative: string[];
  remediationSteps: RemediationStep[];
  confidenceScore: number;
}

export interface BlastRadius {
  impactedNodeIds: string[];
  totalFinancialExposure: number;
  affectedWorkPackages: number;
  maxCascadeDepth: number;
}

export interface Scenario {
  id: string;
  title: string;
  triggerNodeId: string;
  severity: Severity;
  summary: string;
  blastRadius: BlastRadius;
  agentAnalysis: AgentAnalysis;
}

export interface SpiderState {
  meta: {
    portfolioId: string;
    generatedAt: string;
    version: string;
    framework?: string;
    scenarioCount: number;
    nodeCount: number;
    edgeCount: number;
    dimensions?: string[];
  };
  riskIndex: RiskIndex;
  nodes: SpiderNode[];
  edges: SpiderEdge[];
  scenarios: Scenario[];
}
