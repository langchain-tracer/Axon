import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { TraceSummary } from '../types';
import { formatCost, formatTime } from '../lib/format';

/** Left rail: searchable list of traces. */
export function TraceList({
  traces,
  selectedId,
  onSelect,
}: {
  traces: TraceSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return traces;
    return traces.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        (t.projectName ?? '').toLowerCase().includes(q),
    );
  }, [traces, query]);

  return (
    <div className="flex h-full w-72 flex-col border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trace id / service…"
            className="w-full rounded-md border border-slate-800 bg-slate-900 py-2 pl-8 pr-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No traces yet.</p>
        )}
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`block w-full border-b border-slate-900 px-3 py-2.5 text-left hover:bg-slate-900 ${
              selectedId === t.id ? 'bg-slate-900' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate font-mono text-xs text-slate-300">{t.id.slice(0, 16)}…</span>
              <span
                className={`ml-2 h-2 w-2 flex-shrink-0 rounded-full ${
                  t.status === 'error'
                    ? 'bg-red-400'
                    : t.status === 'running'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate">{t.projectName || 'default'}</span>
              <span>{t.nodeCount} spans · {formatCost(t.cost)}</span>
            </div>
            <div className="text-[11px] text-slate-600">{formatTime(t.startTime)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
