import { SpiderNode } from '@/lib/types';
import { Package, ShieldAlert } from 'lucide-react';

interface AllWorkPackagesProps {
  nodes: SpiderNode[];
  onNodeSelect: (id: string) => void;
}

export function AllWorkPackages({ nodes, onNodeSelect }: AllWorkPackagesProps) {
  const workPackages = nodes.filter(n => n.type === 'workPackage');

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#18181b]/50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">Work Package Inventory</h2>
          <p className="text-sm text-gray-400 mt-2">A complete overview of all managed work packages across the portfolio.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workPackages.map(wp => {
            const hasIssues = wp.data.riskScore && wp.data.riskScore > 60;
            return (
              <div 
                key={wp.id}
                onClick={() => onNodeSelect(wp.id)}
                className="group p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 cursor-pointer transition-all flex flex-col gap-4 relative overflow-hidden"
              >
                {hasIssues && (
                  <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                    <div className="absolute top-2 -right-6 w-24 bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider text-center py-1 rotate-45 border-y border-rose-500/30">
                      Flagged
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${hasIssues ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    <Package size={18} />
                  </div>
                  <div className="flex-1 truncate">
                    <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors truncate">{wp.data.label}</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{wp.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-white/5">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Budget</div>
                    <div className="text-xs font-medium text-gray-300">
                      £{((wp.data.metrics?.plannedCost || 0) / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Progress</div>
                    <div className="text-xs font-medium text-gray-300">
                      {Math.round((wp.data.metrics?.completionPercentage || 0) * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
