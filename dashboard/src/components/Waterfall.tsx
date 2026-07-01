import { useMemo } from 'react';
import type { Span, Edge } from '../types';
import { buildTree, flattenTree } from '../lib/tree';
import { formatDuration } from '../lib/format';

const TYPE_BAR: Record<string, string> = {
  llm:   '#3b82f6',
  tool:  '#10b981',
  chain: '#8b5cf6',
};

const T = { border: '#1e2535', surface2: '#161b27', muted: '#64748b' };

export function Waterfall({ nodes, edges, onSelect }: {
  nodes: Span[]; edges: Edge[]; onSelect: (s: Span) => void;
}) {
  const rows = useMemo(
    () => flattenTree(buildTree(nodes, edges)).map(t => t.node),
    [nodes, edges],
  );

  const { min, span } = useMemo(() => {
    if (!nodes.length) return { min: 0, span: 1 };
    const starts = nodes.map(n => n.startTime);
    const ends   = nodes.map(n => n.endTime ?? n.startTime);
    const mn = Math.min(...starts);
    const mx = Math.max(...ends, mn + 1);
    return { min: mn, span: mx - mn };
  }, [nodes]);

  // 5 time markers across the axis
  const markers = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map(pct => ({
      pct: `${pct * 100}%`,
      label: formatDuration(pct * span),
    }));
  }, [span]);

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Axis header */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, paddingBottom: 4, marginBottom: 0 }}>
        <div style={{ width: 200, flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: 18 }}>
          {markers.map(m => (
            <div key={m.pct} style={{
              position: 'absolute', left: m.pct, transform: 'translateX(-50%)',
              fontSize: 9, color: T.muted,
              fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap',
            }}>
              {m.label}
            </div>
          ))}
        </div>
        <div style={{ width: 56, flexShrink: 0 }} />
      </div>

      {rows.map(node => {
        const barColor = TYPE_BAR[node.type] ?? '#475569';
        const start = node.startTime - min;
        const width = (node.endTime ?? node.startTime) - node.startTime;
        const left  = (start / span) * 100;
        const w     = Math.max(0.5, (width / span) * 100);

        return (
          <div
            key={node.id}
            onClick={() => onSelect(node)}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '5px 0', cursor: 'pointer', borderRadius: 4,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = T.surface2}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
          >
            {/* Name cell */}
            <div style={{ width: 200, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: barColor, flexShrink: 0 }} />
              <span style={{
                fontSize: 11, color: '#94a3b8', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {node.type === 'tool' ? node.toolName || node.label : node.label}
              </span>
            </div>

            {/* Bar track */}
            <div style={{ flex: 1, position: 'relative', height: 20, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 5, height: 10, borderRadius: 2,
                background: barColor, opacity: 0.55,
                left: `${left}%`, width: `${w}%`,
              }} />
            </div>

            {/* Duration */}
            <div style={{
              width: 56, flexShrink: 0, textAlign: 'right',
              fontSize: 10, color: T.muted, paddingRight: 8,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {formatDuration(node.latency)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
