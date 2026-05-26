import { SimulationLever } from '@/lib/riskEngine/types';

import { Info } from 'lucide-react';

const getTooltip = (id: string) => {
  if (id === 'cpi') return "Cost Performance Index: < 1.0 means project is burning cash faster than it earns value.";
  if (id === 'spi') return "Schedule Performance Index: < 1.0 means project is falling behind timeline.";
  if (id === 'budgetVariance') return "Percentage by which actual cost differs from planned cost.";
  if (id === 'backlogRatio') return "Percentage of Service Orders still pending or unresolved.";
  return undefined;
};

interface SimulationControlsProps {
  levers: SimulationLever[];
  onChange: (id: string, value: number) => void;
}

export function SimulationControls({ levers, onChange }: SimulationControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      {levers.map(lever => (
        <div key={lever.id} className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="font-medium text-gray-300 flex items-center gap-1.5">
              {lever.label}
              {getTooltip(lever.id) && (
                <div title={getTooltip(lever.id)} className="cursor-help text-gray-500 hover:text-gray-300">
                  <Info size={12} />
                </div>
              )}
            </label>
            <span className="text-gray-400 font-mono">
              {lever.simulatedValue.toFixed(lever.step < 1 ? 2 : 0)}{lever.unit}
              {lever.simulatedValue !== lever.currentValue && (
                <span className="ml-2 text-emerald-400">
                  (was {lever.currentValue.toFixed(lever.step < 1 ? 2 : 0)}{lever.unit})
                </span>
              )}
            </span>
          </div>
          <input 
            type="range"
            min={lever.min}
            max={lever.max}
            step={lever.step}
            value={lever.simulatedValue}
            onChange={(e) => onChange(lever.id, parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      ))}
    </div>
  );
}
