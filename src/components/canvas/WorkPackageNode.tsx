import { Handle, Position } from '@xyflow/react';
import { SpiderNodeData } from '@/lib/types';
import { Briefcase, AlertCircle } from 'lucide-react';

export function WorkPackageNode({ data }: { data: SpiderNodeData & { isSelected?: boolean, isInBlast?: boolean, isTrigger?: boolean } }) {
  const isCritical = data.severity === 'critical';
  
  return (
    <div className={`relative w-[280px] rounded-xl border bg-black/80 p-4 shadow-xl backdrop-blur-md transition-all
      ${data.isSelected ? 'ring-2 ring-white scale-105' : ''}
      ${data.isTrigger ? 'border-red-500 shadow-red-500/20' : 
        isCritical ? 'border-orange-500/50' : 'border-white/10'}`}>
      
      {/* Node styling effects */}
      {data.isTrigger && (
        <div className="absolute -inset-1 -z-10 animate-pulse rounded-xl bg-red-500/20 blur-sm" />
      )}

      {/* Handles for edges */}
      <Handle type="target" position={Position.Top} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="target" id="left" position={Position.Left} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="source" id="right" position={Position.Right} className="!bg-white/50 !w-2 !h-2 !border-none" />

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

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Completion</p>
          <p className="text-xs font-medium text-white">{data.metrics.completionPct?.toFixed(0) || 0}%</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cost Var</p>
          <p className="text-xs font-medium text-white">{data.metrics.budgetVariance?.toFixed(1) || 0}%</p>
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
