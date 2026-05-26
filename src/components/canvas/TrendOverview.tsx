'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { SpiderNode, TrendDirection } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, HelpCircle, Activity } from 'lucide-react';

interface TrendOverviewProps {
  nodes: SpiderNode[];
}

const METRICS: { key: string; label: string }[] = [
  { key: 'cpi', label: 'Cost Performance (CPI)' },
  { key: 'spi', label: 'Schedule Performance (SPI)' },
  { key: 'cashflow', label: 'Cashflow' },
  { key: 'backlog', label: 'Service Order Backlog' },
  { key: 'milestoneDelay', label: 'Milestone Delay' },
];

const DIRECTIONS: { key: TrendDirection; label: string; bar: string; text: string }[] = [
  { key: 'improving', label: 'Improving', bar: 'bg-emerald-500', text: 'text-emerald-400' },
  { key: 'stable', label: 'Stable', bar: 'bg-gray-500', text: 'text-gray-400' },
  { key: 'declining', label: 'Declining', bar: 'bg-red-500', text: 'text-red-400' },
  { key: 'insufficient_data', label: 'No data', bar: 'bg-white/10', text: 'text-gray-600' },
];

type Counts = Record<TrendDirection, number>;

function emptyCounts(): Counts {
  return { improving: 0, stable: 0, declining: 0, insufficient_data: 0 };
}

function DirectionIcon({ dir }: { dir: TrendDirection }) {
  if (dir === 'improving') return <TrendingUp size={13} className="text-emerald-400" />;
  if (dir === 'declining') return <TrendingDown size={13} className="text-red-400" />;
  if (dir === 'stable') return <Minus size={13} className="text-gray-400" />;
  return <HelpCircle size={13} className="text-gray-600" />;
}

export function TrendOverview({ nodes }: TrendOverviewProps) {
  const { rows, total, netByMetric } = useMemo(() => {
    const wps = nodes.filter(n => n.type === 'workPackage');
    const rows = METRICS.map(m => {
      const counts = emptyCounts();
      wps.forEach(n => {
        const dir = (n.data.trends?.[m.key] as TrendDirection) ?? 'insufficient_data';
        counts[dir] = (counts[dir] ?? 0) + 1;
      });
      return { ...m, counts };
    });
    const netByMetric: Record<string, number> = {};
    rows.forEach(r => { netByMetric[r.key] = r.counts.improving - r.counts.declining; });
    return { rows, total: wps.length, netByMetric };
  }, [nodes]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex h-full flex-col px-8 py-6 overflow-y-auto"
    >
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={18} className="text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Portfolio Trend Analysis</h2>
        </div>
        <p className="text-sm text-gray-500">
          Direction of movement across {total} work packages · improving vs declining per metric
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#111116] p-5 space-y-5">
        {rows.map((row, idx) => {
          const net = netByMetric[row.key];
          const netColor = net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-gray-400';
          const netLabel = net > 0 ? `+${net} net improving` : net < 0 ? `${net} net declining` : 'balanced';
          return (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-white">{row.label}</span>
                <span className={`text-xs font-medium ${netColor}`}>{netLabel}</span>
              </div>

              <div className="flex h-7 w-full overflow-hidden rounded-lg">
                {DIRECTIONS.map(d => {
                  const count = row.counts[d.key];
                  if (count === 0) return null;
                  const pct = (count / total) * 100;
                  return (
                    <div
                      key={d.key}
                      className={`flex items-center justify-center ${d.bar}`}
                      style={{ width: `${pct}%` }}
                      title={`${d.label}: ${count} WPs`}
                    >
                      {pct > 7 && (
                        <span className="text-[11px] font-semibold text-white/90">{count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-5 text-xs text-gray-500">
        {DIRECTIONS.map(d => (
          <span key={d.key} className="flex items-center gap-1.5">
            <span className={`h-3.5 w-3.5 rounded ${d.bar}`} /> {d.label}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Quick read</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          {rows.map(r => (
            <span key={r.key} className="flex items-center gap-1.5 text-xs text-gray-300">
              <DirectionIcon dir={netByMetric[r.key] > 0 ? 'improving' : netByMetric[r.key] < 0 ? 'declining' : 'stable'} />
              {r.label.replace(/ \(.*\)/, '')}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}