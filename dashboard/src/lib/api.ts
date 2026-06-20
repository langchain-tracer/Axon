// Typed fetch helpers for the Axon backend (same-origin in prod, proxied in dev).

import type { TraceDetail, TraceSummary } from '../types';

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function fetchTraces(): Promise<{ traces: TraceSummary[]; total: number }> {
  return getJSON('/api/traces');
}

export function fetchTrace(id: string): Promise<TraceDetail> {
  return getJSON(`/api/traces/${encodeURIComponent(id)}`);
}
