import { useState, useEffect } from 'react';
import { SpiderState } from '../lib/types';

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
