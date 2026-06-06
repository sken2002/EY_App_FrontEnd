import { Activity, Clock } from 'lucide-react';
import { HelperDrawer } from './HelperDrawer';

interface HeaderProps {
  meta: any;
}

export function Header({ meta }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/5 bg-[#18181b] px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center">
          <img src="https://upload.wikimedia.org/wikipedia/commons/3/34/EY_logo_2019.svg" alt="EY Logo" className="h-8 w-auto mr-3 brightness-0 invert" />
          <h1 className="text-lg font-bold tracking-tight text-white border-l border-white/20 pl-3">EY Spider</h1>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gray-400">
          EY
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm text-gray-400">

        <HelperDrawer />
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <Clock size={14} />
          <span>Live Data</span>
        </div>
      </div>
    </header>
  );
}
