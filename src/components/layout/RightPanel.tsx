import { Scenario, SpiderNode } from '@/lib/types';
import { DrillState } from '@/app/page';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Zap, Shield, GitBranch, ArrowRight } from 'lucide-react';

interface RightPanelProps {
  scenario: Scenario;
  selectedNodeId: string | null;
  nodes: SpiderNode[];
  drill: DrillState;
}

export function RightPanel({ scenario, selectedNodeId, nodes, drill }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'remediation'>('analysis');
  const [isTyping, setIsTyping] = useState(false);
  const [typedText, setTypedText] = useState('');

  // Fake "thinking" / typing animation when scenario changes
  useEffect(() => {
    setIsTyping(true);
    setTypedText('');
    
    const text = scenario.agentAnalysis.executiveSummary;
    let i = 0;
    
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setTypedText(text.substring(0, i));
        i += 3; // Type speed
        if (i > text.length) {
          clearInterval(interval);
          setTypedText(text);
          setIsTyping(false);
        }
      }, 20);
      return () => clearInterval(interval);
    }, 800); // 800ms "thinking" delay
    
    return () => clearTimeout(timer);
  }, [scenario.id]);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#0f0f15]">
      
      {/* Agent Header */}
      <div className="flex items-center gap-3 border-b border-white/10 p-5 bg-emerald-900/10">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <Bot size={20} />
          {isTyping && (
            <span className="absolute bottom-0 right-0 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Strategist Agent</h2>
          <p className="text-xs text-emerald-500/70">{isTyping ? 'Analyzing cascade...' : 'Analysis complete'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-2 pt-2">
        <button 
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'analysis' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <Zap size={14} /> Analysis
        </button>
        <button 
          onClick={() => setActiveTab('remediation')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'remediation' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          <Shield size={14} /> Remediation
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'analysis' ? (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              {/* Executive Summary */}
              <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Executive Summary</h3>
                <p className="text-sm leading-relaxed text-gray-300">
                  {typedText}
                  {isTyping && <span className="animate-pulse">_</span>}
                </p>
              </div>

              {/* Impact Narrative */}
              {!isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                    <GitBranch size={14} /> Blast Radius Timeline
                  </h3>
                  <div className="flex flex-col gap-3">
                    {scenario.agentAnalysis.impactNarrative.map((narrative, idx) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 rounded-full bg-red-500/50 mt-1.5" />
                          {idx !== scenario.agentAnalysis.impactNarrative.length - 1 && (
                            <div className="w-px flex-1 bg-white/10 my-1" />
                          )}
                        </div>
                        <div className="text-gray-300 pb-2" dangerouslySetInnerHTML={{ __html: narrative.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>') }} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Node Inspection (if selected) */}
              {selectedNode && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-500">Entity Inspector</h3>
                  <p className="text-sm font-medium text-white">{selectedNode.data.label}</p>
                  <p className="mt-1 text-xs text-gray-400">{selectedNode.data.subtitle}</p>
                  
                  {selectedNode.type === 'workPackage' && selectedNode.data.deliveryRisk && (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Delivery Risk:</span>
                        <span className={selectedNode.data.deliveryRisk.class === 'High' ? 'text-red-400' : 'text-emerald-400'}>{selectedNode.data.deliveryRisk.driver}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cost Risk:</span>
                        <span className={selectedNode.data.costRisk?.class === 'High' ? 'text-red-400' : 'text-emerald-400'}>{selectedNode.data.costRisk?.driver}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="remediation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4"
            >
              {scenario.agentAnalysis.remediationSteps.map((step, idx) => (
                <div key={step.id} className="rounded-xl border border-white/5 bg-black/30 p-4 transition-colors hover:bg-white/5">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold ${step.priority === 'P0' ? 'text-red-400' : 'text-orange-400'}`}>
                      {step.priority}
                    </span>
                    <span className="text-[10px] text-gray-500">{step.owner}</span>
                  </div>
                  <p className="text-sm font-medium text-white leading-snug">{step.action}</p>
                  
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${step.riskReduction * 100}%` }} />
                    </div>
                    <span className="text-xs text-emerald-500 font-medium">-{step.riskReduction * 100}% Risk</span>
                  </div>
                </div>
              ))}
              
              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400">
                Generate Execution Plan <ArrowRight size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
