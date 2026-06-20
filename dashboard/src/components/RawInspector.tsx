import { useState } from 'react';
import type { Span } from '../types';
import { CopyJsonButton } from './CopyJsonButton';
import { SpanIcon } from './SpanIcon';

/** Raw OTEL span JSON (data.raw) for every span, pretty-printed, copyable. */
export function RawInspector({ nodes }: { nodes: Span[] }) {
  const [openId, setOpenId] = useState<string | null>(nodes[0]?.id ?? null);

  return (
    <div className="space-y-2 p-4">
      {nodes.map((span) => {
        const open = openId === span.id;
        return (
          <div key={span.id} className="rounded-lg border border-slate-800 bg-slate-900/40">
            <div className="flex items-center justify-between px-3 py-2">
              <button
                onClick={() => setOpenId(open ? null : span.id)}
                className="flex items-center gap-2 text-left"
              >
                <SpanIcon type={span.type} error={!!span.error} className="h-3.5 w-3.5" />
                <span className="text-sm text-slate-200">{span.label}</span>
                <span className="font-mono text-[11px] text-slate-500">{span.type}</span>
              </button>
              {span.raw && <CopyJsonButton value={span.raw} label="Copy raw" />}
            </div>
            {open && (
              <pre className="max-h-[60vh] overflow-auto border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
                {JSON.stringify(span.raw ?? { note: 'no raw span stored' }, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
