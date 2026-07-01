import { useState } from 'react';
import type { Span } from '../types';

const T = { surface: '#0f1117', bg: '#0b0d10', border: '#1c2030', text: '#c4d0e8', muted: '#4a5a72' };

export function RawInspector({ nodes }: { nodes: Span[] }) {
  const [copied, setCopied] = useState(false);
  const allRaw = nodes.map(n => n.raw ?? { id: n.id, type: n.type, label: n.label });

  function copy() {
    navigator.clipboard.writeText(JSON.stringify(allRaw, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div
          onClick={copy}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 5, padding: '5px 12px', cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.border}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="0.5" y="2.5" width="7" height="8" rx="1.2" stroke={T.muted} strokeWidth="1.1"/>
            <rect x="3.5" y="0.5" width="7" height="8" rx="1.2" stroke={T.muted} strokeWidth="1.1"/>
          </svg>
          <span style={{ fontSize: 11, color: T.muted }}>{copied ? 'Copied!' : 'Copy JSON'}</span>
        </div>
      </div>
      <pre style={{
        margin: 0, background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '14px 16px',
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        lineHeight: 1.7, color: '#7a8da8', overflow: 'auto',
        maxHeight: 'calc(100vh - 270px)', whiteSpace: 'pre',
      }}>
        {JSON.stringify(allRaw, null, 2)}
      </pre>
    </div>
  );
}
