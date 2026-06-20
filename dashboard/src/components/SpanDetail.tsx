import { X } from 'lucide-react';
import type { Span } from '../types';
import { Collapsible } from './Collapsible';
import { CopyJsonButton } from './CopyJsonButton';
import { typeAccent, formatCost, formatDuration, formatTokens } from '../lib/format';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="ml-2 text-sm text-slate-300">{value}</span>
    </div>
  );
}

/** Right-hand inspector for a selected span. */
export function SpanDetail({ span, onClose }: { span: Span; onClose: () => void }) {
  const accent = typeAccent(span.type);
  const input = span.type === 'tool' ? span.toolInput : span.prompts.join('\n\n');
  const output = span.type === 'tool' ? span.toolOutput : span.response;

  return (
    <div className="flex h-full w-96 flex-col border-l border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className={`text-sm font-semibold ${accent.text}`}>{span.label}</span>
        <div className="flex items-center gap-2">
          <CopyJsonButton value={span} label="Copy span" />
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Field label="Type" value={span.type} />
          {span.model && span.model !== 'unknown' && <Field label="Model" value={span.model} />}
          <Field label="Status" value={span.status} />
          <Field label="Duration" value={formatDuration(span.latency)} />
          <Field label="Cost" value={formatCost(span.cost)} />
          <Field label="Tokens" value={formatTokens(span.tokens)} />
        </div>

        {span.error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {span.error}
          </div>
        )}

        {input && (
          <Collapsible title="Input">
            <pre className="whitespace-pre-wrap break-words text-xs text-slate-300">{input}</pre>
          </Collapsible>
        )}
        {output && (
          <Collapsible title="Output">
            <pre className="whitespace-pre-wrap break-words text-xs text-slate-300">{output}</pre>
          </Collapsible>
        )}
        {span.raw && (
          <Collapsible title="Attributes" defaultOpen={false}>
            <pre className="whitespace-pre-wrap break-words text-xs text-slate-400">
              {JSON.stringify(span.raw.attributes, null, 2)}
            </pre>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
