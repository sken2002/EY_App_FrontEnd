import { SpiderNode } from '@/lib/types';
import { Package, ShieldAlert, Star } from 'lucide-react';

interface AllWorkPackagesProps {
  nodes: SpiderNode[];
  onNodeSelect: (id: string) => void;
  watchlist?: string[];
  setWatchlist?: (list: string[]) => void;
}

export function AllWorkPackages({ nodes, onNodeSelect, watchlist = [], setWatchlist }: AllWorkPackagesProps) {
  const workPackages = nodes.filter(n => n.type === 'workPackage');

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#18181b]/50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">Project Inventory</h2>
          <p className="text-sm text-gray-400 mt-2">A complete overview of all managed work packages across the portfolio.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workPackages.map(wp => {
            const score = wp.data.riskScore || 0;
            let iconColor = 'bg-gray-500/10 text-gray-400';
            let cardStyle = 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10';

            if (score >= 60) {
              iconColor = 'bg-rose-500/10 text-rose-400';
              cardStyle = 'border-rose-500/30 bg-white/[0.02] hover:bg-white/[0.06] hover:border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.15)]';
            } else if (score >= 40) {
              iconColor = 'bg-amber-500/10 text-amber-400';
              cardStyle = 'border-amber-500/30 bg-white/[0.02] hover:bg-white/[0.06] hover:border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.15)]';
            } else if (score > 0) {
              iconColor = 'bg-emerald-500/10 text-emerald-400';
              cardStyle = 'border-emerald-500/30 bg-white/[0.02] hover:bg-white/[0.06] hover:border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.15)]';
            }

            const isWatched = watchlist.includes(wp.id);

            return (
              <div 
                key={wp.id}
                onClick={() => onNodeSelect(wp.id)}
                className={`group p-5 rounded-xl border cursor-pointer transition-all flex flex-col gap-4 relative overflow-hidden ${cardStyle}`}
              >

                <div className="flex items-center gap-3 pr-6">
                  <div className={`p-2 rounded-lg ${iconColor}`}>
                    <Package size={18} />
                  </div>
                  <div className="flex-1 truncate">
                    <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors truncate">{wp.data.label}</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{wp.id}</p>
                  </div>
                </div>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (setWatchlist) {
                      setWatchlist(isWatched ? watchlist.filter(id => id !== wp.id) : [...watchlist, wp.id]);
                    }
                  }}
                  className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors z-10 hover:bg-white/10 ${isWatched ? 'text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <Star size={16} fill={isWatched ? 'currentColor' : 'none'} />
                </button>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-white/5">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Budget</div>
                    <div className="text-xs font-medium text-gray-300">
                      £{((wp.data.metrics?.plannedCost || 0) / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">CRI Score</div>
                    <div className={`text-xs font-bold ${score >= 60 ? 'text-rose-400' : score >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {Math.round(score)} / 100
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
