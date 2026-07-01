import { useState } from 'react';

const T = { border: '#434655', surface: '#1b1f2c', bg: '#0a0e1a', faint: '#eef0fa', vfaint: '#9aa1b8' };

export function EmptyState() {
  const [copied, setCopied] = useState(false);
  const endpoint = `http://${window.location.host}/v1/traces`;

  function copy() {
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '56px 40px', overflowY: 'auto', flex: 1,
    }}>
      <svg width="54" height="54" viewBox="0 0 54 54" fill="none"
        style={{ marginBottom: 22, opacity: 0.3 }}>
        <polygon points="27,3 51,15 51,39 27,51 3,39 3,15"
          stroke="#3b82f6" strokeWidth="1.5" fill="rgba(59,130,246,0.07)"/>
        <circle cx="27" cy="27" r="6.5" stroke="#3b82f6" strokeWidth="1.3" fill="none"/>
        <line x1="27" y1="10" x2="27" y2="20.5" stroke="#3b82f6" strokeWidth="0.9" opacity="0.5"/>
        <line x1="40.7" y1="17.8" x2="32" y2="23" stroke="#3b82f6" strokeWidth="0.9" opacity="0.5"/>
        <line x1="40.7" y1="36.2" x2="32" y2="31" stroke="#3b82f6" strokeWidth="0.9" opacity="0.5"/>
        <line x1="27" y1="44" x2="27" y2="33.5" stroke="#3b82f6" strokeWidth="0.9" opacity="0.5"/>
        <line x1="13.3" y1="36.2" x2="22" y2="31" stroke="#3b82f6" strokeWidth="0.9" opacity="0.5"/>
        <line x1="13.3" y1="17.8" x2="22" y2="23" stroke="#3b82f6" strokeWidth="0.9" opacity="0.5"/>
      </svg>

      <div style={{ fontSize: 20, fontWeight: 600, color: '#f8fafc', marginBottom: 8, letterSpacing: '-0.025em' }}>
        No traces yet
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 36, textAlign: 'center', lineHeight: 1.7, maxWidth: 380 }}>
        Your LangChain agents will stream here in real-time. Point your OTLP exporter at the endpoint below to get started.
      </div>

      <div style={{ width: '100%', maxWidth: 500 }}>
        {/* Endpoint */}
        <div style={{ fontSize: 9, fontWeight: 600, color: T.vfaint, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>
          OTLP Endpoint
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '10px 13px', marginBottom: 28,
        }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#60a5fa', flex: 1 }}>
            {endpoint}
          </span>
          <div
            onClick={copy}
            style={{
              fontSize: 10, color: '#94a3b8', cursor: 'pointer',
              background: '#161922', border: `1px solid ${T.border}`,
              borderRadius: 4, padding: '4px 10px', whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </div>
        </div>

        {/* Python */}
        <CodeBlock lang="Python · traceloop-sdk" code={`from traceloop.sdk import Traceloop

Traceloop.init(
    app_name="my-agent",
    base_url="http://${window.location.host}",
)`} />

        <div style={{ height: 10 }} />

        {/* Node.js */}
        <CodeBlock lang="Node.js · @axon-ai/langchain-tracer" code={`import { AxonTracer } from "@axon-ai/langchain-tracer";

const tracer = new AxonTracer({
  baseUrl: "http://${window.location.host}",
});
// Pass tracer.callbacks to your chain`} />
      </div>
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const T2 = { border: '#434655', surface: '#1b1f2c', bg: '#0a0e1a' };
  return (
    <div style={{ background: T2.surface, border: `1px solid ${T2.border}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '8px 13px', borderBottom: `1px solid ${T2.border}`, background: T2.bg }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {lang}
        </span>
      </div>
      <pre style={{
        margin: 0, padding: '13px 15px',
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        lineHeight: 1.8, color: '#94a3b8', overflowX: 'auto', whiteSpace: 'pre',
      }}>
        {code}
      </pre>
    </div>
  );
}
