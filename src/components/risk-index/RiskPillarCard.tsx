import { PillarRisk } from '@/lib/types';
import { Clock, DollarSign, ShoppingCart, AlertTriangle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface RiskPillarCardProps {
  pillar: PillarRisk;
}

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'Clock': return <Clock size={16} />;
    case 'DollarSign': return <DollarSign size={16} />;
    case 'ShoppingCart': return <ShoppingCart size={16} />;
    default: return <AlertTriangle size={16} />;
  }
};

export function RiskPillarCard({ pillar }: RiskPillarCardProps) {
  const isCritical = pillar.severity === 'critical';
  const isHigh = pillar.severity === 'high';
  
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
      className={`relative cursor-pointer overflow-hidden rounded-xl border p-4 transition-colors ${bgClass} hover:bg-white/10`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <div className={`rounded-md p-1.5 ${isCritical ? 'bg-red-500/20 text-red-400' : isHigh ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-gray-400'}`}>
            {getIcon(pillar.icon)}
          </div>
          <span className="font-medium">{pillar.label}</span>
        </div>
        <div className={`text-lg font-bold ${textClass}`}>
          {(pillar.overallScore * 100).toFixed(0)}
        </div>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-black/50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${pillar.overallScore * 100}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full ${barColor}`}
        />
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <div className="flex items-center gap-1.5">
          <AlertCircle size={14} className="text-gray-400" />
          <span className="text-xs text-gray-400">
            <span className="font-medium text-white">{pillar.activeAlerts}</span> Active Alerts
          </span>
        </div>
        <div className="flex gap-1">
          {pillar.breakdown.high > 0 && (
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
              {pillar.breakdown.high} H
            </span>
          )}
          {pillar.breakdown.medium > 0 && (
            <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">
              {pillar.breakdown.medium} M
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
