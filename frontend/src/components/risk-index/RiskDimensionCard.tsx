import { DimensionRiskIndex } from '@/lib/types';
import { Clock, DollarSign, ShoppingCart, AlertCircle, Activity, Banknote, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

interface RiskDimensionCardProps {
  dimension: DimensionRiskIndex;
}

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'Clock': return <Clock size={14} />;
    case 'DollarSign': return <DollarSign size={14} />;
    case 'ShoppingCart': return <ShoppingCart size={14} />;
    case 'Activity': return <Activity size={14} />;
    case 'Banknote': return <Banknote size={14} />;
    default: return <DollarSign size={14} />;
  }
};

const TrendArrow = ({ trend }: { trend?: string }) => {
  if (!trend || trend === 'insufficient_data') return null;
  if (trend === 'improving') return <TrendingUp size={12} className="text-emerald-400" />;
  if (trend === 'declining') return <TrendingDown size={12} className="text-red-400" />;
  return <Minus size={12} className="text-gray-500" />;
};

export function RiskDimensionCard({ dimension }: RiskDimensionCardProps) {
  const isCritical = dimension.severity === 'critical';
  const isHigh = dimension.severity === 'high';
  
  const bgClass = isCritical ? 'bg-red-500/10 border-red-500/20' : 
                  isHigh ? 'bg-orange-500/10 border-orange-500/20' : 
                  'bg-white/5 border-white/10';
                  
  const textClass = isCritical ? 'text-red-500' : 
                    isHigh ? 'text-orange-500' : 
                    'text-emerald-500';

  const barColor = isCritical ? 'bg-red-500' : isHigh ? 'bg-orange-500' : 'bg-emerald-500';

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`relative cursor-pointer overflow-hidden rounded-xl border p-3.5 transition-colors ${bgClass} hover:bg-white/10`}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <div className={`rounded-md p-1 ${isCritical ? 'bg-red-500/20 text-red-400' : isHigh ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-gray-400'}`}>
            {getIcon(dimension.icon)}
          </div>
          <div>
            <span className="text-sm font-medium">{dimension.label}</span>
            <span className="ml-1.5 text-[10px] text-gray-500">{(dimension.weight * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendArrow trend={dimension.trend} />
          <div className={`text-base font-bold ${textClass}`}>
            {dimension.score.toFixed(0)}
          </div>
        </div>
      </div>

      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-black/50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${dimension.score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full ${barColor}`}
        />
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
        <div className="flex items-center gap-1.5">
          <AlertCircle size={12} className="text-gray-400" />
          <span className="text-[10px] text-gray-400">
            <span className="font-medium text-white">{dimension.activeAlerts}</span> Alerts
          </span>
        </div>
        <div className="flex gap-1">
          {dimension.breakdown.high > 0 && (
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
              {dimension.breakdown.high} H
            </span>
          )}
          {dimension.breakdown.medium > 0 && (
            <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-400">
              {dimension.breakdown.medium} M
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
