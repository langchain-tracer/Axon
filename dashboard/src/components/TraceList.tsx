import { useMemo, useState } from 'react';
import type { TraceSummary } from '../types';
import { formatCost, formatDuration, formatTokens } from '../lib/format';

const T = {
  bg: '#0a0e1a', surface: '#171b28', surface2: '#262a37',
  border: '#434655', text: '#eef0fa', muted: '#9aa1b8',
  faint: '#d2d6e8', vfaint: '#9aa1b8',
};

const STATUS = {
  complete:  { bar: '#22c55e', dot: '#22c55e', label: 'Completed', bg: 'rgba(34,197,94,0.1)',  text: '#4ade80' },
  running:   { bar: '#f59e0b', dot: '#f59e0b', label: 'Running',   bg: 'rgba(245,158,11,0.1)', text: '#fbbf24' },
  error:     { bar: '#ef4444', dot: '#ef4444', label: 'Error',     bg: 'rgba(239,68,68,0.1)',  text: '#f87171' },
};

function statusStyle(status: string) {
  return STATUS[status as keyof typeof STATUS] ?? STATUS.complete;
}

function fmt(ms: number) { return formatDuration(ms); }

export function TraceList({
  traces, selectedId, onSelect,
}: {
  traces: TraceSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return traces;
    return traces.filter(t =>
      t.id.toLowerCase().includes(q) ||
      (t.projectName ?? '').toLowerCase().includes(q),
    );
  }, [traces, query]);

  return (
    <div style={{
      width: 280, flexShrink: 0, background: T.surface,
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ position: 'relative' }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="5.5" cy="5.5" r="4" stroke={T.vfaint} strokeWidth="1.3"/>
            <path d="M9 9L12 12" stroke={T.vfaint} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search traces…"
            style={{
              width: '100%', background: T.bg,
              border: `1px solid ${T.border}`, borderRadius: 5,
              padding: '6px 8px 6px 28px', fontSize: 12,
              color: T.text, outline: 'none',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
            }}
          />
        </div>
      </div>

      {/* Label row */}
      <div style={{
        padding: '7px 14px 5px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: T.vfaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Traces
        </span>
        <span style={{ fontSize: 10, color: T.vfaint, fontFamily: "'JetBrains Mono', monospace" }}>
          {filtered.length}
        </span>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {filtered.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '28px 20px', textAlign: 'center', gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <polygon points="9,1.5 16.8,5.75 16.8,14.25 9,18.5 1.2,14.25 1.2,5.75"
                  stroke={T.vfaint} strokeWidth="1.2" fill="none"/>
                <circle cx="9" cy="9" r="2.5" stroke={T.vfaint} strokeWidth="1.2" fill="none"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8a9bb8', marginBottom: 5 }}>No traces yet</div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
                Run your agent and<br/>traces will appear here.
              </div>
            </div>
          </div>
        )}

        {filtered.map(t => {
          const s = statusStyle(t.status);
          const isActive = t.id === selectedId;
          const dur = t.endTime ? fmt(t.endTime - t.startTime) : '—';
          const tokStr = t.nodeCount ? `${t.nodeCount} spans` : '—';

          return (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                display: 'flex', borderBottom: `1px solid ${T.border}`,
                cursor: 'pointer',
                background: isActive ? T.surface2 : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#131822'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {/* Status bar */}
              <div style={{ width: 3, background: s.bar, flexShrink: 0 }} />

              <div style={{ padding: '9px 12px 9px 10px', flex: 1, minWidth: 0 }}>
                {/* ID + badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    color: isActive ? T.text : '#4a5a72',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.id.slice(0, 16)}…
                  </span>
                  <div style={{
                    fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                    background: s.bg, color: s.text, flexShrink: 0,
                  }}>
                    {s.label}
                  </div>
                </div>

                {/* Span name (operation) */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 3 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M4.5 2H3.5c-.6 0-1 .45-1 1v1.5L1.5 6.5l1 2V10c0 .55.4 1 1 1h1M8.5 2h1c.6 0 1 .45 1 1v1.5L11.5 6.5l-1 2V10c0 .55-.4 1-1 1h-1"
                      stroke="#3a9a8a" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, color: T.text, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.name || (t.projectName?.startsWith('unknown_service') ? '' : t.projectName) || 'Unnamed trace'}
                    </div>
                    {t.description?.trim() && (
                      <div style={{
                        fontSize: 11, color: T.muted, marginTop: 1,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                      }}>
                        {t.description.trim()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div style={{
                  fontSize: 10, color: '#94a3b8',
                  fontFamily: "'JetBrains Mono', monospace", marginBottom: 3,
                }}>
                  {new Date(t.startTime).toLocaleString('en-GB', {
                    month: 'short', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </div>

                {/* Duration · cost · tokens */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  marginBottom: 2, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{dur}</span>
                  <span style={{ fontSize: 9, color: T.border }}>·</span>
                  <span style={{ fontSize: 10, color: T.muted }}>{formatCost(t.cost)}</span>
                  <span style={{ fontSize: 9, color: T.border }}>·</span>
                  <span style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{tokStr}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
