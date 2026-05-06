import { Scenario } from '@/lib/types';
import { Activity, Clock } from 'lucide-react';

interface HeaderProps {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onScenarioChange: (id: string) => void;
  meta: any;
}

export function Header({ scenarios, activeScenarioId, onScenarioChange, meta }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#0f0f15] px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
          <Activity size={18} />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-white">Project Spider</h1>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gray-400">
          v{meta?.version || '1.0'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Demo Scenario:</span>
          <select 
            value={activeScenarioId || ''}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="rounded-md border border-white/10 bg-black/50 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        
        <div className="h-4 w-px bg-white/10" />
        
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock size={14} />
          <span>Live Data</span>
        </div>
      </div>
    </header>
  );
}
