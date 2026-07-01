import { useCallback, useEffect, useState } from 'react';
import type { Span } from './types';
import { useTraces } from './hooks/useTraces';
import { useTraceDetail } from './hooks/useTraceDetail';
import { useTraceStream } from './hooks/useTraceStream';
import { TraceList } from './components/TraceList';
import { TraceHeader } from './components/TraceHeader';
import { Tabs } from './components/Tabs';
import { Transcript } from './components/Transcript';
import { SpanTree } from './components/SpanTree';
import { Waterfall } from './components/Waterfall';
import { RawInspector } from './components/RawInspector';
import { SpanDetail } from './components/SpanDetail';
import { EmptyState } from './components/EmptyState';

const TABS = [
  { id: 'transcript', label: 'Transcript' },
  { id: 'tree',       label: 'Tree'       },
  { id: 'waterfall',  label: 'Waterfall'  },
  { id: 'raw',        label: 'Raw'        },
];

// Design tokens — exact Lumina palette
const T = {
  bg:      '#0f131f',
  surface: '#171b28',
  border:  '#434655',
  text:    '#eef0fa',
  muted:   '#9aa1b8',
  faint:   '#9aa1b8',
};

export default function App() {
  const { traces, refresh: refreshList } = useTraces();
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const { detail, refresh: refreshDetail } = useTraceDetail(selectedTraceId);
  const [tab, setTab] = useState('transcript');
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  useEffect(() => {
    if (!selectedTraceId && traces.length) setSelectedTraceId(traces[0].id);
  }, [traces, selectedTraceId]);

  useTraceStream({
    onCreated: () => refreshList(),
    onUpdated: (id) => {
      refreshList();
      if (id === selectedTraceId) refreshDetail();
    },
  });

  const selectTrace = useCallback((id: string) => {
    setSelectedTraceId(id);
    setSelectedSpan(null);
  }, []);

  const nodes = detail?.nodes ?? [];
  const edges = detail?.edges ?? [];

  const projectName = (() => {
    const raw = detail?.trace.project ?? traces[0]?.projectName ?? 'my-agent';
    if (!raw || raw.startsWith('unknown_service')) return 'my-agent';
    return raw;
  })();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: T.bg, color: T.text,
      fontFamily: "'Satoshi', system-ui, sans-serif",
      fontSize: 13, overflow: 'hidden',
    }}>

      {/* ── TOP BAR ── */}
      <div style={{
        height: 44, background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 10, flexShrink: 0,
      }}>
        {/* Axon hexagon logo */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <polygon points="10,1.5 18.1,5.75 18.1,14.25 10,18.5 1.9,14.25 1.9,5.75"
            stroke="#3b82f6" strokeWidth="1.2" fill="rgba(59,130,246,0.07)"/>
          <circle cx="10" cy="10" r="2.2" fill="#3b82f6"/>
          <line x1="10" y1="3.7" x2="10" y2="7.8" stroke="#3b82f6" strokeWidth="0.9" opacity="0.45"/>
          <line x1="15.8" y1="7" x2="11.9" y2="9.1" stroke="#3b82f6" strokeWidth="0.9" opacity="0.45"/>
          <line x1="15.8" y1="13" x2="11.9" y2="10.9" stroke="#3b82f6" strokeWidth="0.9" opacity="0.45"/>
          <line x1="10" y1="16.3" x2="10" y2="12.2" stroke="#3b82f6" strokeWidth="0.9" opacity="0.45"/>
          <line x1="4.2" y1="13" x2="8.1" y2="10.9" stroke="#3b82f6" strokeWidth="0.9" opacity="0.45"/>
          <line x1="4.2" y1="7" x2="8.1" y2="9.1" stroke="#3b82f6" strokeWidth="0.9" opacity="0.45"/>
        </svg>

        <span style={{ fontWeight: 600, fontSize: 15, color: '#e8eef8', letterSpacing: '-0.025em' }}>
          Axon
        </span>
        <span style={{
          fontSize: 10, color: T.faint,
          fontFamily: "'JetBrains Mono', monospace",
          border: `1px solid ${T.border}`, padding: '1px 6px',
          borderRadius: 3, lineHeight: '1.6',
        }}>
          v1.2.0
        </span>

        <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />

        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
          <path d="M1 10V4.5C1 4 1.4 3.5 2 3.5H4.5L5.5 2.5H10C10.6 2.5 11 3 11 3.5V10C11 10.5 10.6 11 10 11H2C1.4 11 1 10.5 1 10Z"
            stroke="#c4d0e8" strokeWidth="1.1" fill="none"/>
        </svg>
        <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>{projectName}</span>

        <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />

        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.4 }}>
          <path d="M2 8.5V5.5a3.5 3.5 0 017 0v3" stroke="#c4d0e8" strokeWidth="1.1" fill="none"/>
          <rect x="1" y="8" width="9" height="2.5" rx="1" stroke="#c4d0e8" strokeWidth="1.1"/>
        </svg>
        <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
          localhost:{window.location.port || '4000'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          background: '#091209', border: '1px solid #152413',
          borderRadius: 20, padding: '4px 10px 4px 8px',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
            boxShadow: '0 0 8px rgba(34,197,94,0.5)', flexShrink: 0,
            animation: 'axon-pulse 2.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 500 }}>Connected</span>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <TraceList traces={traces} selectedId={selectedTraceId} onSelect={selectTrace} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {!detail ? (
            <EmptyState />
          ) : (
            <>
              <TraceHeader detail={detail} />
              <Tabs tabs={TABS} active={tab} onChange={setTab} />
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {tab === 'transcript' && (
                  <Transcript nodes={nodes} edges={edges} onSelect={setSelectedSpan} />
                )}
                {tab === 'tree' && (
                  <SpanTree
                    nodes={nodes} edges={edges}
                    selectedId={selectedSpan?.id ?? null}
                    onSelect={setSelectedSpan}
                  />
                )}
                {tab === 'waterfall' && (
                  <Waterfall nodes={nodes} edges={edges} onSelect={setSelectedSpan} />
                )}
                {tab === 'raw' && <RawInspector nodes={nodes} />}
              </div>
            </>
          )}
        </div>

        {selectedSpan && (
          <SpanDetail span={selectedSpan} onClose={() => setSelectedSpan(null)} />
        )}
      </div>
    </div>
  );
}
