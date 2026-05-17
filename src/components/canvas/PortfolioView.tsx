'use client';

import { motion } from 'framer-motion';
import { RiskIndex, DimensionRiskIndex, DimensionKey } from '@/lib/types';
import { Clock, DollarSign, ShoppingCart, ChevronRight, AlertTriangle, Activity, Banknote, Shield } from 'lucide-react';

interface PortfolioViewProps {
  riskIndex: RiskIndex;
  onPillarClick: (pillar: DimensionKey) => void;
  nodeCount: number;
}

const DIM_CONFIG: Record<DimensionKey, { icon: any; gradient: string; glow: string; accent: string }> = {
  costFinancial: {
    icon: DollarSign,
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    glow: 'shadow-amber-500/20',
    accent: 'text-amber-400',
  },
  cashflow: {
    icon: Banknote,
    gradient: 'from-cyan-500/20 via-teal-500/10 to-transparent',
    glow: 'shadow-cyan-500/20',
    accent: 'text-cyan-400',
  },
  schedule: {
    icon: Clock,
    gradient: 'from-red-500/20 via-orange-500/10 to-transparent',
    glow: 'shadow-red-500/20',
    accent: 'text-red-400',
  },
  operational: {
    icon: Activity,
    gradient: 'from-fuchsia-500/20 via-pink-500/10 to-transparent',
    glow: 'shadow-fuchsia-500/20',
    accent: 'text-fuchsia-400',
  },
  supplier: {
    icon: ShoppingCart,
    gradient: 'from-violet-500/20 via-purple-500/10 to-transparent',
    glow: 'shadow-violet-500/20',
    accent: 'text-violet-400',
  },
};

const DIM_KEYS: DimensionKey[] = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];

export function PortfolioView({ riskIndex, onPillarClick, nodeCount }: PortfolioViewProps) {
  const cri = riskIndex.compositeRiskIndex;
  const dq = riskIndex.dataQuality;
  const criColor = cri.severity === 'critical' ? 'text-red-400' : cri.severity === 'high' ? 'text-orange-400' : 'text-emerald-400';
  const overallSeverity = cri.severity === 'critical' ? 'Critical' : cri.severity === 'high' ? 'Elevated' : 'Stable';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex h-full flex-col items-center justify-center px-8 overflow-y-auto"
    >
      {/* Portfolio Title + CRI */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 text-center"
      >
        <p className="text-sm font-medium uppercase tracking-widest text-gray-500 mb-2">Composite Risk Index</p>
        <h2 className="text-5xl font-bold tracking-tight">
          <span className={criColor}>
            {cri.weightedScore.toFixed(0)}
          </span>
          <span className="text-2xl text-gray-500 ml-2">/ 100</span>
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {nodeCount} Work Packages across 6 risk dimensions · 
          <span className="ml-1">
            <Shield size={12} className="inline text-blue-400 mr-1" />
            {(dq.confidenceModifier * 100).toFixed(0)}% data confidence
          </span>
        </p>
      </motion.div>

      {/* Dimension Cards — 2 rows */}
      <div className="grid grid-cols-3 gap-4 max-w-5xl w-full mb-4">
        {DIM_KEYS.slice(0, 3).map((key, idx) => (
          <DimensionCard key={key} dimKey={key} data={riskIndex[key]} idx={idx} onPillarClick={onPillarClick} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-[680px] w-full">
        {DIM_KEYS.slice(3).map((key, idx) => (
          <DimensionCard key={key} dimKey={key} data={riskIndex[key]} idx={idx + 3} onPillarClick={onPillarClick} />
        ))}
      </div>
    </motion.div>
  );
}

function DimensionCard({ dimKey, data, idx, onPillarClick }: { 
  dimKey: DimensionKey; data: DimensionRiskIndex; idx: number; onPillarClick: (k: DimensionKey) => void 
}) {
  const config = DIM_CONFIG[dimKey];
  const Icon = config.icon;
  const isCritical = data.severity === 'critical';

  return (
    <motion.button
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + idx * 0.08, duration: 0.5 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onPillarClick(dimKey)}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111116] p-5 text-left shadow-2xl transition-all hover:border-white/20 ${config.glow}`}
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
      
      {isCritical && (
        <div className="absolute -top-1 -right-1">
          <span className="relative flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60"></span>
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500"></span>
          </span>
        </div>
      )}

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ${config.accent}`}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{data.label}</h3>
            <p className="text-[10px] text-gray-500">{(data.weight * 100).toFixed(0)}% weight · {data.severity}</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-end gap-2 mb-2">
            <span className={`text-3xl font-bold tabular-nums ${config.accent}`}>
              {data.score.toFixed(0)}
            </span>
            <span className="text-xs text-gray-500 mb-1">/ 100</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${data.score}%` }}
              transition={{ delay: 0.3 + idx * 0.08, duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                isCritical ? 'bg-gradient-to-r from-red-600 to-red-400' : 
                data.severity === 'high' ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
                'bg-gradient-to-r from-emerald-600 to-emerald-400'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {data.breakdown.high > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5">
              <AlertTriangle size={9} className="text-red-400" />
              <span className="text-[10px] font-bold text-red-400">{data.breakdown.high}</span>
              <span className="text-[9px] text-red-400/60">H</span>
            </div>
          )}
          {data.breakdown.medium > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5">
              <span className="text-[10px] font-bold text-orange-400">{data.breakdown.medium}</span>
              <span className="text-[9px] text-orange-400/60">M</span>
            </div>
          )}
          {data.breakdown.low > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5">
              <span className="text-[10px] font-bold text-emerald-400">{data.breakdown.low}</span>
              <span className="text-[9px] text-emerald-400/60">L</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400 group-hover:text-white transition-colors">
          <span>Drill into sources</span>
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </motion.button>
  );
}
