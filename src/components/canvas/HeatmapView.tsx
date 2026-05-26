'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SpiderNode, DimensionKey } from '@/lib/types';
import { ArrowUpDown, Users } from 'lucide-react';

interface HeatmapViewProps {
  nodes: SpiderNode[];
  onEntityClick?: (entityId: string) => void;
}

const DIM_KEYS: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];

const DIM_LABELS: Record<DimensionKey, string> = {
  costFinancial: 'Cost',
  cashflow: 'Cashflow',
  schedule: 'Schedule',
  operational: 'Operational',
  supplier: 'Supplier',
};

type SortKey = DimensionKey | 'total' | 'wpCount';

interface PMRow {
  pm: string;
  scores: Record<DimensionKey, number>;
  total: number;
  wpCount: number;
}

function cellClasses(score: number): string {
  if (score >= 65) return 'bg-red-500/85 text-red-50';
  if (score >= 40) return 'bg-orange-500/80 text-orange-50';
  return 'bg-emerald-500/75 text-emerald-50';
}

export function HeatmapView({ nodes, onEntityClick }: HeatmapViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total');

  const rows = useMemo<PMRow[]>(() => {
    const wps = nodes.filter(n => n.type === 'workPackage' && n.data.owner);

    const byPM = new Map<string, SpiderNode[]>();
    wps.forEach(n => {
      const pm = n.data.owner as string;
      if (!byPM.has(pm)) byPM.set(pm, []);
      byPM.get(pm)!.push(n);
    });

    const result: PMRow[] = [];
    byPM.forEach((pmWps, pm) => {
      const scores = {} as Record<DimensionKey, number>;
      DIM_KEYS.forEach(dk => {
        const vals = pmWps
          .map(n => n.data.dimensions?.[dk]?.score)
          .filter((v): v is number => typeof v === 'number');
        scores[dk] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      });
      const total = Math.round(DIM_KEYS.reduce((s, dk) => s + scores[dk], 0) / DIM_KEYS.length);
      result.push({ pm, scores, total, wpCount: pmWps.length });
    });

    return result;
  }, [nodes]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === 'total') return b.total - a.total;
      if (sortKey === 'wpCount') return b.wpCount - a.wpCount;
      return b.scores[sortKey] - a.scores[sortKey];
    });
    return copy;
  }, [rows, sortKey]);

  const worstPM = sortedRows.length ? [...rows].sort((a, b) => b.total - a.total)[0] : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex h-full flex-col px-8 py-6 overflow-y-auto"
    >
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users size={18} className="text-violet-400" />
          <h2 className="text-xl font-bold text-white">Project Manager Risk Heatmap</h2>
        </div>
        <p className="text-sm text-gray-500">
          Average risk score by PM across 5 dimensions · {rows.length} managers · {rows.reduce((s, r) => s + r.wpCount, 0)} work packages
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <ArrowUpDown size={14} className="text-gray-500" />
        <span className="text-xs text-gray-400">Sort by</span>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-white/10 bg-[#111116] px-3 py-1.5 text-xs text-white outline-none hover:border-white/20 focus:border-violet-500/50"
        >
          <option value="total">Total risk (worst first)</option>
          {DIM_KEYS.map(dk => (
            <option key={dk} value={dk}>{DIM_LABELS[dk]}</option>
          ))}
          <option value="wpCount">WP count</option>
        </select>
        {worstPM && (
          <span className="ml-auto text-xs text-gray-500">
            Highest risk: <span className="font-semibold text-red-400">{worstPM.pm}</span> ({worstPM.total})
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#111116] p-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            className="grid items-center gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '80px repeat(5, 1fr) 72px 56px' }}
          >
            <div className="text-[11px] uppercase tracking-wider text-gray-500">PM</div>
            {DIM_KEYS.map(dk => (
              <div key={dk} className="text-center text-[11px] uppercase tracking-wider text-gray-500">
                {DIM_LABELS[dk]}
              </div>
            ))}
            <div className="text-center text-[11px] uppercase tracking-wider font-semibold text-gray-400">Total</div>
            <div className="text-center text-[11px] uppercase tracking-wider text-gray-500">WPs</div>
          </div>

          {sortedRows.map((row, idx) => (
            <motion.div
              key={row.pm}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="grid items-center gap-2 mb-2 px-1"
              style={{ gridTemplateColumns: '80px repeat(5, 1fr) 72px 56px' }}
            >
              <div className="text-sm font-medium text-white">{row.pm}</div>
              {DIM_KEYS.map(dk => (
                <div
                  key={dk}
                  className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold tabular-nums ${cellClasses(row.scores[dk])}`}
                  title={`${row.pm} · ${DIM_LABELS[dk]}: ${row.scores[dk]}`}
                >
                  {row.scores[dk]}
                </div>
              ))}
              <div
                className={`flex h-10 items-center justify-center rounded-lg text-sm font-bold tabular-nums ring-1 ring-white/20 ${cellClasses(row.total)}`}
              >
                {row.total}
              </div>
              <div className="text-center text-xs text-gray-500 tabular-nums">{row.wpCount}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-5 text-xs text-gray-500">
        <span>Risk score</span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded bg-emerald-500/75" /> Low (0–39)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded bg-orange-500/80" /> Medium (40–64)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded bg-red-500/85" /> High (65–100)
        </span>
      </div>
    </motion.div>
  );
}