'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ReactFlow, Background, Controls, NodeTypes, Panel } from '@xyflow/react';
// CHANGED (Avery #19): removed MiniMap import — minimap was adding visual clutter without value
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
            data: { ...n.data, isSelected: n.id === centerId }
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
                  The AI Risk Engine has mapped all immediate downstream dependencies (Contracts &amp; Milestones) that will be affected if this entity fails.
                </p>
              </div>
            </div>
          </Panel>

          <Background color="#ffffff" gap={20} size={1} style={{ opacity: 0.03 }} />

          {/* CHANGED (Avery #19): restyled zoom controls — react-flow's default Controls render +/− buttons,
              but the previous `fill-white` against a dark backdrop made them barely visible.
              Now: dark pill background with light icons, sized and spaced clearly. */}
          <Controls
            className="!bg-[#1a1a24]/90 !border !border-white/20 !rounded-lg !shadow-lg [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/10 [&>button>svg]:!fill-white"
            showInteractive={false}
          />

          {/* CHANGED (Avery #19): removed MiniMap that previously rendered in the bottom-right corner.
              It was adding visual clutter without informational value at this graph size. */}

          {/* CHANGED (Avery #21): color legend explaining edge & node colours in the bottom-right
              (the space previously occupied by the minimap). Matches the colour mapping used by
              WorkPackageNode / ContractNode / MilestoneNode and the edge styles in CenterCanvas. */}
          <Panel position="bottom-right" className="bg-[#1a1a24]/90 backdrop-blur border border-white/10 p-3 rounded-lg shadow-lg m-4 text-[10px] text-gray-300">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Legend</p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 bg-emerald-400" />
                <span>Central work package</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 bg-blue-400" style={{ borderTop: '2px dashed #60a5fa', background: 'transparent' }} />
                <span>Contract (supplies)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6" style={{ borderTop: '2px dashed #fb7185', background: 'transparent' }} />
                <span>Milestone dependency</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 bg-rose-500" />
                <span>Critical / delayed</span>
              </div>
            </div>
          </Panel>
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