'use client';

import { useSpiderState } from '@/hooks/useSpiderState';
import { LeftPanel } from '@/components/layout/LeftPanel';
import { CenterCanvas } from '@/components/canvas/CenterCanvas';
import { RightPanel } from '@/components/layout/RightPanel';
import { Header } from '@/components/layout/Header';
import { useState, useCallback } from 'react';
import { DimensionKey } from '@/lib/types';

export type DrillLevel = 'portfolio' | 'pillar' | 'entity';

export interface DrillState {
  level: DrillLevel;
  activePillar: DimensionKey | null;
  activeEntityId: string | null;
}

export default function Home() {
  const { data, loading, error } = useSpiderState();
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  
  // Drill-down navigation state
  const [drill, setDrill] = useState<DrillState>({
    level: 'portfolio',
    activePillar: null,
    activeEntityId: null,
  });

  // Navigation handlers
  const drillIntoPillar = useCallback((pillar: DimensionKey) => {
    setDrill({ level: 'pillar', activePillar: pillar, activeEntityId: null });
  }, []);

  const drillIntoEntity = useCallback((entityId: string) => {
    setDrill(prev => ({ ...prev, level: 'entity', activeEntityId: entityId }));
  }, []);

  const navigateBack = useCallback(() => {
    setDrill(prev => {
      if (prev.level === 'entity') return { ...prev, level: 'pillar', activeEntityId: null };
      if (prev.level === 'pillar') return { level: 'portfolio', activePillar: null, activeEntityId: null };
      return prev;
    });
  }, []);

  // Set default scenario when data loads
  if (data && !activeScenarioId && data.scenarios.length > 0) {
    setActiveScenarioId(data.scenarios[0].id);
  }

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

  const activeScenario = data.scenarios.find(s => s.id === activeScenarioId) || data.scenarios[0];

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0a0f] text-white">
      <Header 
        scenarios={data.scenarios} 
        activeScenarioId={activeScenarioId}
        onScenarioChange={setActiveScenarioId}
        meta={data.meta}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Risk Index (280px) */}
        <LeftPanel 
          riskIndex={data.riskIndex} 
          activePillar={drill.activePillar}
          onPillarClick={drillIntoPillar}
        />

        {/* Center Panel: Progressive Drill-Down Canvas (Flex) */}
        <CenterCanvas 
          nodes={data.nodes} 
          edges={data.edges}
          riskIndex={data.riskIndex}
          scenario={activeScenario}
          drill={drill}
          onDrillIntoPillar={drillIntoPillar}
          onDrillIntoEntity={drillIntoEntity}
          onNavigateBack={navigateBack}
        />

        {/* Right Panel: Strategist Agent (360px) */}
        <RightPanel 
          scenario={activeScenario} 
          selectedNodeId={drill.activeEntityId}
          nodes={data.nodes}
          drill={drill}
        />
      </div>
    </main>
  );
}
