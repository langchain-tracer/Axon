import { useMemo } from 'react';
import type { Span, Edge } from '../types';
import { buildTree, flattenTree } from '../lib/tree';
import { typeAccent, formatDuration } from '../lib/format';

/** Horizontal duration bars on a shared time axis. Pure CSS — no charting lib. */
export function Waterfall({
  nodes,
  edges,
  onSelect,
}: {
  nodes: Span[];
  edges: Edge[];
  onSelect: (s: Span) => void;
}) {
  const rows = useMemo(() => flattenTree(buildTree(nodes, edges)).map((t) => t.node), [nodes, edges]);

  const { min, span } = useMemo(() => {
    const starts = nodes.map((n) => n.startTime);
    const ends = nodes.map((n) => n.endTime ?? n.startTime);
    const min = Math.min(...starts);
    const max = Math.max(...ends, min + 1);
    return { min, span: max - min };
  }, [nodes]);

  return (
    <div className="space-y-1 p-4">
      {rows.map((node) => {
        const accent = typeAccent(node.type);
        const start = node.startTime - min;
        const width = (node.endTime ?? node.startTime) - node.startTime;
        const left = (start / span) * 100;
        const w = Math.max(0.5, (width / span) * 100);
        return (
          <button
            key={node.id}
            onClick={() => onSelect(node)}
            className="flex w-full items-center gap-3 rounded-md py-1 text-left hover:bg-slate-900"
          >
            <span className="w-40 flex-shrink-0 truncate text-xs text-slate-300">
              {node.type === 'tool' ? node.toolName || node.label : node.label}
            </span>
            <span className="relative h-4 flex-1 rounded bg-slate-900">
              <span
                className={`absolute top-0.5 h-3 rounded ${accent.dot}`}
                style={{ left: `${left}%`, width: `${w}%` }}
                title={formatDuration(node.latency)}
              />
            </span>
            <span className="w-16 flex-shrink-0 text-right text-[11px] text-slate-500">
              {formatDuration(node.latency)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
