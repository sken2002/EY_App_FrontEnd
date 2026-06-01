import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Zap, Shield, GitBranch, ArrowRight, Activity, RotateCcw, Download, Upload, Info } from 'lucide-react';
import { SpiderNode, SpiderEdge } from '@/lib/types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
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
  const [activeTab, setActiveTab] = useState<'layers' | 'simulation' | 'trend'>('layers');
  const [levers, setLevers] = useState<SimulationLever[]>([]);
  const [narrativeObj, setNarrativeObj] = useState<any | null>(null);
  const [agentState, setAgentState] = useState<'idle' | 'financial' | 'operational' | 'strategist' | 'done'>('idle');
  const [historyCache, setHistoryCache] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetch('/data/history.json')
      .then(res => res.json())
      .then(data => setHistoryCache(data))
      .catch(err => console.error("Failed to load history.json", err));
  }, []);

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

  const radarData = useMemo(() => {
    if (!simulationResult?.state?.detected) return [];
    const det = simulationResult.state.detected;
    return [
      { subject: 'Cost & Fin.', score: Math.round(det.costFinancial?.score || 0) },
      { subject: 'Schedule', score: Math.round(det.schedule?.score || 0) },
      { subject: 'Operational', score: Math.round(det.operational?.score || 0) },
      { subject: 'Supplier', score: Math.round(det.supplier?.score || 0) },
      { subject: 'Cashflow', score: Math.round(det.cashflow?.score || 0) },
    ];
  }, [simulationResult?.state?.detected]);

  // Real Trend Data for selected node from Python backend
  const trendData = useMemo(() => {
    if (!selectedNode || !historyCache[selectedNode.id]) return [];
    return historyCache[selectedNode.id];
  }, [selectedNode, historyCache]);

  // Fetch narrative stream when simulation changes
  useEffect(() => {
    if (!simulationResult || !selectedNode) return;
    
    const abortController = new AbortController();
    
    const fetchNarrative = async () => {
      setAgentState('financial');
      setNarrativeObj(null);
      
      // Simulate agent handoffs while backend processes
      const t1 = setTimeout(() => setAgentState('operational'), 1500);
      const t2 = setTimeout(() => setAgentState('strategist'), 3000);
      
      try {
        // Gather rich context names instead of just IDs
        const upstreamEdges = edges.filter(e => e.target === selectedNode.id);
        const downstreamEdges = edges.filter(e => e.source === selectedNode.id);
        const upstreamNames = upstreamEdges.map(e => nodes.find(n => n.id === e.source)?.data.label).filter(Boolean);
        const downstreamNames = downstreamEdges.map(e => nodes.find(n => n.id === e.target)?.data.label).filter(Boolean);
        const impactedNames = simulationResult.state.blastRadius?.impactedNodeIds?.map(id => nodes.find(n => n.id === id)?.data.label).filter(Boolean) || [];

        const res = await fetch('/api/narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node: selectedNode,
            simulationState: simulationResult.state,
            simulationDelta: simulationResult.delta,
            dataQualityConfidence,
            blastRadius: simulationResult.state.blastRadius,
            contextEnv: {
              upstreamDependencies: upstreamNames,
              downstreamDependencies: downstreamNames,
              impactedDependencies: impactedNames
            }
          }),
          signal: abortController.signal
        });

        const data = await res.json();
        
        if (data.narrative && typeof data.narrative === 'object') {
          setNarrativeObj(data.narrative);
        } else {
          setNarrativeObj({ executive_summary: "Failed to parse analysis from server." });
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Failed to get narrative", err);
          setNarrativeObj({ executive_summary: "Analysis could not be generated." });
        }
      } finally {
        clearTimeout(t1);
        clearTimeout(t2);
        setAgentState('done');
      }
    };

    fetchNarrative();
    
    return () => abortController.abort();
  }, [simulationResult, selectedNode]);

  if (!selectedNode) {
    return (
      <aside className="flex w-[360px] shrink-0 flex-col items-center justify-center border-l border-white/10 bg-[#0f0f15] p-8 text-center">
        <Bot size={32} className="mb-4 text-white/20" />
        <h3 className="text-sm font-medium text-white/60">No Entity Selected</h3>
        <p className="mt-2 text-xs text-white/40">Select a work package, contract, or milestone to view details.</p>
      </aside>
    );
  }

  // Sub-node detail view (Contract / Milestone)
  if (selectedNode.type !== 'workPackage') {
    const isDelayed = selectedNode.data.status === 'Delayed';
    const isNonCompliant = selectedNode.data.metrics?.complianceStatus === 'Non-Compliant';
    
    return (
      <aside className="flex w-[380px] shrink-0 flex-col border-l border-white/10 bg-[#0f0f15] p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
          <div className={`p-3 rounded-xl ${selectedNode.type === 'contract' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            <Info size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{selectedNode.data.label}</h2>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">{selectedNode.type}</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Status</h3>
            {isDelayed ? (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-400 flex items-start gap-2 shadow-inner">
                <Bot size={16} className="mt-0.5 shrink-0" />
                This milestone is delayed by {selectedNode.data.metrics?.delayDays || 0} days, creating a critical downstream bottleneck for the central Work Package.
              </div>
            ) : isNonCompliant ? (
              <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg text-sm text-orange-400 flex items-start gap-2 shadow-inner">
                <Bot size={16} className="mt-0.5 shrink-0" />
                This contract is flagged as non-compliant, exposing the connected Work Package to severe supply chain risk.
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-sm text-emerald-400 flex items-start gap-2 shadow-inner">
                <Shield size={16} className="mt-0.5 shrink-0" />
                Operating nominally. No immediate risk triggers detected.
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exposure Impact</h3>
            <div className="bg-black/30 p-4 rounded-xl border border-white/5 shadow-md">
              <p className="text-2xl font-mono font-bold text-white mb-1">
                {selectedNode.type === 'contract' ? `£${(Math.random() * 2 + 0.5).toFixed(1)}M` : 'Schedule Block'}
              </p>
              <p className="text-xs text-gray-400">
                {selectedNode.type === 'contract' 
                  ? 'Financial value directly at risk from supply chain disruption.' 
                  : 'Directly blocks downstream completion of the central Work Package.'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (!simulationResult) return null;

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
        <button 
          onClick={() => setActiveTab('trend')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'trend' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <Activity size={14} /> Trend Analysis
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'layers' && (
            <motion.div
              key="layers"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col gap-6"
            >
              {/* Strategist Agent Summary */}
              <div className="rounded-xl border border-white/5 bg-emerald-900/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={14} className="text-emerald-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500/70">Multi-Agent Synthesis</h3>
                  {agentState !== 'idle' && agentState !== 'done' && <span className="flex h-2 w-2 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>}
                </div>
                
                <div className="text-sm leading-relaxed text-gray-300 min-h-[60px]">
                  {agentState === 'financial' && (
                    <span className="animate-pulse flex items-center gap-2 text-emerald-500/80"><Activity size={14} /> Financial Agent analyzing cost exposure...</span>
                  )}
                  {agentState === 'operational' && (
                    <span className="animate-pulse flex items-center gap-2 text-amber-500/80"><Activity size={14} /> Operational Agent auditing supplier delays...</span>
                  )}
                  {agentState === 'strategist' && (
                    <span className="animate-pulse flex items-center gap-2 text-blue-500/80"><Activity size={14} /> Chief Strategist resolving cross-risk correlation...</span>
                  )}
                  {agentState === 'done' && narrativeObj ? (
                    <div className="space-y-4">
                      {narrativeObj.executive_summary && (
                        <p className="text-sm text-emerald-100">{narrativeObj.executive_summary}</p>
                      )}
                      
                      <div className="bg-black/20 p-3 rounded border border-white/5 space-y-2">
                        {narrativeObj.active_pathway && (
                          <div className="text-xs"><span className="text-gray-500">Pathway:</span> <span className="text-gray-300">{narrativeObj.active_pathway}</span></div>
                        )}
                        {narrativeObj.blast_radius && (
                          <div className="text-xs"><span className="text-gray-500">Blast Radius:</span> <span className="text-gray-300">{narrativeObj.blast_radius}</span></div>
                        )}
                      </div>

                      {narrativeObj.tactical_actions && narrativeObj.tactical_actions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-widest">Tactical (48h)</h4>
                          <ul className="list-disc pl-4 space-y-1">
                            {narrativeObj.tactical_actions.map((act: string, i: number) => <li key={i} className="text-xs text-gray-300">{act}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Layer 2: Detected Risk */}
              <div className="flex flex-col gap-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">1. Standalone Risk</h3>
                  <p className="text-[10px] text-gray-400 mt-1">The inherent risk score before considering dependencies or mitigations.</p>
                </div>
                <div className="h-[200px] w-full bg-white/5 rounded-xl flex items-center justify-center p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#333" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Risk Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#10b981' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Layer 3: Propagation */}
              <div className="flex flex-col gap-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">2. Dependency Impact</h3>
                  <p className="text-[10px] text-gray-400 mt-1">Risk inherited from failing dependencies in the project.</p>
                </div>
                <div className="space-y-2">
                  {Object.entries(state.propagated).filter(([_, pressure]) => pressure > 0).map(([dim, pressure]) => (
                    <div key={dim} className="flex items-start gap-2 text-xs text-gray-300 bg-rose-500/5 p-2 rounded border border-rose-500/10">
                      <GitBranch size={14} className="text-rose-500 mt-0.5 shrink-0" />
                      <span>Due to issues in connected dependencies, the <span className="capitalize font-medium text-rose-400">{dim.replace(/([A-Z])/g, ' $1').trim()}</span> risk for this Work Package has increased by <strong className="text-rose-400">+{Math.round(pressure)}</strong> points.</span>
                    </div>
                  ))}
                  {Object.entries(state.propagated).filter(([_, p]) => p > 0).length === 0 && (
                    <div className="text-xs text-gray-500 italic">No inherited risk detected. Dependencies are healthy.</div>
                  )}
                </div>
              </div>

              {/* Layer 5: Residual */}
              <div className="flex flex-col gap-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">3. Final Risk Score</h3>
                  <p className="text-[10px] text-gray-400 mt-1">The actual risk level after accounting for dependency impacts and mitigations.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(state.residual).map(([dim, data]) => {
                    // Get the exact rules and the drivers that fired
                    const detectionData = state.detected[dim as keyof typeof state.detected];
                    const drivers = detectionData?.drivers?.filter(d => !d.includes('On track') && !d.includes('No delays') && !d.includes('performing well') && !d.includes('On Track')) || [];
                    
                    const getThresholdTooltip = (dimension: string) => {
                      switch(dimension) {
                        case 'schedule': return 'High Risk: Delay > 45 days OR Slippage > 15%. Medium Risk: Minor delays > 0.';
                        case 'costFinancial': return 'High Risk: CPI < 0.9 & SPI < 0.9 OR Budget Variance > 10%.';
                        case 'operational': return 'High Risk: Backlog > 90% OR Emergencies >= 2.';
                        case 'cashflow': return 'High Risk: Cashflow Deviation > 15% OR Payment Rejections > 20%.';
                        case 'supplier': return 'High Risk: Single Supplier OR Spend Share > 70% OR NCR > 75%.';
                        default: return 'Standard thresholds applied.';
                      }
                    };

                    return (
                    <div key={dim} className="group relative flex flex-col bg-black/20 p-2 rounded border border-white/5 text-xs cursor-help hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-500 capitalize truncate flex items-center gap-1">
                          {dim.replace(/([A-Z])/g, ' $1').trim()}
                          <Info size={10} className="text-emerald-500/50" />
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className={`font-semibold ${data.class === 'High' ? 'text-rose-500' : data.class === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {Math.round(data.score)}
                        </span>
                        <span className="text-gray-600 text-[10px] uppercase">{data.class}</span>
                      </div>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-48 p-3 bg-gray-900 border border-emerald-500/30 text-[10px] text-gray-300 rounded-lg shadow-2xl group-hover:block z-50 pointer-events-none">
                        <div className="mb-2">
                          <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[9px] block mb-0.5">Threshold Rule:</span>
                          {getThresholdTooltip(dim)}
                        </div>
                        {drivers.length > 0 && (
                          <div className="pt-2 border-t border-white/10">
                            <span className="text-rose-400 font-semibold uppercase tracking-wider text-[9px] block mb-0.5">Detected Drivers:</span>
                            <ul className="list-disc pl-3 text-gray-400 space-y-0.5">
                              {drivers.map((d, i) => <li key={i}>{d}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              {/* Layer 8: Blast Radius */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-white/10 pb-1">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">4. Downstream Impact</h3>
                  </div>
                </div>
                <div className="bg-black/30 border border-rose-500/10 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-300 mb-3">If this Work Package fails, the impact will cascade to <strong className="text-rose-400">{state.blastRadius.impactedNodeIds.length}</strong> dependent tasks, putting <strong className="text-rose-400">£{state.blastRadius.totalExposure.toLocaleString()}</strong> of project value at risk.</p>
                </div>
              </div>

            </motion.div>
          )}
          
          {activeTab === 'simulation' && (
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
                <div className="mt-4 bg-[#14141a] border border-amber-500/20 p-4 rounded-xl space-y-4 shadow-lg">
                  <div>
                    <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Simulation Impact</h4>
                    <div className="flex items-end gap-2">
                      <span className={`text-2xl font-bold ${delta.criDelta < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {delta.criDelta > 0 ? '+' : ''}{Math.round(delta.criDelta)}
                      </span>
                      <span className="text-xs text-gray-500 mb-1">CRI points</span>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    <h4 className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider mb-3">Engineered Mitigations</h4>
                    <div className="space-y-2">
                      {state.mitigations.filter(m => m.active).map(m => (
                        <div key={m.id} className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-start gap-3">
                          <div className="bg-emerald-500/20 p-1.5 rounded text-emerald-400 mt-0.5">
                            <Shield size={12} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-emerald-400">{m.label}</div>
                            <div className="text-[11px] text-emerald-100/70 mt-1 leading-snug">
                              Intercepted <span className="text-white font-medium capitalize">{m.dimension.replace(/([A-Z])/g, ' $1').trim()}</span> propagation. Downstream risk exposure reduced by <strong className="text-emerald-400">{Math.round(m.reduction * 100)}%</strong>.
                            </div>
                          </div>
                        </div>
                      ))}
                      {state.mitigations.filter(m => m.active).length === 0 && (
                        <div className="text-[11px] text-gray-500 italic flex items-center gap-2">
                          <Activity size={12} className="text-amber-500/50" />
                          Adjust levers to model mitigation strategies.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {activeTab === 'trend' && (
            <motion.div
              key="trend"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-6"
            >
              <div className="border-b border-white/10 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Risk Velocity & Trajectory</h3>
                <p className="text-[10px] text-gray-400 mt-1">Leading indicators predicting the next 30-day CRI movement.</p>
              </div>

              {selectedNode.data.trends ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Activity size={12} /> Accelerating Risk Drivers
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(selectedNode.data.trends).filter(([_, t]) => t === 'declining').map(([key]) => (
                        <div key={key} className="group relative bg-rose-500/10 border border-rose-500/20 p-2.5 rounded flex items-center justify-between cursor-help">
                          <span className="text-xs text-rose-200 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-[10px] text-rose-400 font-medium tracking-wide">DETERIORATING</span>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-full right-0 mb-2 hidden w-56 p-2 bg-gray-900 border border-white/20 text-[10px] text-gray-300 rounded-lg shadow-2xl group-hover:block z-50 pointer-events-none">
                            <span className="text-white font-medium">Deterministic Rule:</span> The 6-month historical data for {key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} shows a sustained downward trajectory, signaling an accelerating risk to the CRI.
                          </div>
                        </div>
                      ))}
                      {Object.entries(selectedNode.data.trends).filter(([_, t]) => t === 'declining').length === 0 && (
                        <div className="text-xs text-gray-500 italic px-2">No accelerating drivers detected.</div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Shield size={12} /> Stabilizing Drivers
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(selectedNode.data.trends).filter(([_, t]) => t === 'improving' || t === 'stable').map(([key, t]) => (
                        <div key={key} className="group relative bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded flex items-center justify-between cursor-help">
                          <span className="text-xs text-emerald-200 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wide">{t as string}</span>

                          {/* Tooltip */}
                          <div className="absolute bottom-full right-0 mb-2 hidden w-56 p-2 bg-gray-900 border border-white/20 text-[10px] text-gray-300 rounded-lg shadow-2xl group-hover:block z-50 pointer-events-none">
                            <span className="text-white font-medium">Deterministic Rule:</span> The 6-month historical data for {key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} {t === 'improving' ? 'shows a positive upward recovery, actively reducing' : 'remains within acceptable bounds, exerting neutral pressure on'} the overall CRI.
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic p-4 bg-white/5 rounded">Not enough historical data to compute risk velocity.</div>
              )}

              <div className="mt-4 pt-4 border-t border-white/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Historical Volatility</h3>
                <div className="h-[200px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={10} domain={[0, 100]} tickLine={false} axisLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#10b981' }}
                      />
                      <Line type="monotone" dataKey="cri" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-500 italic mt-2 text-center">Historical volatility and projected trajectory based on audit logs.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
