import { useCallback, useEffect, useState } from 'react';
import { fetchTraces } from '../lib/api';
import type { TraceSummary } from '../types';

export function useTraces() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { traces } = await fetchTraces();
      setTraces(traces);
    } catch {
      // keep last good list on transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { traces, loading, refresh };
}
