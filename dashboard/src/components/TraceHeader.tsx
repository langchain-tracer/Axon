import { useMemo } from 'react';
import type { TraceDetail } from '../types';
import { formatCost, formatDuration } from '../lib/format';

const T = { surface: '#0f1117', border: '#1e2535', text: '#f8fafc', vfaint: '#64748b' };
const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  complete: { bg: 'rgba(34,197,94,0.1)',  text: '#4ade80', label: 'Completed' },
  running:  { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', label: 'Running'   },
  error:    { bg: 'rgba(239,68,68,0.1)',  text: '#f87171', label: 'Error'     },
};

export function TraceHeader({ detail }: { detail: TraceDetail }) {
  const { trace, stats } = detail;
  const tokens = detail.nodes.reduce((s, n) => s + (n.tokens?.total ?? 0), 0);
  const s = STATUS[trace.status] ?? STATUS.complete;

  const costByModel = useMemo(() => {
    const map = new Map<string, { cost: number; tokens: number }>();
    for (const n of detail.nodes) {
      if (n.cost && n.model && n.model !== 'unknown') {
        const cur = map.get(n.model) ?? { cost: 0, tokens: 0 };
        map.set(n.model, {
          cost: cur.cost + n.cost,
          tokens: cur.tokens + (n.tokens?.total ?? 0),
        });
      }
    }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost);
  }, [detail.nodes]);

  const stats_list = [
    { label: 'Spans',    value: String(stats.totalNodes) },
    { label: 'Duration', value: formatDuration(trace.latency) },
    { label: 'Cost',     value: formatCost(stats.totalCost) },
    { label: 'Tokens',   value: tokens ? tokens.toLocaleString() : '—' },
    { label: 'LLM',      value: String(stats.llmCount) },
    { label: 'Tools',    value: String(stats.toolCount) },
    ...(stats.errorCount > 0 ? [{ label: 'Errors', value: String(stats.errorCount) }] : []),
  ];

  return (
    <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '14px 20px', flexShrink: 0 }}>
      {/* Trace ID + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#94a3b8' }}>
          {trace.id}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
          background: s.bg, color: s.text,
        }}>
          {s.label}
        </span>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 10, flexWrap: 'wrap' }}>
        {stats_list.map(st => (
          <div key={st.label} style={{ paddingRight: 24, paddingBottom: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: T.vfaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {st.label}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 600, color: T.text,
              fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums',
            }}>
              {st.value}
            </div>
          </div>
        ))}
      </div>

      {/* Model cost chips */}
      {costByModel.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {costByModel.map(([model, { cost, tokens: tok }]) => (
            <div key={model} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#0b0d10', border: `1px solid ${T.border}`,
              borderRadius: 20, padding: '3px 10px',
            }}>
              <svg width="8" height="8" viewBox="0 0 8 8">
                <circle cx="4" cy="4" r="3" stroke="#3b82f6" strokeWidth="1" fill="none"/>
                <circle cx="4" cy="4" r="1.2" fill="#3b82f6"/>
              </svg>
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>{model}</span>
              <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 500 }}>{formatCost(cost)}</span>
              <span style={{ fontSize: 10, color: T.vfaint }}>{tok ? `${tok.toLocaleString()}t` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
