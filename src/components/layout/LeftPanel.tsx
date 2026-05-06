import { PillarRisk } from '@/lib/types';
import { PillarKey } from '@/app/page';
import { RiskPillarCard } from '../risk-index/RiskPillarCard';

interface LeftPanelProps {
  riskIndex: {
    delivery: PillarRisk;
    cost: PillarRisk;
    supplier: PillarRisk;
  };
  activePillar: PillarKey | null;
  onPillarClick: (pillar: PillarKey) => void;
}

const PILLAR_KEYS: PillarKey[] = ['delivery', 'cost', 'supplier'];

export function LeftPanel({ riskIndex, activePillar, onPillarClick }: LeftPanelProps) {
  const scores = [riskIndex.delivery.overallScore, riskIndex.cost.overallScore, riskIndex.supplier.overallScore];
  const maxScore = Math.max(...scores);
  const severity = maxScore >= 0.65 ? 'Critical' : maxScore >= 0.45 ? 'High' : 'Medium';
  const color = severity === 'Critical' ? 'text-red-500' : severity === 'High' ? 'text-orange-500' : 'text-emerald-500';

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-white/10 bg-[#0f0f15] overflow-y-auto">
      <div className="border-b border-white/10 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Portfolio Risk Profile</h2>
        <div className="mt-3 flex items-end gap-3">
          <div className={`text-4xl font-bold tracking-tight ${color}`}>
            {(maxScore * 100).toFixed(0)}
          </div>
          <div className="mb-1 text-sm font-medium text-gray-400">/ 100</div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${severity === 'Critical' ? 'bg-red-500' : severity === 'High' ? 'bg-orange-500' : 'bg-emerald-500'} animate-pulse`} />
          <span className="text-sm font-medium text-white">{severity} Posture</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <h3 className="text-sm font-semibold text-white">Risk Pillars</h3>
        {PILLAR_KEYS.map(key => (
          <div 
            key={key} 
            onClick={() => onPillarClick(key)}
            className={`rounded-xl transition-all cursor-pointer ${activePillar === key ? 'ring-2 ring-emerald-500' : ''}`}
          >
            <RiskPillarCard pillar={riskIndex[key]} />
          </div>
        ))}
      </div>
    </aside>
  );
}
