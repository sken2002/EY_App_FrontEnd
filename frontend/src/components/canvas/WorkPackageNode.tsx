import { Handle, Position } from '@xyflow/react';
import { SpiderNodeData } from '@/lib/types';
import { Briefcase, AlertCircle } from 'lucide-react';

export function WorkPackageNode({ data }: { data: SpiderNodeData & { isSelected?: boolean, isInBlast?: boolean, isTrigger?: boolean } }) {
  const isCritical = data.severity === 'critical';
  const criScore = data.riskScore || 0;
  
  return (
    <div className={`relative w-[320px] rounded-xl border bg-black/80 p-5 shadow-2xl backdrop-blur-md transition-all
      ${data.isSelected ? 'ring-2 ring-emerald-500 scale-[1.02] shadow-emerald-500/20' : ''}
      ${data.isTrigger ? 'border-red-500 shadow-red-500/20' : 
        isCritical ? 'border-orange-500/50' : 'border-emerald-500/30'}`}>
      
      {/* Node styling effects */}
      {data.isTrigger && (
        <div className="absolute -inset-1 -z-10 animate-pulse rounded-xl bg-red-500/20 blur-md" />
      )}
      
      {data.isSelected && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border border-emerald-400 uppercase tracking-widest">
          Central Work Package
        </div>
      )}

      {/* Handles for edges */}
      <Handle type="target" position={Position.Top} className="!bg-emerald-500/50 !w-3 !h-3 !border-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500/50 !w-3 !h-3 !border-none" />
      <Handle type="target" id="left" position={Position.Left} className="!bg-emerald-500/50 !w-3 !h-3 !border-none" />
      <Handle type="source" id="right" position={Position.Right} className="!bg-emerald-500/50 !w-3 !h-3 !border-none" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1.5 ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
            <Briefcase size={14} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight truncate w-[180px]" title={data.label}>
              {data.label}
            </h3>
            <p className="text-[10px] text-gray-400">{data.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">CRI Score</p>
          <div className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${criScore > 65 ? 'bg-red-500/20 text-red-400' : criScore > 40 ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {criScore}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Completion</p>
          <p className="text-xs font-medium text-white">{data.metrics.completionPct?.toFixed(0) || 0}%</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Budget</p>
          <p className="text-xs font-medium text-white">£{((data.metrics.plannedCost || 100000) / 1000000).toFixed(1)}M</p>
        </div>
      </div>

      {/* Mini Dimension Badges */}
      <div className="mt-3 flex gap-1">
        {(['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'] as const).map(dk => {
          const dim = data.dimensions?.[dk];
          const isHigh = dim?.class === 'High';
          const label = dk === 'costFinancial' ? 'Cost' : dk === 'cashflow' ? 'CF' : dk === 'schedule' ? 'Sched' : dk === 'operational' ? 'Ops' : 'Sup';
          return (
            <div key={dk} className={`flex flex-1 items-center justify-center rounded py-0.5 text-[8px] font-bold uppercase
              ${isHigh ? 'bg-red-500/20 text-red-400' : dim?.class === 'Medium' ? 'bg-orange-500/15 text-orange-400' : 'bg-white/5 text-gray-500'}`}>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
