import { useMemo } from 'react';
import type { Span, Edge } from '../types';
import { buildTree, flattenTree } from '../lib/tree';
import { formatDuration, formatCost } from '../lib/format';

const T = { border: '#1c2030', text: '#e2e8f0', muted: '#64748b' };

function UserBubble({ content }: { content: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', background: '#1a1f2c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="4.5" r="2.5" stroke="#64748b" strokeWidth="1.1"/>
          <path d="M1.5 12.5c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="#64748b" strokeWidth="1.1" strokeLinecap="round" fill="none"/>
        </svg>
      </div>
      <div style={{
        background: '#141820', border: `1px solid ${T.border}`,
        borderRadius: '3px 8px 8px 8px', padding: '9px 13px', maxWidth: 620,
      }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          User
        </div>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {content}
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ span, onSelect }: { span: Span; onSelect: (s: Span) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, flexDirection: 'row-reverse' }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: '#111827', border: '1px solid #1e3050',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="1.5" y="3.5" width="9" height="7" rx="1.5" stroke="#3b82f6" strokeWidth="1.1" fill="none"/>
          <path d="M4 3.5V2.5a2 2 0 014 0v1" stroke="#3b82f6" strokeWidth="1.1" fill="none"/>
          <circle cx="4.5" cy="7" r="1" fill="#3b82f6"/>
          <circle cx="7.5" cy="7" r="1" fill="#3b82f6"/>
        </svg>
      </div>
      <div
        onClick={() => onSelect(span)}
        style={{
          background: '#0d1525', border: '1px solid #182840',
          borderRadius: '8px 3px 8px 8px', padding: '9px 13px',
          maxWidth: 620, cursor: 'pointer', transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#182840'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa', fontFamily: "'JetBrains Mono', monospace" }}>
            {span.model || 'LLM'}
          </span>
          <span style={{ fontSize: 10, color: '#475569' }}>·</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {span.tokens?.total ? `${span.tokens.total.toLocaleString()} tokens` : '—'}
          </span>
          <span style={{ fontSize: 10, color: '#475569' }}>·</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{formatCost(span.cost)}</span>
        </div>
        <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {span.response || '…'}
        </div>
      </div>
    </div>
  );
}

function ToolCard({ span, onSelect }: { span: Span; onSelect: (s: Span) => void }) {
  const isError = span.status === 'error';
  return (
    <div
      onClick={() => onSelect(span)}
      style={{
        border: `1px solid ${isError ? '#2a1010' : '#0e2418'}`,
        background: isError ? '#0e0808' : '#080e0b',
        borderRadius: 6, cursor: 'pointer', overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = isError ? '#ef4444' : '#10b981'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = isError ? '#2a1010' : '#0e2418'}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', background: isError ? '#120a0a' : '#0b1510',
        borderBottom: `1px solid ${isError ? '#2a1010' : '#0e2418'}`,
      }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M8.5 2.5L10 1M8.5 2.5L7 4L9.5 3L8.5 2.5zM1.5 6.5L3 8.5L1 10.5l1.5-3.5zM3 8.5L7 4"
            stroke={isError ? '#f87171' : '#34d399'} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: isError ? '#f87171' : '#34d399',
          fontFamily: "'JetBrains Mono', monospace", flex: 1,
        }}>
          {span.toolName || span.label}
        </span>
        <span style={{
          fontSize: 10, color: '#64748b', background: '#0b0f0d',
          padding: '1px 6px', borderRadius: 3, border: '1px solid #1a2820',
        }}>
          {formatDuration(span.latency)}
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, color: isError ? '#f87171' : '#4ade80' }}>
          {isError ? 'Error' : 'Done'}
        </span>
      </div>

      {/* Input / Output */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: '8px 12px', borderRight: `1px solid ${isError ? '#2a1010' : '#0e2418'}` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, opacity: 0.6 }}>
            Input
          </div>
          <pre style={{
            margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', maxHeight: 70, overflow: 'hidden',
          }}>
            {span.toolInput || '—'}
          </pre>
        </div>
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: isError ? '#f87171' : '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, opacity: 0.6 }}>
            Output
          </div>
          <pre style={{
            margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: isError ? '#f87171' : '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', maxHeight: 70, overflow: 'hidden',
          }}>
            {span.toolOutput || span.error || '—'}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function Transcript({ nodes, edges, onSelect }: {
  nodes: Span[]; edges: Edge[]; onSelect: (s: Span) => void;
}) {
  const ordered = useMemo(
    () => flattenTree(buildTree(nodes, edges)).map(t => t.node),
    [nodes, edges],
  );

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 820 }}>
      {ordered.map(span => {
        if (span.type === 'tool') return <ToolCard key={span.id} span={span} onSelect={onSelect} />;
        if (span.type === 'llm') {
          return (
            <div key={span.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {span.prompts.map((p, i) => <UserBubble key={i} content={p} />)}
              {span.response && <AssistantBubble span={span} onSelect={onSelect} />}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
