import { useMemo } from 'react';
import type { Span, Edge } from '../types';
import { buildTree, flattenTree } from '../lib/tree';
import { typeAccent, formatDuration, formatCost } from '../lib/format';
import { SpanIcon } from './SpanIcon';

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  if (!text) return null;
  return (
    <div className={`flex ${role === 'user' ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
          role === 'user'
            ? 'bg-slate-800 text-slate-200'
            : 'bg-violet-600/20 text-violet-100'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function Turn({ span, onSelect }: { span: Span; onSelect: (s: Span) => void }) {
  const accent = typeAccent(span.type);
  const title =
    span.type === 'tool' ? span.toolName || span.label
    : span.type === 'llm' ? span.model || 'LLM'
    : span.chainName || span.label;

  return (
    <div className="space-y-2">
      <button
        onClick={() => onSelect(span)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${accent.bg}`}>
          <SpanIcon type={span.type} error={!!span.error} className="h-4 w-4" />
        </span>
        <span className={`text-xs font-medium ${accent.text}`}>{title}</span>
        <span className="text-[11px] text-slate-500">
          {formatDuration(span.latency)}{span.cost ? ` · ${formatCost(span.cost)}` : ''}
        </span>
        {span.error && <span className="text-[11px] text-red-400">error</span>}
      </button>

      <div className="ml-8 space-y-2">
        {span.type === 'tool' ? (
          <>
            {span.toolInput && <Bubble role="user" text={`→ ${span.toolInput}`} />}
            {span.toolOutput && <Bubble role="assistant" text={span.toolOutput} />}
          </>
        ) : (
          <>
            {span.prompts.map((p, i) => <Bubble key={i} role="user" text={p} />)}
            <Bubble role="assistant" text={span.response} />
          </>
        )}
        {span.error && <Bubble role="assistant" text={`⚠ ${span.error}`} />}
      </div>
    </div>
  );
}

/** Reader mode: the run rendered as a chat dialogue, in execution order. */
export function Transcript({
  nodes,
  edges,
  onSelect,
}: {
  nodes: Span[];
  edges: Edge[];
  onSelect: (s: Span) => void;
}) {
  const ordered = useMemo(() => flattenTree(buildTree(nodes, edges)).map((t) => t.node), [nodes, edges]);

  return (
    <div className="space-y-5 p-4">
      {ordered.map((span) => (
        <Turn key={span.id} span={span} onSelect={onSelect} />
      ))}
    </div>
  );
}
