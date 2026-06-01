import { useState, useEffect } from 'react';
import { SpiderState } from '../lib/types';
import { simulateWPRisk } from '../lib/riskEngine/simulate';

export function useSpiderState() {
  const [data, setData] = useState<SpiderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/data/state.json');
        if (!res.ok) throw new Error('Failed to fetch state data');
        const json = await res.json();
        
        if (json.nodes && json.edges && json.riskIndex) {
          const confidence = json.riskIndex.dataQuality?.confidenceModifier || 1.0;
          json.nodes.forEach((n: any) => {
            if (n.type === 'workPackage') {
              const sim = simulateWPRisk(n, [], json.nodes, json.edges, confidence);
              n.data.riskScore = sim.state.cri.score;
              
              const dims = ['costFinancial', 'cashflow', 'schedule', 'operational', 'supplier'];
              dims.forEach(dim => {
                if (n.data.dimensions?.[dim] && sim.state.residual?.[dim as keyof typeof sim.state.residual]) {
                  n.data.dimensions[dim].score = sim.state.residual[dim as keyof typeof sim.state.residual].score;
                  n.data.dimensions[dim].class = sim.state.residual[dim as keyof typeof sim.state.residual].class;
                }
              });
            }
          });
        }
        
        setData(json);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  return { data, loading, error };
}
