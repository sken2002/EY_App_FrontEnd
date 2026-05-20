import { Handle, Position } from '@xyflow/react';
import { SpiderNodeData } from '@/lib/types';
import { Diamond, AlertTriangle } from 'lucide-react';

export function MilestoneNode({ data }: { data: SpiderNodeData & { isSelected?: boolean, isInBlast?: boolean, isTrigger?: boolean } }) {
  const isDelayed = data.status === 'Delayed';

  return (
    <div className={`relative flex items-center gap-2 rounded bg-black/60 px-3 py-2 border backdrop-blur transition-all
      ${data.isSelected ? 'ring-2 ring-white scale-105' : ''}
      ${data.isTrigger ? 'border-red-500 shadow-red-500/20' : 
        isDelayed ? 'border-orange-500/50' : 'border-white/10'}`}>
      
      {data.isTrigger && (
        <div className="absolute -inset-1 -z-10 animate-pulse rounded bg-red-500/20 blur-sm" />
      )}

      <Handle type="target" position={Position.Top} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="target" id="left" position={Position.Left} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="source" id="right" position={Position.Right} className="!bg-white/50 !w-2 !h-2 !border-none" />

      <div className={`${isDelayed ? 'text-red-400' : 'text-amber-400'}`}>
        {isDelayed ? <AlertTriangle size={14} /> : <Diamond size={14} />}
      </div>
      
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold text-white leading-none w-24 truncate" title={data.label}>{data.label}</span>
        {isDelayed && (
          <span className="text-[8px] text-red-400 mt-0.5">{data.metrics.delayDays}d delay</span>
        )}
      </div>
    </div>
  );
}
