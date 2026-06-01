import { useState } from 'react';
import { HelpCircle, X, Calculator, ShieldAlert, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function HelperDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded transition-colors"
      >
        <HelpCircle size={14} />
        <span>How is this calculated?</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[400px] bg-[#0f0f15] border-l border-white/10 shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#161620]">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calculator size={18} className="text-emerald-400" />
                  Methodology Glossary
                </h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* Composite Risk Index */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                    <Activity size={14} />
                    Composite Risk Index (CRI)
                  </h3>
                  {/* CHANGED (Avery #15): replaced "strict, perfect mathematical average" wording with Avery's preferred phrasing
                      that emphasises transparency, aggregation, equal weighting for explainability and auditability. */}
                  <p className="text-sm text-gray-300 leading-relaxed">
                    The CRI provides a transparent aggregation of the five core risk pillars: Cost, Schedule, Operational, Supplier, and Cashflow. Currently each pillar contributes equally for explainability and auditability.
                  </p>
                  <div className="bg-black/30 border border-white/5 p-3 rounded font-mono text-xs text-gray-400 mt-2">
                    CRI = (Cost + Schedule + Ops + Supplier + Cash) / 5
                  </div>

                  {/* CHANGED (Avery #14): added H/M/L threshold bands so the score-to-class mapping is explicit and auditable.
                      Thresholds mirror the colour bands used in the PortfolioView heatmap (rose/amber/emerald). */}
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Risk class thresholds</p>
                    <div className="flex items-center justify-between text-xs bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded">
                      <span className="flex items-center gap-2 text-rose-400 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> High
                      </span>
                      <span className="text-gray-400 tabular-nums">CRI ≥ 65</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded">
                      <span className="flex items-center gap-2 text-amber-400 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Medium
                      </span>
                      <span className="text-gray-400 tabular-nums">40 ≤ CRI &lt; 65</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded">
                      <span className="flex items-center gap-2 text-emerald-400 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Low
                      </span>
                      <span className="text-gray-400 tabular-nums">CRI &lt; 40</span>
                    </div>
                  </div>
                </div>

                {/* Blast Radius */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                    <ShieldAlert size={14} />
                    Financial Blast Radius
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    If a Work Package fails or is delayed, the system calculates its "Blast Radius" by tracing its dependencies up to 3 levels deep in the project graph.
                    The total Financial Exposure represents the combined planned budget of all downstream tasks that will be blocked by this failure.
                  </p>
                </div>

                {/* EVM Metrics */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-400 border-b border-white/10 pb-2">Earned Value Metrics</h3>

                  <div>
                    <h4 className="text-sm text-gray-200 font-medium">Cost Performance Index (CPI)</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Ratio of earned value to actual cost. A CPI below 1.0 means the project is burning budget faster than it generates value.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm text-gray-200 font-medium">Schedule Performance Index (SPI)</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Ratio of earned value to planned value. An SPI below 1.0 indicates the project is falling behind schedule.
                    </p>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}