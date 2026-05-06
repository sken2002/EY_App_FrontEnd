export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type RiskClass = 'High' | 'Medium' | 'Low';

export interface RiskSubComponent {
  class: RiskClass;
  driver: string;
}

export interface DeliveryRisk {
  class: RiskClass;
  driver: string;
  subComponents: {
    milestoneDelay: RiskSubComponent;
    completionSlippage: RiskSubComponent;
    soBacklog: RiskSubComponent;
    operational: RiskSubComponent;
  };
}

export interface CostRisk {
  class: RiskClass;
  driver: string;
  subComponents: {
    costVariance: RiskSubComponent;
    cpiSpi: RiskSubComponent;
    cashflow: RiskSubComponent;
  };
}

export interface SupplierRisk {
  class: RiskClass;
  driver: string;
  subComponents: {
    concentration: RiskSubComponent;
    performance: RiskSubComponent;
  };
}

export interface SpiderNodeData {
  label: string;
  subtitle: string;
  status: string;
  priority?: string;
  riskScore: number;
  severity: Severity;
  metrics: Record<string, any>;
  deliveryRisk?: DeliveryRisk;
  costRisk?: CostRisk;
  supplierRisk?: SupplierRisk;
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
}

export interface PillarRisk {
  label: string;
  icon: string;
  overallScore: number;
  severity: Severity;
  activeAlerts: number;
  breakdown: PillarBreakdown;
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
    scenarioCount: number;
    nodeCount: number;
    edgeCount: number;
  };
  riskIndex: {
    delivery: PillarRisk;
    cost: PillarRisk;
    supplier: PillarRisk;
  };
  nodes: SpiderNode[];
  edges: SpiderEdge[];
  scenarios: Scenario[];
}
