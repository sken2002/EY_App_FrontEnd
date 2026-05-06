import { Handle, Position } from '@xyflow/react';
import { SpiderNodeData } from '@/lib/types';
import { FileText, ShieldAlert } from 'lucide-react';

export function ContractNode({ data }: { data: SpiderNodeData & { isSelected?: boolean, isInBlast?: boolean, isTrigger?: boolean } }) {
  const isNonCompliant = data.metrics.complianceStatus === 'Non-Compliant';

  return (
    <div className={`relative flex items-center gap-3 rounded-full border bg-[#111116] p-2 pr-4 shadow-lg transition-all
      ${data.isSelected ? 'ring-2 ring-white scale-105' : ''}
      ${data.isTrigger ? 'border-red-500 shadow-red-500/20' : 
        isNonCompliant ? 'border-orange-500/50' : 'border-white/10'}`}>
      
      {data.isTrigger && (
        <div className="absolute -inset-1 -z-10 animate-pulse rounded-full bg-red-500/20 blur-sm" />
      )}

      <Handle type="source" position={Position.Right} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="target" position={Position.Left} className="!bg-white/50 !w-2 !h-2 !border-none" />

      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isNonCompliant ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-400'}`}>
        {isNonCompliant ? <ShieldAlert size={14} /> : <FileText size={14} />}
      </div>
      
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-white leading-none w-32 truncate" title={data.label}>{data.label}</span>
        <span className="text-[9px] text-gray-500 mt-0.5">{data.subtitle}</span>
      </div>
    </div>
  );
}
