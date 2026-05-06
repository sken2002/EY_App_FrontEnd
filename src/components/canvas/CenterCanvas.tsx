'use client';

import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SpiderNode, SpiderEdge as SpiderEdgeType, Scenario, PillarRisk } from '@/lib/types';
import { DrillState, PillarKey } from '@/app/page';
import { PortfolioView } from './PortfolioView';
import { PillarView } from './PillarView';
import { EntityGraph } from './EntityGraph';
import { Breadcrumbs } from './Breadcrumbs';

interface CenterCanvasProps {
  nodes: SpiderNode[];
  edges: SpiderEdgeType[];
  riskIndex: { delivery: PillarRisk; cost: PillarRisk; supplier: PillarRisk };
  scenario: Scenario;
  drill: DrillState;
  onDrillIntoPillar: (pillar: PillarKey) => void;
  onDrillIntoEntity: (entityId: string) => void;
  onNavigateBack: () => void;
}

const PILLAR_RISK_KEY_MAP: Record<PillarKey, string> = {
  delivery: 'deliveryRisk',
  cost: 'costRisk',
  supplier: 'supplierRisk',
};

export function CenterCanvas({ 
  nodes, edges, riskIndex, scenario, drill, 
  onDrillIntoPillar, onDrillIntoEntity, onNavigateBack 
}: CenterCanvasProps) {

  // Filter WP nodes for the active pillar, sorted by severity
  const pillarWPs = useMemo(() => {
    if (!drill.activePillar) return [];
    const riskKey = PILLAR_RISK_KEY_MAP[drill.activePillar];
    
    return nodes
      .filter(n => n.type === 'workPackage')
      .map(n => {
        const riskData = (n.data as any)[riskKey];
        return { ...n, pillarRiskClass: riskData?.class || 'Low', pillarRiskDriver: riskData?.driver || '' };
      })
      .sort((a, b) => {
        const order = { High: 0, Medium: 1, Low: 2 };
        return (order[a.pillarRiskClass as keyof typeof order] || 2) - (order[b.pillarRiskClass as keyof typeof order] || 2);
      });
  }, [nodes, drill.activePillar]);

  // For entity graph: get the selected WP + its immediate neighborhood
  const entityGraph = useMemo(() => {
    if (!drill.activeEntityId) return { nodes: [], edges: [] };

    const targetId = drill.activeEntityId;
    
    // Find all edges connected to this entity
    const connectedEdges = edges.filter(e => e.source === targetId || e.target === targetId);
    const connectedNodeIds = new Set<string>([targetId]);
    connectedEdges.forEach(e => {
      connectedNodeIds.add(e.source);
      connectedNodeIds.add(e.target);
    });

    // Get second-degree connections for a richer graph
    const secondDegreeEdges = edges.filter(e => 
      (connectedNodeIds.has(e.source) || connectedNodeIds.has(e.target)) &&
      !(e.source === targetId || e.target === targetId)
    );
    secondDegreeEdges.forEach(e => {
      if (connectedNodeIds.has(e.source)) connectedNodeIds.add(e.target);
      if (connectedNodeIds.has(e.target)) connectedNodeIds.add(e.source);
    });

    const allEdges = [...connectedEdges, ...secondDegreeEdges];
    const graphNodes = nodes
      .filter(n => connectedNodeIds.has(n.id))
      .map((n, idx) => {
        // Re-layout: place the target node in center, others around it
        const isCenter = n.id === targetId;
        const angle = (idx / connectedNodeIds.size) * 2 * Math.PI;
        const radius = isCenter ? 0 : 280;
        return {
          ...n,
          position: {
            x: 500 + Math.cos(angle) * radius,
            y: 350 + Math.sin(angle) * radius,
          },
          data: {
            ...n.data,
            isSelected: isCenter,
            isInBlast: scenario.blastRadius.impactedNodeIds.includes(n.id),
            isTrigger: n.id === scenario.triggerNodeId,
          }
        };
      });

    return { nodes: graphNodes, edges: allEdges };
  }, [drill.activeEntityId, nodes, edges, scenario]);

  // Get the selected entity name for breadcrumbs
  const selectedEntityLabel = drill.activeEntityId 
    ? nodes.find(n => n.id === drill.activeEntityId)?.data.label || drill.activeEntityId
    : null;

  return (
    <div className="flex flex-1 flex-col bg-[#0a0a0f] relative overflow-hidden">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs 
        drill={drill}
        pillarLabel={drill.activePillar ? riskIndex[drill.activePillar]?.label : undefined}
        entityLabel={selectedEntityLabel || undefined}
        onNavigateBack={onNavigateBack}
      />

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {drill.level === 'portfolio' && (
            <PortfolioView 
              key="portfolio"
              riskIndex={riskIndex} 
              onPillarClick={onDrillIntoPillar}
              nodeCount={nodes.filter(n => n.type === 'workPackage').length}
            />
          )}

          {drill.level === 'pillar' && drill.activePillar && (
            <PillarView
              key={`pillar-${drill.activePillar}`}
              pillarKey={drill.activePillar}
              pillar={riskIndex[drill.activePillar]}
              workPackages={pillarWPs}
              onEntityClick={onDrillIntoEntity}
            />
          )}

          {drill.level === 'entity' && drill.activeEntityId && (
            <EntityGraph
              key={`entity-${drill.activeEntityId}`}
              nodes={entityGraph.nodes}
              edges={entityGraph.edges}
              centerId={drill.activeEntityId}
              scenario={scenario}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
