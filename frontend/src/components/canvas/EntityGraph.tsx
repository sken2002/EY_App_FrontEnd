'use client';

import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ReactFlow, Background, Controls, MiniMap, NodeTypes, Panel } from '@xyflow/react';
import { SpiderNode, Scenario } from '@/lib/types';
import { Info } from 'lucide-react';
import { WorkPackageNode } from './WorkPackageNode';
import { ContractNode } from './ContractNode';
import { MilestoneNode } from './MilestoneNode';

interface EntityGraphProps {
  nodes: any[];
  edges: any[];
  centerId: string;
  onNodeClick?: (id: string | null) => void;
}

export function EntityGraph({ nodes, edges, centerId, onNodeClick }: EntityGraphProps) {
  const nodeTypes: NodeTypes = useMemo(() => ({
    workPackage: WorkPackageNode,
    contract: ContractNode,
    milestone: MilestoneNode,
  }), []);

  const centerNode = nodes.find(n => n.id === centerId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4 }}
      className="h-full w-full"
    >
      {nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center text-gray-500">
          <p>No connected entities found for this work package.</p>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes.map(n => ({
            ...n,
            // If we have an active click selection, highlight it
            data: { ...n.data, isSelected: n.id === centerId } // We might want to handle visual selection state later, for now we just fire the event
          }))}
          edges={edges.map(e => ({
            ...e,
            animated: true,
            style: { ...e.style, strokeWidth: 2 },
          }))}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => {
            if (onNodeClick) onNodeClick(node.id);
          }}
          onPaneClick={() => {
            if (onNodeClick) onNodeClick(null);
          }}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Panel position="top-left" className="bg-[#1a1a24]/90 backdrop-blur border border-emerald-500/30 p-4 rounded-xl shadow-lg max-w-sm m-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                <Info size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">Topology & Dependency Map</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  You are viewing the calculated blast radius for <strong>{centerNode?.data.label || 'this Work Package'}</strong>. 
                  The AI Risk Engine has mapped all immediate downstream dependencies (Contracts & Milestones) that will be affected if this entity fails.
                </p>
              </div>
            </div>
          </Panel>
          <Background color="#ffffff" gap={20} size={1} style={{ opacity: 0.03 }} />
          <Controls className="bg-black/50 border border-white/10 fill-white" />
          <MiniMap
            nodeColor={(n) => {
              const data = n.data as any;
              if (n.id === centerId) return '#10b981';
              if (data?.severity === 'critical') return '#ef4444';
              if (data?.severity === 'high') return '#f97316';
              return '#6b7280';
            }}
            maskColor="rgba(10, 10, 15, 0.8)"
            className="bg-[#0f0f15] border border-white/10"
          />
        </ReactFlow>
      )}

      {/* Entity info badge */}
      {centerNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-black/80 px-6 py-3 backdrop-blur-md">
          <p className="text-sm font-semibold text-white">{centerNode.data.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {nodes.length} entities in neighborhood · {edges.length} connections
          </p>
        </div>
      )}
    </motion.div>
  );
}
