'use client';

import { useEffect, useState } from 'react';
import { RiskIndex, DimensionKey } from '@/lib/types';
import { RiskDimensionCard } from '../risk-index/RiskDimensionCard';
import { Shield, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface LeftPanelProps {
  riskIndex: RiskIndex;
  activePillar: DimensionKey | null;
  onPillarClick: (pillar: DimensionKey) => void;
}

const DIMENSION_KEYS: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];

// CHANGED (Avery): compute portfolio-level CRI delta vs the previous month from history.json.
// Average all WP CRIs for the most recent and prior month, subtract. Real data, no fabrication.
function useCriMonthDelta(): { delta: number | null; loading: boolean } {
  const [delta, setDelta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/history.json')
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, { month: string; cri: number }[]> | null) => {
        if (cancelled || !data) { setLoading(false); return; }
        // Find the two most recent distinct months across all WPs
        const months = new Set<string>();
        Object.values(data).forEach(series => series.forEach(p => months.add(p.month)));
        const sorted = Array.from(months).sort();
        if (sorted.length < 2) { setLoading(false); return; }
        const cur = sorted[sorted.length - 1];
        const prev = sorted[sorted.length - 2];
        // Average CRI across WPs for each month
        const avg = (m: string) => {
          const vals: number[] = [];
          Object.values(data).forEach(series => {
            const point = series.find(p => p.month === m);
            if (point && typeof point.cri === 'number') vals.push(point.cri);
          });
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        };
        const curAvg = avg(cur);
        const prevAvg = avg(prev);
        if (curAvg !== null && prevAvg !== null) {
          setDelta(Math.round(curAvg - prevAvg));
        }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { delta, loading };
}

export function LeftPanel({ riskIndex, activePillar, onPillarClick }: LeftPanelProps) {
  const cri = riskIndex.compositeRiskIndex;
  const dq = riskIndex.dataQuality;

  const color = cri.severity === 'critical' ? 'text-red-500' : cri.severity === 'high' ? 'text-orange-500' : 'text-emerald-500';
  // CHANGED (Avery): severity label is just the word (High / Medium / Critical), no "Posture" suffix
  const severityLabel = cri.severity === 'critical' ? 'Critical' : cri.severity === 'high' ? 'High' : 'Medium';

  const { delta, loading: deltaLoading } = useCriMonthDelta();

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-white/10 bg-[#0f0f15] overflow-y-auto">
      {/* CRI Header */}
      <div className="border-b border-white/10 p-5">
        {/* CHANGED (Avery): renamed from "Composite Risk Index" to "Portfolio Composite Risk Index (CRI)" to disambiguate from per-WP CRI */}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Portfolio Composite Risk Index (CRI)</h2>
        <div className="mt-3 flex items-end gap-3">
          <div className={`text-4xl font-bold tracking-tight ${color}`}>
            {cri.weightedScore.toFixed(0)}
          </div>
          <div className="mb-1 text-sm font-medium text-gray-400">/ 100</div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${cri.severity === 'critical' ? 'bg-red-500' : cri.severity === 'high' ? 'bg-orange-500' : 'bg-emerald-500'} animate-pulse`} />
          <span className="text-sm font-medium text-white">{severityLabel}</span>
        </div>

        {/* CHANGED (Avery): month-over-month CRI delta line. Higher CRI = worse, so positive delta is red ↑, negative is green ↓.
            Computed from real history.json data, not hard-coded. */}
        {!deltaLoading && delta !== null && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {delta > 0 ? (
              <>
                <TrendingUp size={12} className="text-red-400" />
                <span className="text-red-400 font-medium">+{delta}</span>
              </>
            ) : delta < 0 ? (
              <>
                <TrendingDown size={12} className="text-emerald-400" />
                <span className="text-emerald-400 font-medium">{delta}</span>
              </>
            ) : (
              <>
                <Minus size={12} className="text-gray-400" />
                <span className="text-gray-400 font-medium">0</span>
              </>
            )}
            <span className="text-gray-500">vs last month</span>
          </div>
        )}

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
          <select className="bg-black/20 border border-white/10 text-xs text-gray-300 rounded p-1.5 focus:outline-none">
            <option>Global Executive</option>
            <option>Project Manager (IT)</option>
            <option>Risk Auditor</option>
          </select>
        </div>
      </div>
    </aside>
  );
}