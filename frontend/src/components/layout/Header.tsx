import { Scenario } from '@/lib/types';
import { Activity, Clock } from 'lucide-react';

interface HeaderProps {
  meta: any;
}

export function Header({ meta }: HeaderProps) {
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

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Clock size={14} />
        <span>Live Data</span>
      </div>
    </header>
  );
}
