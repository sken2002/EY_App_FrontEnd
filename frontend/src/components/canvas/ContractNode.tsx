import { Handle, Position } from '@xyflow/react';
import { SpiderNodeData } from '@/lib/types';
import { FileText, ShieldAlert } from 'lucide-react';

export function ContractNode({ data }: { data: SpiderNodeData & { isSelected?: boolean, isInBlast?: boolean, isTrigger?: boolean } }) {
  const isNonCompliant = data.metrics.complianceStatus === 'Non-Compliant';

  return (
    <div className={`relative flex flex-col gap-2 rounded-lg bg-[#0a0a0f]/95 p-3 min-w-[160px] border backdrop-blur shadow-xl transition-all
      ${data.isSelected ? 'ring-2 ring-white scale-105' : ''}
      ${data.isTrigger ? 'border-red-500/80 shadow-red-500/20' : 
        isNonCompliant ? 'border-orange-500/50' : 'border-blue-500/20'}`}>
      
      {data.isTrigger && (
        <div className="absolute -inset-1 -z-10 animate-pulse rounded-lg bg-red-500/20 blur-md" />
      )}

      {isNonCompliant && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg border border-orange-400">
          NON-COMPLIANT
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-white/50 !w-2 !h-2 !border-none" />
      <Handle type="target" position={Position.Left} className="!bg-white/50 !w-2 !h-2 !border-none" />

      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${isNonCompliant ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
          {isNonCompliant ? <ShieldAlert size={14} /> : <FileText size={14} />}
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Contractor</span>
          <span className="text-xs font-semibold text-white truncate" title={data.label}>{data.label}</span>
        </div>
      </div>
      
      <div className="mt-1 pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">Value at Risk</span>
        <span className="text-[10px] font-mono font-bold text-gray-200">£{(Math.random() * 2 + 0.5).toFixed(1)}M</span>
      </div>
    </div>
  );
}
