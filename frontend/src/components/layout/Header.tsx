import { Activity, Clock, Settings2 } from 'lucide-react';
import { GlobalContextState, ProjectArchetype, TimeHorizon } from '@/app/page';
import { HelperDrawer } from './HelperDrawer';

interface HeaderProps {
  meta: any;
  globalContext: GlobalContextState;
  setGlobalContext: React.Dispatch<React.SetStateAction<GlobalContextState>>;
}

export function Header({ meta, globalContext, setGlobalContext }: HeaderProps) {
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

      <div className="flex items-center gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-3 bg-black/20 rounded-lg p-1.5 border border-white/5">
          <Settings2 size={14} className="text-gray-500 ml-1" />
          <select 
            value={globalContext.archetype}
            onChange={(e) => setGlobalContext(p => ({ ...p, archetype: e.target.value as ProjectArchetype }))}
            className="bg-transparent border-none text-xs text-gray-300 focus:outline-none cursor-pointer"
          >
            <option value="Standard Corporate">Standard Corporate</option>
            <option value="Agile IT">Agile IT</option>
            <option value="Heavy Infrastructure">Heavy Infrastructure</option>
          </select>
          <div className="h-4 w-[1px] bg-white/10"></div>
          <select 
            value={globalContext.horizon}
            onChange={(e) => setGlobalContext(p => ({ ...p, horizon: e.target.value as TimeHorizon }))}
            className="bg-transparent border-none text-xs text-gray-300 focus:outline-none cursor-pointer pr-2"
          >
            <option value="Short-term (3mo)">Short-term (3mo)</option>
            <option value="Long-term (12mo+)">Long-term (12mo+)</option>
          </select>
        </div>
        <HelperDrawer />
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <Clock size={14} />
          <span>Live Data</span>
        </div>
      </div>
    </header>
  );
}
