'use client';

import React, { useMemo, useState, Fragment } from 'react';
import { motion } from 'framer-motion';
import { SpiderNode, DimensionKey, RiskIndex } from '@/lib/types';
import { Users, ArrowUpDown, ChevronDown, ChevronRight, ArrowUpRight, AlertTriangle, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PortfolioViewProps {
  nodes: SpiderNode[];
  riskIndex: RiskIndex;
  onPillarClick: (pillar: DimensionKey) => void;
  onEntityClick: (entityId: string) => void;
}

const DIM_KEYS: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];
const DIM_LABELS: Record<DimensionKey, string> = {
  costFinancial: 'Cost',
  cashflow: 'Cashflow',
  schedule: 'Schedule',
  operational: 'Ops',
  supplier: 'Supplier'
};

// CHANGED (Avery): map each pillar to its corresponding trend metric key in WP.trends
// Supplier has no clean trend metric in current state.json — intentionally absent (honest, not faked).
const PILLAR_TREND_KEY: Partial<Record<DimensionKey, string>> = {
  costFinancial: 'cpi',
  cashflow: 'cashflow',
  schedule: 'spi',
  operational: 'backlog',
};

// CHANGED (Avery #13): natural sort helper so PM-2 sorts before PM-10
function naturalPmKey(name: string): number {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

// CHANGED (Avery #5): format big budget numbers compactly
function formatBudget(n: number): string {
  if (!n || n <= 0) return '—';
  if (n >= 1_000_000_000) return `£${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${Math.round(n)}`;
}

// CHANGED (Avery #2): aggregate trend direction across a PM's WPs by majority vote
type TrendDir = 'improving' | 'declining' | 'stable' | null;
function majorityTrend(wps: any[], metricKey: string): TrendDir {
  const counts = { improving: 0, declining: 0, stable: 0 };
  wps.forEach(wp => {
    const dir = wp.data.trends?.[metricKey];
    if (dir === 'improving' || dir === 'declining' || dir === 'stable') counts[dir]++;
  });
  const total = counts.improving + counts.declining + counts.stable;
  if (total === 0) return null;
  if (counts.improving > counts.declining && counts.improving > counts.stable) return 'improving';
  if (counts.declining > counts.improving && counts.declining > counts.stable) return 'declining';
  return 'stable';
}

// Small inline arrow for the per-cell trend indicator
function TrendArrow({ dir }: { dir: TrendDir }) {
  if (dir === 'improving') return <TrendingDown size={9} className="text-emerald-400" />;
  if (dir === 'declining') return <TrendingUp size={9} className="text-rose-400" />;
  if (dir === 'stable') return <Minus size={9} className="text-gray-500" />;
  return null;
}

export function PortfolioView({ nodes, onPillarClick, onEntityClick }: PortfolioViewProps) {
  // CHANGED (Avery #6): default sort changed to natural PM order; can still sort by CRI etc.
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'cri', direction: 'desc' });
  const [expandedPm, setExpandedPm] = useState<string | null>(null);

  // Group WPs by PM and pre-compute everything we need per PM
  const pmData = useMemo(() => {
    const wps = nodes.filter(n => n.type === 'workPackage');
    const grouped = wps.reduce((acc, wp) => {
      const pm = wp.data.owner || 'Unassigned';
      if (!acc[pm]) {
        acc[pm] = {
          name: pm,
          wps: [],
          criTotal: 0,
          // CHANGED (Avery #3): use real 0-100 dimension scores instead of H/M/L → 3/2/1.
          dimScoreSum: { costFinancial: 0, cashflow: 0, schedule: 0, operational: 0, supplier: 0 } as Record<DimensionKey, number>,
        };
      }
      acc[pm].wps.push(wp);
      acc[pm].criTotal += (wp.data.riskScore || 0);

      DIM_KEYS.forEach(k => {
        const score = wp.data.dimensions?.[k]?.score ?? 0;
        acc[pm].dimScoreSum[k] += score;
      });

      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map((g: any) => {
      const count = g.wps.length;

      // PM aggregation values (already present from prior pass)
      let highestWp: any = null;
      let topScore = -1;
      g.wps.forEach((wp: any) => {
        const s = wp.data.riskScore || 0;
        if (s > topScore) { topScore = s; highestWp = wp; }
      });

      // CHANGED (Avery #3): per-pillar /10 score = avg of real 0-100 dim scores / 10
      const dims: Record<DimensionKey, number> = {} as any;
      DIM_KEYS.forEach(k => { dims[k] = (g.dimScoreSum[k] / count) / 10; });

      // Primary risk driver = dimension with highest avg score
      let primaryDriver: DimensionKey = 'costFinancial';
      let driverScore = -1;
      DIM_KEYS.forEach(k => {
        if (dims[k] > driverScore) { driverScore = dims[k]; primaryDriver = k; }
      });

      // CHANGED (Avery #5): total planned budget across PM's WPs
      const totalBudget = g.wps.reduce((s: number, wp: any) => s + (wp.data.metrics?.plannedCost || 0), 0);

      // CHANGED (Avery #2): per-pillar trend direction (majority vote across PM's WPs)
      const trendByPillar: Partial<Record<DimensionKey, TrendDir>> = {};
      DIM_KEYS.forEach(k => {
        const metricKey = PILLAR_TREND_KEY[k];
        trendByPillar[k] = metricKey ? majorityTrend(g.wps, metricKey) : null;
      });

      return {
        name: g.name,
        wpCount: count,
        wps: g.wps,
        avgCri: Math.round(g.criTotal / count),
        dims,
        trendByPillar,
        highestWp,
        primaryDriver,
        totalBudget,
      };
    });
  }, [nodes]);

  // CHANGED (Avery #13 + #6): natural PM sort, support all sortable columns including budget
  const sortedData = useMemo(() => {
    return [...pmData].sort((a, b) => {
      if (sortConfig.key === 'name') {
        const aN = naturalPmKey(a.name);
        const bN = naturalPmKey(b.name);
        return sortConfig.direction === 'asc' ? aN - bN : bN - aN;
      }
      let aVal: number;
      let bVal: number;
      switch (sortConfig.key) {
        case 'wps':    aVal = a.wpCount;     bVal = b.wpCount;     break;
        case 'budget': aVal = a.totalBudget; bVal = b.totalBudget; break;
        case 'cost':       aVal = a.dims.costFinancial; bVal = b.dims.costFinancial; break;
        case 'cashflow':   aVal = a.dims.cashflow;      bVal = b.dims.cashflow;      break;
        case 'schedule':   aVal = a.dims.schedule;      bVal = b.dims.schedule;      break;
        case 'operational':aVal = a.dims.operational;   bVal = b.dims.operational;   break;
        case 'supplier':   aVal = a.dims.supplier;      bVal = b.dims.supplier;      break;
        default:           aVal = a.avgCri;             bVal = b.avgCri;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pmData, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // CHANGED (Avery #3): /10 thresholds adjusted from /3 thresholds.
  // Old: >=2.5 red, >=1.8 amber, else green. New /10: >=6.5 red, >=4.0 amber, else green.
  const getHeatmapColor = (score: number) => {
    if (score >= 6.5) return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    if (score >= 4.0) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex h-full flex-col p-8 overflow-y-auto w-full max-w-6xl mx-auto"
    >
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
            <Users size={20} className="text-emerald-400" />
            Project Manager Scorecard
          </h2>
          <p className="text-sm text-gray-400">Rankings based on Composite Risk Index and Pillar severities (scores on /10 scale).</p>
        </div>
      </div>

      {/* CHANGED (Avery #4): scroll container so no rows hide behind layout */}
      <div className="bg-[#111116] border border-white/10 rounded-xl overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#161620] z-10">
              <tr className="border-b border-white/10">
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('name')}>
                  <div className="flex items-center gap-1">Manager <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('wps')}>
                  <div className="flex items-center gap-1">WPs <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-emerald-400 uppercase tracking-wider cursor-pointer hover:text-emerald-300" onClick={() => requestSort('cri')}>
                  <div className="flex items-center gap-1">Avg CRI <ArrowUpDown size={12} /></div>
                </th>
                {/* CHANGED (Avery #5): new Budget column, sortable */}
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('budget')}>
                  <div className="flex items-center gap-1">Budget <ArrowUpDown size={12} /></div>
                </th>
                {DIM_KEYS.map(k => (
                  <th key={k} className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-gray-300" onClick={() => requestSort(k)}>
                    <div className="flex items-center justify-center gap-1">{DIM_LABELS[k]} <ArrowUpDown size={10} /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((pm) => (
                <Fragment key={pm.name}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setExpandedPm(expandedPm === pm.name ? null : pm.name)}
                  >
                    <td className="p-4 text-sm font-medium text-gray-200 flex items-center gap-2">
                      {expandedPm === pm.name ? <ChevronDown size={14} className="text-gray-500"/> : <ChevronRight size={14} className="text-gray-500"/>}
                      {pm.name}
                    </td>
                    <td className="p-4 text-sm text-gray-400 font-mono">{pm.wpCount}</td>
                    <td className="p-4">
                      <div className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${
                        pm.avgCri > 65 ? 'bg-rose-500/20 text-rose-400' : pm.avgCri > 40 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {pm.avgCri}
                      </div>
                    </td>
                    {/* CHANGED (Avery #5): Budget cell */}
                    <td className="p-4 text-sm text-gray-200 font-mono tabular-nums">{formatBudget(pm.totalBudget)}</td>
                    {DIM_KEYS.map(k => (
                      <td key={k} className="p-4 text-center">
                        {/* CHANGED (Avery #3): score now on /10 scale; (Avery #2): tiny trend arrow under the cell */}
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <div className={`inline-flex h-6 w-14 items-center justify-center rounded border text-[11px] font-bold tabular-nums ${getHeatmapColor(pm.dims[k])}`}>
                            {pm.dims[k].toFixed(1)} <span className="text-gray-500 ml-0.5">/10</span>
                          </div>
                          <TrendArrow dir={pm.trendByPillar[k] ?? null} />
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Expanded Row showing Work Packages */}
                  {expandedPm === pm.name && (
                    <tr className="bg-black/40 border-b border-white/10">
                      <td colSpan={4 + DIM_KEYS.length} className="p-4">
                        <div className="pl-6 py-2 space-y-4">

                          {pm.highestWp && (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                              <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-3 font-semibold">{pm.name} Portfolio Summary</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <p className="text-gray-500 mb-1">Managed work packages</p>
                                  <p className="text-white font-semibold tabular-nums">{pm.wpCount}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 mb-1 flex items-center gap-1"><AlertTriangle size={10} className="text-rose-400"/> Highest-risk WP</p>
                                  <p className="text-white font-semibold truncate" title={pm.highestWp.data.label}>{pm.highestWp.data.label}</p>
                                  <p className="text-rose-400 tabular-nums">CRI {Math.round(pm.highestWp.data.riskScore || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 mb-1 flex items-center gap-1"><Target size={10} className="text-amber-400"/> Primary risk driver</p>
                                  <p className="text-amber-400 font-semibold">{DIM_LABELS[pm.primaryDriver]}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 mb-1">Affected budget</p>
                                  <p className="text-white font-semibold tabular-nums">{formatBudget(pm.totalBudget)}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <h4 className="text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-wider">Managed Work Packages</h4>
                          <div className="grid grid-cols-1 gap-2">
                            {pm.wps.map((wp: any) => (
                              <div key={wp.id} className="flex items-center justify-between bg-[#1a1a24] p-3 rounded border border-white/5 hover:border-white/20 transition-colors relative">
                                <div className="flex flex-col">
                                  <span className="text-sm text-white font-medium">{wp.data.label}</span>
                                  <span className="text-xs text-gray-400">{wp.data.subtitle}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className={`px-2 py-1 rounded text-xs font-bold ${
                                    (wp.data.riskScore || 0) > 65 ? 'bg-rose-500/20 text-rose-400' : (wp.data.riskScore || 0) > 40 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                                  }`}>
                                    CRI: {Math.round(wp.data.riskScore || 0)}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onEntityClick(wp.id); }}
                                    className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                    title="Analyze in graph"
                                    aria-label="Analyze in graph"
                                  >
                                    <ArrowUpRight size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TODO (Avery #7): Per-PM Blast Radius column (# downstream WPs + financial exposure + # dependencies).
          Skipped this pass because no blastRadius field exists on WP.data in current state.json.
          Needs Eshwar's blast-radius engine to expose per-PM aggregates in the pipeline output. */}
    </motion.div>
  );
}