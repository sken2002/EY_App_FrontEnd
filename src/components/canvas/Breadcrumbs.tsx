'use client';

import { DrillState } from '@/app/page';
import { ChevronLeft, Home, ChevronRight } from 'lucide-react';

interface BreadcrumbsProps {
  drill: DrillState;
  pillarLabel?: string;
  entityLabel?: string;
  onNavigateBack: () => void;
}

export function Breadcrumbs({ drill, pillarLabel, entityLabel, onNavigateBack }: BreadcrumbsProps) {
  if (drill.level === 'portfolio') return null;

  return (
    <div className="flex items-center gap-2 border-b border-white/5 bg-[#0c0c12] px-6 py-3">
      <button 
        onClick={onNavigateBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={16} />
        Back
      </button>
      
      <div className="h-4 w-px bg-white/10 mx-1" />

      <div className="flex items-center gap-1.5 text-sm">
        <button onClick={() => { onNavigateBack(); if (drill.level === 'entity') onNavigateBack(); }} className="text-gray-500 hover:text-white transition-colors">
          <Home size={14} />
        </button>
        
        {drill.activePillar && (
          <>
            <ChevronRight size={12} className="text-gray-600" />
            <button 
              onClick={drill.level === 'entity' ? onNavigateBack : undefined}
              className={`${drill.level === 'entity' ? 'text-gray-400 hover:text-white cursor-pointer' : 'text-white font-medium'} transition-colors`}
            >
              {pillarLabel}
            </button>
          </>
        )}

        {drill.activeEntityId && entityLabel && (
          <>
            <ChevronRight size={12} className="text-gray-600" />
            <span className="text-white font-medium truncate max-w-[200px]">{entityLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
