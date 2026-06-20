import { useEffect, useRef } from 'react';

/**
 * Subscribe to the backend SSE stream (GET /api/events).
 * Fires `onCreated` when a new trace appears and `onUpdated` when an existing
 * trace gets new spans. Reconnection is handled natively by EventSource.
 */
export function useTraceStream(handlers: {
  onCreated?: (traceId: string) => void;
  onUpdated?: (traceId: string) => void;
}) {
  // Keep latest handlers without re-opening the stream.
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const es = new EventSource('/api/events');
    const onCreated = (e: MessageEvent) => ref.current.onCreated?.(JSON.parse(e.data).traceId);
    const onUpdated = (e: MessageEvent) => ref.current.onUpdated?.(JSON.parse(e.data).traceId);
    es.addEventListener('trace_created', onCreated as EventListener);
    es.addEventListener('trace_updated', onUpdated as EventListener);
    return () => es.close();
  }, []);
}
