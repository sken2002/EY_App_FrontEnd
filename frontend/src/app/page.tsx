'use client';

import { useSpiderState } from '@/hooks/useSpiderState';
import { LeftPanel } from '@/components/layout/LeftPanel';
import { CenterCanvas } from '@/components/canvas/CenterCanvas';
import { RightPanel } from '@/components/layout/RightPanel';
import { Header } from '@/components/layout/Header';
import { useState, useCallback, useMemo } from 'react';
import { DimensionKey } from '@/lib/types';

export type DrillLevel = 'portfolio' | 'pillar' | 'entity' | 'macro';



export interface DrillState {
  level: DrillLevel;
  activePillar: DimensionKey | null;
  activeEntityId: string | null;
  selectedSubNodeId?: string | null;
}

export default function Home() {
  const { data, loading, error } = useSpiderState();
  const [globalFilters, setGlobalFilters] = useState({
    criticalOnly: false,
    highExposure: false,
    persona: 'Global Executive'
  });

  // Filter nodes based on global filters
  const filteredNodes = useMemo(() => {
    if (!data?.nodes) return [];
    let nodes = [...data.nodes];
    if (globalFilters.criticalOnly) {
      nodes = nodes.filter(n => n.type === 'workPackage' ? (n.data.riskScore || 0) >= 65 : true);
    }
    if (globalFilters.highExposure) {
      nodes = nodes.filter(n => n.type === 'workPackage' ? (n.data.metrics?.plannedCost || 0) > 1000000 : true);
    }
    return nodes;
  }, [data?.nodes, globalFilters]);

  // Top-level tabs for layout simplification
  const [activeTopTab, setActiveTopTab] = useState<'scorecard' | 'topology' | 'pipeline'>('scorecard');

  // Drill-down navigation state
  const [drill, setDrill] = useState<DrillState>({
    level: 'portfolio', // Default to PM Scorecard view
    activePillar: null,
    activeEntityId: null,
    selectedSubNodeId: null,
  });

  // Navigation handlers
  const drillIntoPillar = useCallback((pillar: DimensionKey) => {
    setDrill({ level: 'pillar', activePillar: pillar, activeEntityId: null });
  }, []);

  const drillIntoEntity = useCallback((entityId: string) => {
    setDrill(prev => ({ ...prev, level: 'entity', activeEntityId: entityId, selectedSubNodeId: null }));
    setActiveTopTab('topology');
  }, []);

  const selectSubNode = useCallback((nodeId: string | null) => {
    setDrill(prev => ({ ...prev, selectedSubNodeId: nodeId }));
  }, []);

  const navigateBack = useCallback(() => {
    setDrill(prev => {
      if (prev.level === 'entity') return { ...prev, level: 'pillar', activeEntityId: null };
      if (prev.level === 'pillar') return { level: 'portfolio', activePillar: null, activeEntityId: null };
      return prev;
    });
  }, []);

  // Scenarios removed from UI state

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0f] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Project Spider Data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0f] text-red-500">
        <p>Error loading state: {error?.message || 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0a0f] text-white">
      <Header meta={data.meta} />

      {/* Top Level Tab Navigation */}
      <div className="flex border-b border-white/10 bg-[#0f0f15] px-4">
        <button 
          onClick={() => { setActiveTopTab('scorecard'); setDrill({ level: 'portfolio', activePillar: null, activeEntityId: null }); }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTopTab === 'scorecard' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Portfolio Scorecard
        </button>
        <button 
          onClick={() => { 
            setActiveTopTab('topology'); 
            const firstWp = data.nodes.find(n => n.type === 'workPackage')?.id;
            setDrill({ level: 'entity', activePillar: null, activeEntityId: firstWp || null }); 
          }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTopTab === 'topology' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Topology & Simulation
        </button>
        <button 
          onClick={() => setActiveTopTab('pipeline')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTopTab === 'pipeline' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Data Pipeline Audit
        </button>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        
        {activeTopTab === 'pipeline' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0f]">
             <h2 className="text-xl font-semibold text-emerald-400 mb-2">Backend Pipeline Integration Active</h2>
             <p className="text-gray-400 max-w-md">
               The Python Risk Engine (<code>export_state.py</code>) is currently configured to automatically append CRI metrics to <code>history.json</code> on every run.
               <br/><br/>
               In a production environment, this tab will display live ingestion logs from the data warehouse.
             </p>
          </div>
        ) : (
          <>
            {/* Left Panel: Risk Index (280px) */}
            <LeftPanel 
              riskIndex={data.riskIndex} 
              activePillar={drill.activePillar}
              onPillarClick={drillIntoPillar}
              globalFilters={globalFilters}
              setGlobalFilters={setGlobalFilters}
              onWatchlistClick={drillIntoEntity}
            />

            {/* Center Panel: Progressive Drill-Down Canvas (Flex) */}
            <CenterCanvas 
              drill={drill} 
              nodes={filteredNodes} 
              edges={data.edges} 
              riskIndex={data.riskIndex}
              globalFilters={globalFilters}
              onDrillIntoPortfolio={() => setDrill({ level: 'portfolio', activePillar: null, activeEntityId: null })}
              onDrillIntoPillar={drillIntoPillar}
              onDrillIntoEntity={drillIntoEntity}
              onNavigateBack={navigateBack}
              onNodeClick={selectSubNode}
            />

            {/* Right Panel: Risk Engine Simulation (380px) - Only show in Topology */}
            {activeTopTab === 'topology' && (
              <RightPanel 
                selectedNodeId={drill.selectedSubNodeId || drill.activeEntityId}
                nodes={filteredNodes}
                edges={data.edges}
                dataQualityConfidence={data.riskIndex.dataQuality.confidenceModifier}
                activePersona={globalFilters.persona}
              />
            )}
          </>
        )}
      </div>

    </main>
  );
}
