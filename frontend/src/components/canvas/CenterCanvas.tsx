'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SpiderNode, SpiderEdge as SpiderEdgeType, Scenario, RiskIndex, DimensionKey } from '@/lib/types';
import { DrillState } from '@/app/page';
import { PortfolioView } from './PortfolioView';
import { PillarView } from './PillarView';
import { EntityGraph } from './EntityGraph';
import { Breadcrumbs } from './Breadcrumbs';
import { MacroHeatmap } from './MacroHeatmap';

interface CenterCanvasProps {
  nodes: SpiderNode[];
  edges: SpiderEdgeType[];
  riskIndex: RiskIndex;
  drill: DrillState;
  globalFilters?: { criticalOnly: boolean; highExposure: boolean };
  onDrillIntoPillar: (pillar: DimensionKey) => void;
  onDrillIntoEntity: (entityId: string) => void;
  onNavigateBack: () => void;
  onDrillIntoPortfolio?: (workstream: string) => void;
  onNodeClick?: (id: string | null) => void;
}
export function CenterCanvas({ 
  nodes, edges, riskIndex, drill, globalFilters,
  onDrillIntoPillar, onDrillIntoEntity, onNavigateBack, onDrillIntoPortfolio, onNodeClick
}: CenterCanvasProps) {

  const filteredNodes = useMemo(() => {
    let result = [...nodes];
    if (globalFilters?.criticalOnly) {
      result = result.filter(n => n.type === 'workPackage' ? (n.data.riskScore || 0) >= 65 : true);
    }
    if (globalFilters?.highExposure) {
      result = result.filter(n => n.type === 'workPackage' ? (n.data.metrics?.plannedCost || 0) > 1000000 : true);
    }
    return result;
  }, [nodes, globalFilters]);

  // Filter WP nodes for the active dimension, sorted by severity
  const pillarWPs = useMemo(() => {
    if (!drill.activePillar) return [];
    const dimKey = drill.activePillar;
    
    return nodes
      .filter(n => n.type === 'workPackage')
      .map(n => {
        const dimData = n.data.dimensions?.[dimKey];
        return { ...n, pillarRiskClass: dimData?.class || 'Low', pillarRiskDriver: dimData?.driver || '' };
      })
      .sort((a, b) => {
        const order: Record<string, number> = { High: 0, Medium: 1, Low: 2, 'No Data': 3 };
        return (order[a.pillarRiskClass] ?? 2) - (order[b.pillarRiskClass] ?? 2);
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

    const allEdges = [...connectedEdges, ...secondDegreeEdges].map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      
      let label = 'impacts';
      if (sourceNode?.type === 'contract' && targetNode?.type === 'workPackage') label = 'supplies →';
      if (sourceNode?.type === 'milestone' && targetNode?.type === 'workPackage') label = 'blocks →';
      if (sourceNode?.type === 'workPackage' && targetNode?.type === 'milestone') label = 'depends on →';
      if (sourceNode?.type === 'workPackage' && targetNode?.type === 'contract') label = 'funds →';
      
      return {
        ...e,
        label,
        labelStyle: { fill: '#a7f3d0', fontWeight: 600, fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#050505', stroke: '#10b981', fillOpacity: 0.9, strokeWidth: 1, rx: 4, ry: 4 },
        labelBgPadding: [4, 4],
      };
    });
    // Categorize nodes for Left-to-Right layout
    const upstreamIds = new Set<string>();
    const downstreamIds = new Set<string>();
    
    allEdges.forEach(e => {
      if (e.target === targetId) upstreamIds.add(e.source);
      if (e.source === targetId) downstreamIds.add(e.target);
    });

    const activeNodes = nodes.filter(n => connectedNodeIds.has(n.id));
    
    let upCount = 0;
    let downCount = 0;
    let otherCount = 0;
    
    activeNodes.forEach(n => {
      if (n.id !== targetId) {
        if (upstreamIds.has(n.id)) upCount++;
        else if (downstreamIds.has(n.id)) downCount++;
        else otherCount++;
      }
    });

    const upStartY = 350 - (Math.max(0, upCount - 1) * 150) / 2;
    const downStartY = 350 - (Math.max(0, downCount - 1) * 150) / 2;
    const otherStartY = 100 - (Math.max(0, otherCount - 1) * 150) / 2;

    let currUp = 0;
    let currDown = 0;
    let currOther = 0;

    const graphNodes = activeNodes.map(n => {
      const isCenter = n.id === targetId;
      let x = 500;
      let y = 350;

      if (!isCenter) {
        if (upstreamIds.has(n.id)) {
          x = 100;
          y = upStartY + (currUp * 150);
          currUp++;
        } else if (downstreamIds.has(n.id)) {
          x = 900;
          y = downStartY + (currDown * 150);
          currDown++;
        } else {
          x = 500;
          y = otherStartY + (currOther * 150);
          currOther++;
      return {
        ...n,
        position: { x, y },
        data: {
          ...n.data,
          isSelected: isCenter,
          isInBlast: false,
          isTrigger: isCenter,
        }
      };
    });

    return { nodes: graphNodes, edges: allEdges };
  }, [drill.activeEntityId, nodes, edges]);

  // Get labels for breadcrumbs
  const selectedEntityLabel = drill.activeEntityId 
    ? nodes.find(n => n.id === drill.activeEntityId)?.data.label || drill.activeEntityId
    : null;
  
  const activeDimLabel = drill.activePillar 
    ? riskIndex[drill.activePillar]?.label 
    : undefined;

  const anim = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
    transition: { duration: 0.3 }
  };

  return (
    <div className="flex flex-1 flex-col bg-[#0a0a0f] relative overflow-hidden">
      {/* Breadcrumb Navigation */}
      {drill.level !== 'macro' && (
        <Breadcrumbs 
          drill={drill}
          pillarLabel={activeDimLabel}
          entityLabel={selectedEntityLabel || undefined}
          onNavigateBack={onNavigateBack}
        />
      )}

      {/* Dynamic View Layer */}
      <div className="flex-1 overflow-hidden p-6 relative">
        <AnimatePresence mode="wait">
          
          {drill.level === 'portfolio' && (
            <motion.div key="portfolio" {...anim} className="absolute inset-0">
              <PortfolioView 
                nodes={filteredNodes}
                riskIndex={riskIndex} 
                onPillarClick={onDrillIntoPillar}
                onEntityClick={onDrillIntoEntity}
              />
            </motion.div>
          )}

          {drill.level === 'macro' && (
            <motion.div key="macro" {...anim} className="absolute inset-0">
              <MacroHeatmap 
                nodes={filteredNodes} 
                onSelectWorkstream={(ws) => {
                  if (onDrillIntoPortfolio) onDrillIntoPortfolio(ws);
                }}
              />
            </motion.div>
          )}

          {drill.level === 'pillar' && drill.activePillar && (
            <motion.div key="pillar" {...anim} className="absolute inset-0">
              <PillarView
                pillarKey={drill.activePillar}
                pillar={riskIndex[drill.activePillar]}
                workPackages={pillarWPs} // Note: pillarWPs uses drill.activePillar, maybe we should filter it?
                onEntityClick={onDrillIntoEntity}
              />
            </motion.div>
          )}

          {drill.level === 'entity' && drill.activeEntityId && (
            <motion.div key="entity" {...anim} className="absolute inset-0">
              <EntityGraph
                nodes={entityGraph.nodes} // Filtered for neighborhood
                edges={entityGraph.edges}
                centerId={drill.activeEntityId}
                onNodeClick={onNodeClick}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
