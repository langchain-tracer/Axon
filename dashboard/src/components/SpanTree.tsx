import { useMemo } from 'react';
import type { Span, Edge } from '../types';
import { buildTree, flattenTree } from '../lib/tree';
import { typeAccent, formatDuration, formatCost, formatTokens } from '../lib/format';
import { SpanIcon } from './SpanIcon';

/** Collapsible-free hierarchy with indentation + inline duration bars. */
export function SpanTree({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: Span[];
  edges: Edge[];
  selectedId: string | null;
  onSelect: (s: Span) => void;
}) {
  const rows = useMemo(() => flattenTree(buildTree(nodes, edges)), [nodes, edges]);
  const maxLatency = Math.max(1, ...nodes.map((n) => n.latency || 0));

  return (
    <div className="p-2">
      {rows.map(({ node, depth }) => {
        const accent = typeAccent(node.type);
        const pct = Math.max(2, ((node.latency || 0) / maxLatency) * 100);
        return (
          <button
            key={node.id}
            onClick={() => onSelect(node)}
            style={{ paddingLeft: 8 + depth * 16 }}
            className={`flex w-full items-center gap-3 rounded-md py-1.5 pr-3 text-left hover:bg-slate-900 ${
              selectedId === node.id ? 'bg-slate-900' : ''
            }`}
          >
            <SpanIcon type={node.type} error={!!node.error} className="h-4 w-4 flex-shrink-0" />
            <span className="w-44 flex-shrink-0 truncate text-sm text-slate-200">
              {node.type === 'tool' ? node.toolName || node.label : node.label}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
              <span className={`block h-full ${accent.dot}`} style={{ width: `${pct}%` }} />
            </span>
            <span className="w-16 flex-shrink-0 text-right text-xs text-slate-400">
              {formatDuration(node.latency)}
            </span>
            <span className="w-20 flex-shrink-0 text-right text-xs text-slate-500">
              {node.tokens ? formatTokens(node.tokens) : formatCost(node.cost)}
            </span>
            {node.error && <span className="text-xs text-red-400">!</span>}
          </button>
        );
      })}
    </div>
  );
}
