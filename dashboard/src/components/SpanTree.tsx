import { useMemo } from 'react';
import type { Span, Edge } from '../types';
import { buildTree, flattenTree } from '../lib/tree';
import { formatDuration } from '../lib/format';

const TYPE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  llm:   { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  label: 'LLM'   },
  tool:  { color: '#34d399', bg: 'rgba(16,185,129,0.12)',  label: 'Tool'  },
  chain: { color: '#a78bfa', bg: 'rgba(139,92,246,0.12)',  label: 'Chain' },
};

const T = { border: '#1e2535', text: '#f1f5f9', surface2: '#161b27', muted: '#64748b' };

export function SpanTree({ nodes, edges, selectedId, onSelect }: {
  nodes: Span[]; edges: Edge[];
  selectedId: string | null; onSelect: (s: Span) => void;
}) {
  const rows = useMemo(() => flattenTree(buildTree(nodes, edges)), [nodes, edges]);

  return (
    <div style={{ padding: '4px 0' }}>
      {rows.map(({ node, depth }) => {
        const cfg = TYPE_CFG[node.type] ?? { color: '#7a8da8', bg: 'rgba(120,130,160,0.1)', label: node.type };
        const isSelected = node.id === selectedId;

        return (
          <div
            key={node.id}
            onClick={() => onSelect(node)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px 7px 0', cursor: 'pointer',
              paddingLeft: 12 + depth * 20,
              background: isSelected ? T.surface2 : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = T.surface2; }}
            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            {/* Indent connector */}
            {depth > 0 && (
              <div style={{
                position: 'absolute',
                left: 12 + (depth - 1) * 20 + 10,
                width: 10, height: 1,
                background: T.border,
              }} />
            )}

            {/* Type dot */}
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />

            {/* Type badge */}
            <div style={{
              fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
              background: cfg.bg, color: cfg.color, flexShrink: 0, letterSpacing: '0.04em',
            }}>
              {cfg.label}
            </div>

            {/* Name */}
            <span style={{ fontSize: 12, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.type === 'tool' ? node.toolName || node.label : node.label}
            </span>

            {/* Model */}
            {node.model && node.model !== 'unknown' && (
              <span style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginRight: 8 }}>
                {node.model}
              </span>
            )}

            {/* Duration */}
            <span style={{
              fontSize: 10, color: T.muted,
              fontFamily: "'JetBrains Mono', monospace",
              flexShrink: 0, minWidth: 52, textAlign: 'right', paddingRight: 8,
            }}>
              {formatDuration(node.latency)}
            </span>

            {/* Error indicator */}
            {node.error && (
              <span style={{ fontSize: 10, color: '#f87171', flexShrink: 0 }}>!</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
