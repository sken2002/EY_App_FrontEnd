import { SpiderNode, DimensionKey } from '@/lib/types';
import { useMemo } from 'react';
import { Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface MacroHeatmapProps {
  nodes: SpiderNode[];
  onSelectWorkstream: (workstream: string) => void;
}

export function MacroHeatmap({ nodes, onSelectWorkstream }: MacroHeatmapProps) {
  // Group Work Packages by Workstream (subtitle)
  const workstreams = useMemo(() => {
    const wps = nodes.filter(n => n.type === 'workPackage');
    const grouped = wps.reduce((acc, wp) => {
      // e.g. "IT Systems · Remote" -> split by '·' and take first part
      const workstreamName = wp.data.subtitle?.split('·')[0]?.trim() || 'Uncategorized';
      if (!acc[workstreamName]) acc[workstreamName] = { name: workstreamName, nodes: [], highRiskCount: 0, totalRiskScore: 0 };
      acc[workstreamName].nodes.push(wp);
      acc[workstreamName].totalRiskScore += (wp.data.riskScore || 0);
      if (wp.data.severity === 'critical' || wp.data.severity === 'high') {
        acc[workstreamName].highRiskCount++;
      }
      return acc;
    }, {} as Record<string, { name: string, nodes: SpiderNode[], highRiskCount: number, totalRiskScore: number }>);

    // Convert to array and calculate average risk, sort by highRiskCount desc
    return Object.values(grouped).map(w => ({
      ...w,
      avgRiskScore: Math.round(w.totalRiskScore / w.nodes.length)
    })).sort((a, b) => b.highRiskCount - a.highRiskCount || b.avgRiskScore - a.avgRiskScore);
  }, [nodes]);

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-8 relative z-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Global Portfolio Heatmap</h2>
        <p className="text-gray-400">Identify structural weaknesses across major project workstreams before drilling down.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workstreams.map((ws, idx) => (
          <motion.div
            key={ws.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onSelectWorkstream(ws.name)}
            className="flex flex-col bg-[#161620] border border-white/5 rounded-xl p-5 hover:border-emerald-500/50 hover:bg-[#1a1a24] cursor-pointer transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors">{ws.name}</h3>
              <div className={`px-2 py-1 rounded text-xs font-bold ${ws.highRiskCount > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {ws.avgRiskScore}/100 Avg CRI
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-auto">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total WPs</span>
                <div className="flex items-center gap-1.5 text-gray-300">
                  <Activity size={14} className="text-blue-400" />
                  <span className="font-mono">{ws.nodes.length}</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">At Risk</span>
                <div className="flex items-center gap-1.5 text-gray-300">
                  {ws.highRiskCount > 0 ? (
                    <ShieldAlert size={14} className="text-rose-400" />
                  ) : (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  )}
                  <span className={`font-mono ${ws.highRiskCount > 0 ? 'text-rose-400 font-bold' : ''}`}>
                    {ws.highRiskCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Heatmap Bar */}
            <div className="w-full h-1.5 bg-white/5 rounded-full mt-4 overflow-hidden flex">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`h-full flex-1 border-r border-black/20 ${i < Math.round(ws.avgRiskScore / 10) ? (ws.avgRiskScore > 60 ? 'bg-rose-500' : ws.avgRiskScore > 40 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-transparent'}`} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
