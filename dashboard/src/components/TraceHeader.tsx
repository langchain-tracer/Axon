import { useMemo } from 'react';
import type { TraceDetail } from '../types';
import { formatCost, formatDuration } from '../lib/format';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  );
}

/** Trace summary bar: id, project, totals + a lightweight cost-by-model breakdown. */
export function TraceHeader({ detail }: { detail: TraceDetail }) {
  const { trace, stats } = detail;
  const tokens = detail.nodes.reduce((sum, n) => sum + (n.tokens?.total ?? 0), 0);

  // Cost grouped by model (LLM spans with a non-zero cost).
  const costByModel = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of detail.nodes) {
      if (n.cost && n.model && n.model !== 'unknown') {
        map.set(n.model, (map.get(n.model) ?? 0) + n.cost);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [detail.nodes]);

  return (
    <div className="border-b border-slate-800 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-slate-300">{trace.id}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            trace.status === 'error'
              ? 'bg-red-500/15 text-red-300'
              : trace.status === 'running'
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-emerald-500/15 text-emerald-300'
          }`}
        >
          {trace.status}
        </span>
        <span className="text-xs text-slate-500">{trace.project}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-6">
        <Stat label="Spans" value={String(stats.totalNodes)} />
        <Stat label="Duration" value={formatDuration(trace.latency)} />
        <Stat label="Cost" value={formatCost(stats.totalCost)} />
        <Stat label="Tokens" value={tokens ? tokens.toLocaleString() : '—'} />
        <Stat label="LLM" value={String(stats.llmCount)} />
        <Stat label="Tools" value={String(stats.toolCount)} />
        {stats.errorCount > 0 && <Stat label="Errors" value={String(stats.errorCount)} />}
      </div>

      {costByModel.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Cost by model</span>
          {costByModel.map(([model, cost]) => (
            <span
              key={model}
              className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300"
            >
              {model} <span className="text-violet-300">{formatCost(cost)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
