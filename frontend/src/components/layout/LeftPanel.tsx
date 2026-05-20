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

      {/* 6-Dimension Risk Cards */}
      <div className="flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-white">Risk Dimensions</h3>
        {DIMENSION_KEYS.map(key => (
          <div 
            key={key} 
            onClick={() => onPillarClick(key)}
            className={`rounded-xl transition-all cursor-pointer ${activePillar === key ? 'ring-2 ring-emerald-500' : ''}`}
          >
            <RiskDimensionCard dimension={riskIndex[key]} />
          </div>
        ))}
      </div>
    </aside>
  );
}
