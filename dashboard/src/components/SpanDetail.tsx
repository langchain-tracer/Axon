import { useState } from 'react';
import type { Span } from '../types';
import { formatCost, formatDuration } from '../lib/format';

const T = { surface: '#1b1f2c', bg: '#0a0e1a', border: '#434655', text: '#eef0fa', muted: '#9aa1b8', vfaint: '#9aa1b8' };

const TYPE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  llm:   { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  label: 'LLM'   },
  tool:  { color: '#34d399', bg: 'rgba(16,185,129,0.12)',  label: 'Tool'  },
  chain: { color: '#a78bfa', bg: 'rgba(139,92,246,0.12)',  label: 'Chain' },
};

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  complete: { bg: 'rgba(34,197,94,0.1)',  text: '#4ade80' },
  running:  { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24' },
  error:    { bg: 'rgba(239,68,68,0.1)',  text: '#f87171' },
};

function Section({ title, content, defaultOpen = true }: { title: string; content: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 0', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 11, color: '#3b82f6' }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
      </div>
      {open && (
        <pre style={{
          margin: 0, background: T.bg, border: `1px solid ${T.border}`,
          borderRadius: 4, padding: '9px 11px',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          lineHeight: 1.65, color: '#94a3b8', overflow: 'auto',
          maxHeight: 180, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {content}
        </pre>
      )}
    </div>
  );
}

export function SpanDetail({ span, onClose }: { span: Span; onClose: () => void }) {
  const cfg = TYPE_CFG[span.type] ?? { color: '#7a8da8', bg: 'rgba(120,130,160,0.1)', label: span.type };
  const sc  = STATUS_CFG[span.status] ?? STATUS_CFG.complete;

  const input  = span.type === 'tool' ? span.toolInput  : span.prompts.join('\n\n---\n\n');
  const output = span.type === 'tool' ? span.toolOutput : span.response;
  const attrs  = span.raw?.attributes ? JSON.stringify(span.raw.attributes, null, 2) : null;

  return (
    <div style={{
      width: 340, flexShrink: 0, background: T.surface,
      borderLeft: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'axon-fadein 0.16s ease both',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 14px', borderBottom: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
          background: cfg.bg, color: cfg.color, letterSpacing: '0.04em', flexShrink: 0,
        }}>
          {cfg.label}
        </div>
        <span style={{ fontSize: 12, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {span.type === 'tool' ? span.toolName || span.label : span.label}
        </span>
        <div
          onClick={onClose}
          style={{
            width: 22, height: 22, borderRadius: 4, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.vfaint, flexShrink: 0,
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.border; (e.currentTarget as HTMLDivElement).style.color = T.text; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.color = T.vfaint; }}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 1.5L7.5 7.5M7.5 1.5L1.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Body */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 14px' }}>

        {/* Status / Latency / Model / Cost grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Status',   value: <span style={{ fontSize: 13, fontWeight: 600, color: sc.text }}>{span.status}</span> },
            { label: 'Latency',  value: <span style={{ fontSize: 15, fontWeight: 600, color: '#e8eef8', fontFamily: "'JetBrains Mono', monospace" }}>{formatDuration(span.latency)}</span> },
            { label: 'Model',    value: <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{span.model && span.model !== 'unknown' ? span.model : '—'}</span> },
            { label: 'Cost',     value: <span style={{ fontSize: 15, fontWeight: 600, color: '#e8eef8', fontFamily: "'JetBrains Mono', monospace" }}>{formatCost(span.cost)}</span> },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: T.vfaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </span>
              {value}
            </div>
          ))}
        </div>

        {/* Token breakdown */}
        {span.tokens && span.tokens.total > 0 && (
          <div style={{
            background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 5, padding: 10, marginBottom: 14,
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: T.vfaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
              Token breakdown
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { label: 'Prompt',     val: span.tokens.input,  color: '#94a3b8' },
                { label: 'Completion', val: span.tokens.output, color: '#94a3b8' },
                { label: 'Total',      val: span.tokens.total,  color: '#60a5fa' },
              ].map(({ label, val, color }, i, arr) => (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 9, color: T.vfaint }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {val.toLocaleString()}
                  </span>
                  {i < arr.length - 1 && (
                    <div style={{ position: 'absolute', right: 0, top: 0, width: 1, background: T.border, height: '100%' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {span.error && (
          <div style={{
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 5, padding: '8px 11px', marginBottom: 10,
            fontSize: 11, color: '#f87171', lineHeight: 1.55,
          }}>
            {span.error}
          </div>
        )}

        {/* Collapsible sections */}
        {input  && <Section title="Input"      content={input}  defaultOpen={true}  />}
        {output && <Section title="Output"     content={output} defaultOpen={true}  />}
        {attrs  && <Section title="Attributes" content={attrs}  defaultOpen={false} />}
      </div>
    </div>
  );
}
