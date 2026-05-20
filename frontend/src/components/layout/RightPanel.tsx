import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Zap, Shield, GitBranch, ArrowRight, Activity, RotateCcw, Download, Upload } from 'lucide-react';
import { SpiderNode, SpiderEdge } from '@/lib/types';
import { SimulationLever, WPRiskState } from '@/lib/riskEngine/types';
import { simulateWPRisk } from '@/lib/riskEngine/simulate';
import { SimulationControls } from '../simulation/SimulationControls';

interface RightPanelProps {
  selectedNodeId: string | null;
  nodes: SpiderNode[];
  edges: SpiderEdge[];
  dataQualityConfidence: number;
}

export function RightPanel({ selectedNodeId, nodes, edges, dataQualityConfidence }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<'layers' | 'simulation'>('layers');
  const [levers, setLevers] = useState<SimulationLever[]>([]);
  const [narrative, setNarrative] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  // Initialize levers when a new WP is selected
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'workPackage') {
      const m = selectedNode.data.metrics || {};
      setLevers([
        { id: 'cpi', label: 'Cost Perf. Index (CPI)', currentValue: m.cpi || 1.0, simulatedValue: m.cpi || 1.0, min: 0.5, max: 1.5, step: 0.05, unit: '', dimensionKey: 'costFinancial' },
        { id: 'spi', label: 'Schedule Perf. Index (SPI)', currentValue: m.spi || 1.0, simulatedValue: m.spi || 1.0, min: 0.5, max: 1.5, step: 0.05, unit: '', dimensionKey: 'costFinancial' },
        { id: 'completionPct', label: 'Completion %', currentValue: m.completionPct || 0, simulatedValue: m.completionPct || 0, min: 0, max: 100, step: 1, unit: '%', dimensionKey: 'schedule' },
        { id: 'supplierCount', label: 'Supplier Count', currentValue: m.supplierCount || 1, simulatedValue: m.supplierCount || 1, min: 0, max: 10, step: 1, unit: '', dimensionKey: 'supplier' },
        { id: 'budgetVariance', label: 'Budget Variance', currentValue: m.budgetVariance || 0, simulatedValue: m.budgetVariance || 0, min: -30, max: 30, step: 1, unit: '%', dimensionKey: 'costFinancial' },
        { id: 'backlogRatio', label: 'Backlog Ratio', currentValue: (m.backlogRatio || 0)*100, simulatedValue: (m.backlogRatio || 0)*100, min: 0, max: 100, step: 5, unit: '%', dimensionKey: 'operational' },
      ]);
      setActiveTab('layers'); // reset to layers view on new selection
    } else {
      setLevers([]);
    }
  }, [selectedNodeId, nodes]);

  const handleLeverChange = (id: string, value: number) => {
    setLevers(prev => prev.map(l => l.id === id ? { ...l, simulatedValue: value } : l));
  };

  const resetLevers = () => {
    setLevers(prev => prev.map(l => ({ ...l, simulatedValue: l.currentValue })));
  };

  const handleExport = () => {
    if (!selectedNode) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(levers, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `sim_state_${selectedNode.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedLevers = JSON.parse(e.target?.result as string);
        if (Array.isArray(importedLevers) && importedLevers.length > 0 && importedLevers[0].id) {
          // Merge imported levers with current levers to ensure all properties exist
          setLevers(prev => prev.map(l => {
            const imported = importedLevers.find((il: any) => il.id === l.id);
            return imported ? { ...l, simulatedValue: imported.simulatedValue } : l;
          }));
        }
      } catch (err) {
        console.error("Failed to parse simulation state", err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Run simulation reactively
  const simulationResult = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'workPackage' || levers.length === 0) return null;
    return simulateWPRisk(selectedNode, levers, nodes, edges, dataQualityConfidence);
  }, [selectedNode, levers, nodes, edges, dataQualityConfidence]);

  // Fetch narrative stream when simulation changes
  useEffect(() => {
    if (!simulationResult || !selectedNode) return;
    
    const abortController = new AbortController();
    
    const fetchNarrative = async () => {
      setIsTyping(true);
      setNarrative('');
      
      try {
        const res = await fetch('/api/narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeData: selectedNode.data,
            state: simulationResult.state,
            delta: simulationResult.delta,
          }),
          signal: abortController.signal
        });

        if (!res.body) throw new Error('No body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setNarrative(prev => prev + chunk);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Failed to stream narrative", err);
          setNarrative("Analysis could not be generated.");
        }
      } finally {
        setIsTyping(false);
      }
    };

    fetchNarrative();
    
    return () => abortController.abort();
  }, [simulationResult, selectedNode]);

  if (!selectedNode || selectedNode.type !== 'workPackage' || !simulationResult) {
    return (
      <aside className="flex w-[360px] shrink-0 flex-col items-center justify-center border-l border-white/10 bg-[#0f0f15] p-8 text-center">
        <Bot size={32} className="mb-4 text-white/20" />
        <h3 className="text-sm font-medium text-white/60">No Work Package Selected</h3>
        <p className="mt-2 text-xs text-white/40">Select a work package to view its risk layers and run simulations.</p>
      </aside>
    );
  }

  const { state, delta } = simulationResult;
  const isSimulating = levers.some(l => l.currentValue !== l.simulatedValue);

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-white/10 bg-[#0f0f15]">
      
      {/* Header */}
      <div className="flex flex-col border-b border-white/10 p-5 bg-emerald-900/10">
        <div className="flex items-center gap-3 mb-3">
          <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isSimulating ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            <Activity size={20} />
            {isSimulating && <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white truncate max-w-[280px]" title={selectedNode.data.label}>
              {selectedNode.data.label}
            </h2>
            <p className="text-xs text-gray-400">Risk Engine Analysis</p>
          </div>
        </div>
        
        {/* Topline Metric */}
        <div className="flex items-end gap-3 mt-1">
          <div className="text-3xl font-bold text-white tracking-tight">{state.cri.score}</div>
          <div className="mb-1 text-xs font-medium text-gray-500">
            Composite Risk Index
            {isSimulating && delta.criDelta !== 0 && (
              <span className={`ml-2 ${delta.criDelta < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({delta.criDelta > 0 ? '+' : ''}{Math.round(delta.criDelta)} from baseline)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-2 pt-2 bg-black/20">
        <button 
          onClick={() => setActiveTab('layers')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'layers' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <Zap size={14} /> Risk Layers
        </button>
        <button 
          onClick={() => setActiveTab('simulation')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'simulation' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <Activity size={14} /> Simulation
          {isSimulating && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'layers' ? (
            <motion.div
              key="layers"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col gap-6"
            >
              {/* Strategist Agent Summary */}
              <div className="rounded-xl border border-white/5 bg-emerald-900/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={14} className="text-emerald-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500/70">Strategist Agent</h3>
                  {isTyping && <span className="flex h-2 w-2 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>}
                </div>
                <p className="text-sm leading-relaxed text-gray-300 min-h-[60px]">
                  {narrative}
                  {isTyping && <span className="animate-pulse">_</span>}
                </p>
              </div>

              {/* Layer 2: Detected Risk */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-white/10 pb-1">1. Detected Risk Signals</h3>
                <div className="space-y-2">
                  {Object.entries(state.detected).filter(([_, d]) => d.class !== 'Low' && d.class !== 'No Data').map(([dim, data]) => (
                    <div key={dim} className="bg-white/5 rounded-lg p-2.5 text-xs">
                      <div className="flex justify-between font-medium mb-1.5">
                        <span className="text-gray-300 capitalize">{dim.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className={data.class === 'High' ? 'text-rose-400' : 'text-amber-400'}>Score: {Math.round(data.score)}</span>
                      </div>
                      <ul className="text-gray-400 space-y-1 list-disc list-inside">
                        {data.drivers.filter(d => d && !d.includes('On track') && !d.includes('within tolerance') && !d.includes('manageable') && !d.toLowerCase().includes('low') && !d.toLowerCase().includes('no ')).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {Object.entries(state.detected).filter(([_, d]) => d.class !== 'Low' && d.class !== 'No Data').length === 0 && (
                    <div className="text-xs text-gray-500 italic">No significant risks detected in baseline metrics.</div>
                  )}
                </div>
              </div>

              {/* Layer 3: Propagation */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-white/10 pb-1">2. Propagation Pressure</h3>
                <div className="space-y-2">
                  {Object.entries(state.propagated).filter(([_, pressure]) => pressure > 0).map(([dim, pressure]) => (
                    <div key={dim} className="flex items-center gap-2 text-xs text-gray-300">
                      <GitBranch size={14} className="text-rose-500" />
                      <span>Added <strong className="text-rose-400">+{Math.round(pressure)}</strong> pressure to <span className="capitalize">{dim.replace(/([A-Z])/g, ' $1').trim()}</span> from connected nodes.</span>
                    </div>
                  ))}
                  {Object.entries(state.propagated).filter(([_, p]) => p > 0).length === 0 && (
                    <div className="text-xs text-gray-500 italic">No downstream pressure detected.</div>
                  )}
                </div>
              </div>

              {/* Layer 4: Mitigations */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-white/10 pb-1">3. Balancing Factors</h3>
                <div className="space-y-2">
                  {state.mitigations.filter(m => m.active).map(m => (
                    <div key={m.id} className="flex items-start gap-2 text-xs text-gray-300 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                      <Shield size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium text-emerald-400">{m.label}</div>
                        <div className="text-gray-400 mt-0.5">Reduces <span className="capitalize">{m.dimension.replace(/([A-Z])/g, ' $1').trim()}</span> risk by {Math.round(m.reduction * 100)}%.</div>
                      </div>
                    </div>
                  ))}
                  {state.mitigations.filter(m => m.active).length === 0 && (
                    <div className="text-xs text-gray-500 italic">No strong mitigating factors detected.</div>
                  )}
                </div>
              </div>

              {/* Layer 5: Residual */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-white/10 pb-1">4. Residual Risk Status</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(state.residual).map(([dim, data]) => (
                    <div key={dim} className="flex flex-col bg-black/20 p-2 rounded border border-white/5 text-xs">
                      <span className="text-gray-500 capitalize mb-1 truncate">{dim.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <div className="flex items-baseline justify-between">
                        <span className={`font-semibold ${data.class === 'High' ? 'text-rose-500' : data.class === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {Math.round(data.score)}
                        </span>
                        <span className="text-gray-600 text-[10px] uppercase">{data.class}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Layer 8: Blast Radius */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-white/10 pb-1">5. Blast Radius</h3>
                <div className="bg-black/30 border border-rose-500/10 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Impacted Entities</span>
                    <span className="font-mono text-rose-400 font-medium">{state.blastRadius.impactedNodeIds.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Financial Exposure</span>
                    <span className="font-mono text-rose-400 font-medium">£{state.blastRadius.totalExposure.toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </motion.div>
          ) : (
            <motion.div
              key="simulation"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-6"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Metric Levers</h3>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded">
                    <Upload size={10} /> Load
                    <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                  </label>
                  <button onClick={handleExport} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded">
                    <Download size={10} /> Save
                  </button>
                  {isSimulating && (
                    <button onClick={resetLevers} className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-1 rounded">
                      <RotateCcw size={10} /> Reset
                    </button>
                  )}
                </div>
              </div>
              
              <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                <SimulationControls levers={levers} onChange={handleLeverChange} />
              </div>

              {isSimulating && (
                <div className="mt-4 bg-amber-900/10 border border-amber-500/20 p-4 rounded-xl">
                  <h4 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-2">
                    <Activity size={14} /> Simulation Impacts
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-2 list-disc list-inside">
                    {delta.criDelta !== 0 && (
                      <li>Composite Risk Index changed by <strong className={delta.criDelta < 0 ? 'text-emerald-400' : 'text-rose-400'}>{delta.criDelta > 0 ? '+' : ''}{Math.round(delta.criDelta)}</strong> points.</li>
                    )}
                    {/* Could add more delta explanations here based on before/after states */}
                    <li>Graph propagation and mitigations have been recomputed.</li>
                  </ul>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
