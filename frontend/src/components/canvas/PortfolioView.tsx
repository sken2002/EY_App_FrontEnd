'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SpiderNode, DimensionKey, RiskIndex } from '@/lib/types';
import { Users, ArrowUpDown } from 'lucide-react';

interface PortfolioViewProps {
  nodes: SpiderNode[];
  riskIndex: RiskIndex;
  onPillarClick: (pillar: DimensionKey) => void;
}

const DIM_KEYS: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];
const DIM_LABELS: Record<DimensionKey, string> = {
  costFinancial: 'Cost',
  cashflow: 'Cashflow',
  schedule: 'Schedule',
  operational: 'Ops',
  supplier: 'Supplier'
};

export function PortfolioView({ nodes, onPillarClick }: PortfolioViewProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'cri', direction: 'desc' });

  // Group by PM
  const pmData = useMemo(() => {
    const wps = nodes.filter(n => n.type === 'workPackage');
    const grouped = wps.reduce((acc, wp) => {
      const pm = wp.data.pm || 'Unassigned';
      if (!acc[pm]) {
        acc[pm] = {
          name: pm,
          wps: [],
          criTotal: 0,
          dims: { costFinancial: 0, cashflow: 0, schedule: 0, operational: 0, supplier: 0 }
        };
      }
      acc[pm].wps.push(wp);
      acc[pm].criTotal += (wp.data.riskScore || 0);
      
      DIM_KEYS.forEach(k => {
        // We look at the dimension class to assign a rough numeric score for the heatmap, or just average the actual scores if available.
        // For simplicity, we'll map High=3, Medium=2, Low=1
        const cls = wp.data.dimensions?.[k]?.class || 'Low';
        acc[pm].dims[k] += (cls === 'High' ? 3 : cls === 'Medium' ? 2 : 1);
      });
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map(g => {
      const count = g.wps.length;
      return {
        name: g.name,
        wpCount: count,
        avgCri: Math.round(g.criTotal / count),
        dims: {
          costFinancial: g.dims.costFinancial / count,
          cashflow: g.dims.cashflow / count,
          schedule: g.dims.schedule / count,
          operational: g.dims.operational / count,
          supplier: g.dims.supplier / count,
        }
      };
    });
  }, [nodes]);

  // Sort logic
  const sortedData = useMemo(() => {
    return [...pmData].sort((a, b) => {
      let aVal = a.avgCri;
      let bVal = b.avgCri;
      if (sortConfig.key === 'name') {
        aVal = a.name; bVal = b.name;
      } else if (sortConfig.key === 'wps') {
        aVal = a.wpCount; bVal = b.wpCount;
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

  const getHeatmapColor = (score: number) => {
    if (score >= 2.5) return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    if (score >= 1.8) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
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
          <p className="text-sm text-gray-400">Rankings based on Composite Risk Index and Pillar severities.</p>
        </div>
      </div>

      <div className="bg-[#111116] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#161620] border-b border-white/10">
              <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('name')}>
                <div className="flex items-center gap-1">Manager <ArrowUpDown size={12} /></div>
              </th>
              <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('wps')}>
                <div className="flex items-center gap-1">WPs <ArrowUpDown size={12} /></div>
              </th>
              <th className="p-4 text-xs font-semibold text-emerald-400 uppercase tracking-wider cursor-pointer hover:text-emerald-300" onClick={() => requestSort('cri')}>
                <div className="flex items-center gap-1">Avg CRI <ArrowUpDown size={12} /></div>
              </th>
              {DIM_KEYS.map(k => (
                <th key={k} className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-gray-300" onClick={() => onPillarClick(k)}>
                  {DIM_LABELS[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((pm, idx) => (
              <tr key={pm.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-sm font-medium text-gray-200">{pm.name}</td>
                <td className="p-4 text-sm text-gray-400 font-mono">{pm.wpCount}</td>
                <td className="p-4">
                  <div className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${
                    pm.avgCri > 65 ? 'bg-rose-500/20 text-rose-400' : pm.avgCri > 40 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {pm.avgCri}
                  </div>
                </td>
                {DIM_KEYS.map(k => (
                  <td key={k} className="p-4 text-center">
                    <div className={`inline-flex h-6 w-12 items-center justify-center rounded border text-[10px] font-bold ${getHeatmapColor(pm.dims[k])}`}>
                      {pm.dims[k].toFixed(1)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
