'use client';

import { motion } from 'framer-motion';
import { PillarRisk } from '@/lib/types';
import { PillarKey } from '@/app/page';
import { Clock, DollarSign, ShoppingCart, ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react';

interface PortfolioViewProps {
  riskIndex: { delivery: PillarRisk; cost: PillarRisk; supplier: PillarRisk };
  onPillarClick: (pillar: PillarKey) => void;
  nodeCount: number;
}

const PILLAR_CONFIG: Record<PillarKey, { icon: any; gradient: string; glow: string; accent: string }> = {
  delivery: {
    icon: Clock,
    gradient: 'from-red-500/20 via-orange-500/10 to-transparent',
    glow: 'shadow-red-500/20',
    accent: 'text-red-400',
  },
  cost: {
    icon: DollarSign,
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    glow: 'shadow-amber-500/20',
    accent: 'text-amber-400',
  },
  supplier: {
    icon: ShoppingCart,
    gradient: 'from-violet-500/20 via-purple-500/10 to-transparent',
    glow: 'shadow-violet-500/20',
    accent: 'text-violet-400',
  },
};

export function PortfolioView({ riskIndex, onPillarClick, nodeCount }: PortfolioViewProps) {
  const pillars: { key: PillarKey; data: PillarRisk }[] = [
    { key: 'delivery', data: riskIndex.delivery },
    { key: 'cost', data: riskIndex.cost },
    { key: 'supplier', data: riskIndex.supplier },
  ];

  // Overall portfolio severity
  const maxScore = Math.max(...pillars.map(p => p.data.overallScore));
  const overallSeverity = maxScore >= 0.65 ? 'Critical' : maxScore >= 0.45 ? 'Elevated' : 'Stable';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex h-full flex-col items-center justify-center px-12"
    >
      {/* Portfolio Title */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-12 text-center"
      >
        <p className="text-sm font-medium uppercase tracking-widest text-gray-500 mb-2">Portfolio Risk Posture</p>
        <h2 className="text-5xl font-bold tracking-tight">
          <span className={maxScore >= 0.65 ? 'text-red-400' : maxScore >= 0.45 ? 'text-orange-400' : 'text-emerald-400'}>
            {overallSeverity}
          </span>
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          {nodeCount} Work Packages across 3 risk dimensions · Click a pillar to drill down
        </p>
      </motion.div>

      {/* Pillar Cards */}
      <div className="flex gap-6 max-w-5xl w-full">
        {pillars.map(({ key, data }, idx) => {
          const config = PILLAR_CONFIG[key];
          const Icon = config.icon;
          const isCritical = data.severity === 'critical';

          return (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.1, duration: 0.5 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPillarClick(key)}
              className={`group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111116] p-6 text-left shadow-2xl transition-all hover:border-white/20 ${config.glow}`}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
              
              {/* Pulse ring for critical */}
              {isCritical && (
                <div className="absolute -top-1 -right-1">
                  <span className="relative flex h-4 w-4">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60"></span>
                    <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500"></span>
                  </span>
                </div>
              )}

              <div className="relative z-10">
                {/* Icon + Label */}
                <div className="flex items-center gap-3 mb-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ${config.accent}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{data.label}</h3>
                    <p className="text-xs text-gray-500 capitalize">{data.severity} severity</p>
                  </div>
                </div>

                {/* Score */}
                <div className="mb-5">
                  <div className="flex items-end gap-2 mb-2">
                    <span className={`text-4xl font-bold tabular-nums ${config.accent}`}>
                      {(data.overallScore * 100).toFixed(0)}
                    </span>
                    <span className="text-sm text-gray-500 mb-1">/ 100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${data.overallScore * 100}%` }}
                      transition={{ delay: 0.3 + idx * 0.1, duration: 1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        isCritical ? 'bg-gradient-to-r from-red-600 to-red-400' : 
                        data.severity === 'high' ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
                        'bg-gradient-to-r from-emerald-600 to-emerald-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Breakdown badges */}
                <div className="flex items-center gap-2 mb-4">
                  {data.breakdown.high > 0 && (
                    <div className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1">
                      <AlertTriangle size={10} className="text-red-400" />
                      <span className="text-xs font-bold text-red-400">{data.breakdown.high}</span>
                      <span className="text-[10px] text-red-400/60">High</span>
                    </div>
                  )}
                  {data.breakdown.medium > 0 && (
                    <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1">
                      <span className="text-xs font-bold text-orange-400">{data.breakdown.medium}</span>
                      <span className="text-[10px] text-orange-400/60">Med</span>
                    </div>
                  )}
                  {data.breakdown.low > 0 && (
                    <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1">
                      <span className="text-xs font-bold text-emerald-400">{data.breakdown.low}</span>
                      <span className="text-[10px] text-emerald-400/60">Low</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-white transition-colors">
                  <span>Drill into sources</span>
                  <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
