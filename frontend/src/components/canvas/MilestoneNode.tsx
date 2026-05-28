import { Handle, Position } from '@xyflow/react';
import { SpiderNodeData } from '@/lib/types';
import { Diamond, AlertTriangle } from 'lucide-react';

export function MilestoneNode({ data }: { data: SpiderNodeData & { isSelected?: boolean, isInBlast?: boolean, isTrigger?: boolean } }) {
  const isDelayed = data.status === 'Delayed';
  const delayDays = data.metrics.delayDays || 0;

  return (
    <div className={`relative flex flex-col gap-2 rounded-lg bg-[#0a0a0f]/95 p-3 min-w-[160px] border backdrop-blur shadow-xl transition-all
      ${data.isSelected ? 'ring-2 ring-white scale-105' : ''}
      ${data.isTrigger ? 'border-red-500/80 shadow-red-500/20' : 
        isDelayed ? 'border-orange-500/50' : 'border-emerald-500/20'}`}>
      
      {data.isTrigger && (
        <div className="absolute -inset-1 -z-10 animate-pulse rounded-lg bg-red-500/20 blur-md" />
      )}

      {isDelayed && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg border border-red-400">
          CRITICAL DELAY
        </div>
      )}

      <Handle type="target" position={Position.Top} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="target" id="left" position={Position.Left} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="source" id="right" position={Position.Right} className="!bg-white/50 !w-2 !h-2 !border-none" />

      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${isDelayed ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {isDelayed ? <AlertTriangle size={14} /> : <Diamond size={14} />}
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Milestone</span>
          <span className="text-xs font-semibold text-white truncate" title={data.label}>{data.label}</span>
        </div>
      </div>
      
      {isDelayed && (
        <div className="mt-1 pt-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Status</span>
          <span className="text-[10px] font-bold text-red-400">{delayDays} Days Overdue</span>
        </div>
      )}
    </div>
  );
}
