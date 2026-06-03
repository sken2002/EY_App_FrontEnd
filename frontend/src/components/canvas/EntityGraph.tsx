'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ReactFlow, Background, Controls, MiniMap, NodeTypes, Panel, useNodesState, useEdgesState, Node, Edge } from '@xyflow/react';
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

export function EntityGraph({ nodes: initialNodes, edges: initialEdges, centerId, onNodeClick }: EntityGraphProps) {
  const nodeTypes: NodeTypes = useMemo(() => ({
    workPackage: WorkPackageNode,
    contract: ContractNode,
    milestone: MilestoneNode,
  }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(initialNodes.map(n => ({
      ...n,
      data: { ...n.data, isSelected: n.id === centerId }
    })));
    setEdges(initialEdges.map(e => ({
      ...e,
      animated: true,
      style: { ...e.style, strokeWidth: 2 },
    })));
  }, [initialNodes, initialEdges, centerId, setNodes, setEdges]);

  const centerNode = initialNodes.find(n => n.id === centerId);

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
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
          
          <Panel position="bottom-right" className="bg-[#1a1a24]/90 backdrop-blur border border-emerald-500/30 p-4 rounded-xl shadow-lg m-4 min-w-[200px]">
            <h4 className="text-white font-semibold text-xs mb-3 uppercase tracking-wider text-center">Visual Legend</h4>
            
            <div className="space-y-4">
              <div>
                <h5 className="text-gray-400 text-[10px] uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Risk Severity</h5>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div><span className="text-xs text-gray-300">Critical / High</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div><span className="text-xs text-gray-300">Medium</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div><span className="text-xs text-gray-300">Low / Track</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-500"></div><span className="text-xs text-gray-300">No Data</span></div>
                </div>
              </div>

              <div>
                <h5 className="text-gray-400 text-[10px] uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Entity Types</h5>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm border border-emerald-500/50 bg-[#1f2937]"></div><span className="text-xs text-gray-300">Work Package</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rotate-45 border border-emerald-500/50 bg-[#1f2937] ml-0.5 mr-0.5"></div><span className="text-xs text-gray-300">Milestone</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-emerald-500/50 bg-[#1f2937]"></div><span className="text-xs text-gray-300">Contract</span></div>
                </div>
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
