import { RiskIndex, DimensionKey } from '@/lib/types';
import { RiskDimensionCard } from '../risk-index/RiskDimensionCard';
import { Shield } from 'lucide-react';

interface LeftPanelProps {
  riskIndex: RiskIndex;
  activePillar: DimensionKey | null;
  onPillarClick: (pillar: DimensionKey) => void;
}

const DIMENSION_KEYS: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];

export function LeftPanel({ riskIndex, activePillar, onPillarClick }: LeftPanelProps) {
  const cri = riskIndex.compositeRiskIndex;
  const dq = riskIndex.dataQuality;
  
  const color = cri.severity === 'critical' ? 'text-red-500' : cri.severity === 'high' ? 'text-orange-500' : 'text-emerald-500';
  const severityLabel = cri.severity === 'critical' ? 'Critical' : cri.severity === 'high' ? 'High' : 'Medium';

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-white/10 bg-[#0f0f15] overflow-y-auto">
      {/* CRI Header */}
      <div className="border-b border-white/10 p-5">
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
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Shield size={14} className="text-blue-400" />
          <div className="flex-1">
            <div className="text-xs text-gray-400">Data Confidence</div>
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
      <div className="flex flex-col gap-4 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Control Center</h3>
        
        {/* Watchlist Section */}
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-500 mb-1">My Watchlist</div>
          {['WP-014 (Civil)', 'WP-042 (IT Deploy)'].map((wp) => (
            <div key={wp} className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">
              <Shield size={12} className="text-rose-400" />
              <span className="text-xs text-gray-300">{wp}</span>
            </div>
          ))}
        </div>

        {/* Filters Section */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="text-xs text-gray-500 mb-1">Global Filters</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-emerald-500" />
            <span className="text-xs text-gray-300">Show Critical Risks Only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" className="accent-emerald-500" />
            <span className="text-xs text-gray-300">Show Financial &gt; £1M Exposure</span>
          </label>
        </div>

        {/* Persona Toggle */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="text-xs text-gray-500 mb-1">Active Persona</div>
          <select className="bg-[#0f0f15] border border-white/10 text-xs text-gray-300 rounded p-1.5 focus:outline-none">
            <option className="bg-[#0f0f15] text-white">Global Executive</option>
            <option className="bg-[#0f0f15] text-white">Project Manager (IT)</option>
            <option className="bg-[#0f0f15] text-white">Risk Auditor</option>
          </select>
        </div>
      </div>
    </aside>
  );
}
