import { RiskIndex, DimensionKey } from '@/lib/types';
import { RiskDimensionCard } from '../risk-index/RiskDimensionCard';
import { Shield } from 'lucide-react';

interface LeftPanelProps {
  riskIndex: RiskIndex;
  activePillar: DimensionKey | null;
  onPillarClick: (pillar: DimensionKey) => void;
  globalFilters?: { criticalOnly: boolean; highExposure: boolean };
  setGlobalFilters?: React.Dispatch<React.SetStateAction<{ criticalOnly: boolean; highExposure: boolean }>>;
  onWatchlistClick?: (id: string) => void;
}

const DIMENSION_KEYS: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];

export function LeftPanel({ riskIndex, activePillar, onPillarClick, globalFilters, setGlobalFilters, onWatchlistClick }: LeftPanelProps) {
  const cri = riskIndex.compositeRiskIndex;
  const dq = riskIndex.dataQuality;
  
  const color = cri.severity === 'critical' ? 'text-red-500' : cri.severity === 'high' ? 'text-orange-500' : 'text-emerald-500';
  const severityLabel = cri.severity === 'critical' ? 'Critical' : cri.severity === 'high' ? 'High' : 'Medium';

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-white/5 bg-[#0a0a0f]/60 backdrop-blur-2xl overflow-y-auto">
      {/* CRI Header */}
      <div className="border-b border-white/5 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Composite Risk Index</h2>
        <div className="mt-3 flex items-end gap-3">
          <div className={`text-4xl font-bold tracking-tight ${color}`}>
            {cri.weightedScore.toFixed(0)}
          </div>
          <div className="mb-1 text-sm font-medium text-gray-400">/ 100</div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${cri.severity === 'critical' ? 'bg-red-500' : cri.severity === 'high' ? 'bg-orange-500' : 'bg-emerald-500'} animate-pulse`} />
          <span className="text-sm font-medium text-white">{severityLabel} Posture</span>
        </div>
        
        {/* Data Quality Confidence Badge */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 border border-white/5 p-3 shadow-sm">
          <Shield size={16} className="text-blue-400 opacity-80" />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Data Confidence</div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50">
                <div 
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${dq.confidenceModifier * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-blue-400">{(dq.confidenceModifier * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
        {dq.criticalIssues > 0 && (
          <div className="mt-2 text-[10px] text-orange-400">
            ⚠ {dq.totalIssues} quality issues ({dq.criticalIssues} critical)
          </div>
        )}
      </div>

      {/* 6-Dimension Risk Cards (Removed due to redundancy with PortfolioView) */}
      <div className="flex flex-col gap-6 p-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Control Center</h3>
        
        {/* Watchlist Section */}
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-500 mb-1">My Watchlist</div>
          {[
            { id: 'WP-0005', label: 'WP-0005: Documentation' },
            { id: 'WP-0001', label: 'WP-0001: Foundations' }
          ].map((wp) => (
            <div 
              key={wp.id} 
              onClick={() => onWatchlistClick && onWatchlistClick(wp.id)}
              className="group flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 cursor-pointer transition-all"
            >
              <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 group-hover:scale-110 transition-transform">
                <Shield size={12} />
              </div>
              <span className="text-xs font-medium text-gray-300 group-hover:text-white truncate transition-colors">{wp.label}</span>
            </div>
          ))}
        </div>

        {/* Filters Section */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="text-xs text-gray-500 mb-1">Global Filters</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              className="accent-emerald-500" 
              checked={globalFilters?.criticalOnly || false}
              onChange={(e) => setGlobalFilters && setGlobalFilters(prev => ({ ...prev, criticalOnly: e.target.checked }))}
            />
            <span className="text-xs text-gray-300">Show Critical Risks Only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input 
              type="checkbox" 
              className="accent-emerald-500" 
              checked={globalFilters?.highExposure || false}
              onChange={(e) => setGlobalFilters && setGlobalFilters(prev => ({ ...prev, highExposure: e.target.checked }))}
            />
            <span className="text-xs text-gray-300">Show Financial &gt; £1M Exposure</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
