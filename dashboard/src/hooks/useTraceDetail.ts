import { useCallback, useEffect, useState } from 'react';
import { fetchTrace } from '../lib/api';
import type { TraceDetail } from '../types';

export function useTraceDetail(traceId: string | null) {
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!traceId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      setDetail(await fetchTrace(traceId));
    } catch {
      // keep last good detail on transient errors
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { detail, loading, refresh };
}
