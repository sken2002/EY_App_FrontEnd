'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PillarRisk, SpiderNode } from '@/lib/types';
import { PillarKey } from '@/app/page';
import { ChevronRight, ChevronDown, AlertTriangle, Search, Filter, FolderKanban, UserCircle2 } from 'lucide-react';

interface PillarViewProps {
  pillarKey: PillarKey;
  pillar: PillarRisk;
  workPackages: (SpiderNode & { pillarRiskClass: string; pillarRiskDriver: string })[];
  onEntityClick: (entityId: string) => void;
}

const RISK_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  High:   { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
  Medium: { bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500' },
  Low:    { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
};

export function PillarView({ pillarKey, pillar, workPackages, onEntityClick }: PillarViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('All');
  
  // Track expanded state for owners and categories
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleOwner = (owner: string) => {
    setExpandedOwners(prev => {
      const next = new Set(prev);
      if (next.has(owner)) next.delete(owner);
      else next.add(owner);
      return next;
    });
  };

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryKey)) next.delete(categoryKey);
      else next.add(categoryKey);
      return next;
    });
  };

  // Filter and Group Logic
  const groupedData = useMemo(() => {
    let filtered = workPackages;

    // Apply Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(wp => 
        wp.data.label.toLowerCase().includes(q) || 
        wp.id.toLowerCase().includes(q)
      );
    }

    // Apply Risk Filter
    if (riskFilter !== 'All') {
      filtered = filtered.filter(wp => wp.pillarRiskClass === riskFilter);
    }

    // Grouping: Owner -> Category -> WorkPackages
    const grouped: Record<string, Record<string, typeof workPackages>> = {};

    filtered.forEach(wp => {
      const owner = wp.data.owner || 'Unassigned';
      // Parse category from subtitle (e.g. "Construction · Remote" -> "Construction")
      const category = wp.data.subtitle ? wp.data.subtitle.split('·')[0].trim() : 'General';

      if (!grouped[owner]) grouped[owner] = {};
      if (!grouped[owner][category]) grouped[owner][category] = [];
      
      grouped[owner][category].push(wp);
    });

    // Sort owners, and then sort categories within them
    const sortedOwners = Object.keys(grouped).sort();
    const result = sortedOwners.map(owner => {
      const categories = Object.keys(grouped[owner]).sort().map(cat => ({
        name: cat,
        key: `${owner}-${cat}`,
        items: grouped[owner][cat]
      }));
      return { owner, categories };
    });

    return result;
  }, [workPackages, searchTerm, riskFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Sticky Header with Search & Filters */}
      <div className="shrink-0 border-b border-white/5 bg-[#0a0a0f] px-8 py-6 z-10">
        <h2 className="text-2xl font-bold text-white mb-4">{pillar.label}</h2>
        
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search by ID or Name..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <select 
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
            >
              <option value="All">All Risks</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable Tree View */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Search size={32} className="mb-4 opacity-20" />
            <p>No work packages found matching your criteria.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedData.map(({ owner, categories }) => {
              const isOwnerExpanded = expandedOwners.has(owner);
              const totalWPs = categories.reduce((sum, cat) => sum + cat.items.length, 0);
              
              return (
                <div key={owner} className="rounded-xl border border-white/10 bg-[#111116] overflow-hidden">
                  {/* Owner Header */}
                  <button 
                    onClick={() => toggleOwner(owner)}
                    className="flex w-full items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                        <UserCircle2 size={16} />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">{owner}</h3>
                        <p className="text-xs text-gray-500">{totalWPs} Project{totalWPs !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {isOwnerExpanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                  </button>

                  {/* Owner Content (Categories) */}
                  <AnimatePresence>
                    {isOwnerExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 bg-black/20"
                      >
                        <div className="flex flex-col gap-1 p-3">
                          {categories.map((cat) => {
                            const isCatExpanded = expandedCategories.has(cat.key);
                            
                            return (
                              <div key={cat.key} className="rounded-lg border border-white/5 bg-[#14141a]">
                                {/* Category Header */}
                                <button
                                  onClick={() => toggleCategory(cat.key)}
                                  className="flex w-full items-center justify-between p-3 hover:bg-white/5 transition-colors"
                                >
                                  <div className="flex items-center gap-3 pl-2">
                                    <FolderKanban size={14} className="text-gray-400" />
                                    <span className="text-sm font-medium text-gray-300">{cat.name}</span>
                                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-500">{cat.items.length}</span>
                                  </div>
                                  {isCatExpanded ? <ChevronDown size={16} className="text-gray-600" /> : <ChevronRight size={16} className="text-gray-600" />}
                                </button>

                                {/* Category Content (Work Packages) */}
                                <AnimatePresence>
                                  {isCatExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 pt-0 pl-10">
                                        {cat.items.map(wp => {
                                          const style = RISK_BADGE[wp.pillarRiskClass] || RISK_BADGE['Low'];
                                          return (
                                            <motion.button
                                              key={wp.id}
                                              whileHover={{ y: -2 }}
                                              whileTap={{ scale: 0.98 }}
                                              onClick={() => onEntityClick(wp.id)}
                                              className={`group relative flex flex-col rounded-lg border p-3 text-left transition-all hover:bg-white/5 ${style.bg}`}
                                            >
                                              <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1 min-w-0 pr-2">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                                                    <h4 className="text-sm font-semibold text-white truncate" title={wp.data.label}>{wp.data.label}</h4>
                                                  </div>
                                                </div>
                                                <ChevronRight size={14} className="text-gray-600 shrink-0 mt-0.5 group-hover:translate-x-1 group-hover:text-white transition-transform" />
                                              </div>
                                              
                                              <div className="flex items-start gap-1.5 mb-2 rounded border border-black/20 bg-black/30 px-2 py-1.5">
                                                <AlertTriangle size={10} className={`${style.text} mt-0.5 shrink-0`} />
                                                <p className="text-[10px] text-gray-300 leading-tight line-clamp-2">{wp.pillarRiskDriver}</p>
                                              </div>

                                              <div className="flex items-center justify-between text-[10px] text-gray-500 mt-auto">
                                                <span>{wp.data.metrics.completionPct?.toFixed(0) || 0}% Complete</span>
                                                {wp.data.metrics.plannedCost > 0 && <span>£{(wp.data.metrics.plannedCost / 1000000).toFixed(1)}M</span>}
                                              </div>
                                            </motion.button>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
