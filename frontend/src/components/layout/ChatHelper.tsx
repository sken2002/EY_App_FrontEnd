'use client';

import React, { useState, useEffect, useRef } from 'react';
// Removed broken useChat import
import { Bot, X, MessageSquare, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ChatHelperProps = {
  selectedNodeId: string | null;
  selectedNodeData: any;
  riskState: any;
};

export default function ChatHelper({ selectedNodeId, selectedNodeData, riskState }: ChatHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Package the current context to send with the chat
  const contextBody = {
    context: {
      selectedNodeId,
      nodeData: selectedNodeData,
      riskState: riskState ? {
        cri: riskState.compositeRiskIndex,
        dimensions: Object.keys(riskState).filter(k => k !== 'compositeRiskIndex' && k !== 'dataQuality').map(k => ({
          name: k,
          score: riskState[k].score,
          severity: riskState[k].severity
        }))
      } : null
    }
  };

  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputValue, id: Date.now().toString() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], context: contextBody.context })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch response');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '', id: (Date.now() + 1).toString() }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (reader && !done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          
          // Next.js AI SDK streams text in the format `0:"text"` or just plain text depending on version
          // If it's plain text, we just append it. If it has the `0:` prefix, we parse it.
          const cleanChunk = chunk.split('\n').map(line => {
            if (line.startsWith('0:')) {
              try { return JSON.parse(line.substring(2)); } catch { return ''; }
            }
            if (line.trim().startsWith('"') && line.trim().endsWith('"')) {
              try { return JSON.parse(line.trim()); } catch { return line; }
            }
            return line; // Fallback to raw text
          }).join('');

          setMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: last.content + cleanChunk }];
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, id: Date.now().toString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-80 sm:w-96 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: '500px', maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-500/20 p-1.5 rounded-lg">
                  <Bot size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-100">Spider Assistant</h3>
                  <p className="text-[10px] text-gray-400">Context: {selectedNodeId ? selectedNodeId : 'Portfolio Level'}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-10">
                  Ask me anything about the risks, dependencies, or suppliers {selectedNodeId ? `for ${selectedNodeId}` : 'in this portfolio'}.
                </div>
              )}
              {messages.map((m: any) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-br-none' 
                        : 'bg-white/10 text-gray-200 rounded-bl-none border border-white/5'
                    }`}
                  >
                    {/* Render basic markdown/newlines roughly */}
                    {String(m.content).split('\n').map((line: string, i: number) => (
                      <React.Fragment key={i}>
                        {line}
                        {i !== m.content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 rounded-2xl rounded-bl-none px-4 py-3 border border-white/5 flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-white/10 bg-black/40 p-3">
              <form onSubmit={handleFormSubmit} className="flex items-center gap-2 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-10 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="absolute right-1.5 p-1.5 bg-emerald-500 text-white rounded-full disabled:opacity-50 disabled:bg-gray-700 transition-colors"
                >
                  <Send size={14} className="ml-0.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-colors border border-emerald-400/20"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </motion.button>
    </div>
  );
}
