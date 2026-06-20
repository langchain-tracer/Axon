import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
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

const TABS = [
  { id: 'transcript', label: 'Transcript' },
  { id: 'tree', label: 'Tree' },
  { id: 'waterfall', label: 'Waterfall' },
  { id: 'raw', label: 'Raw' },
];

export default function App() {
  const { traces, refresh: refreshList } = useTraces();
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const { detail, refresh: refreshDetail } = useTraceDetail(selectedTraceId);
  const [tab, setTab] = useState('transcript');
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  // Auto-select the first trace once the list loads.
  useEffect(() => {
    if (!selectedTraceId && traces.length) setSelectedTraceId(traces[0].id);
  }, [traces, selectedTraceId]);

  // Live updates: new traces refresh the list; updates to the open trace refetch it.
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

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <TraceList traces={traces} selectedId={selectedTraceId} onSelect={selectTrace} />

      <div className="flex min-w-0 flex-1 flex-col">
        {!detail ? (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            <div className="text-center">
              <Activity className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p>Select a trace, or send OpenTelemetry spans to this endpoint.</p>
            </div>
          </div>
        ) : (
          <>
            <TraceHeader detail={detail} />
            <div className="px-4 pt-2">
              <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'transcript' && <Transcript nodes={nodes} edges={edges} onSelect={setSelectedSpan} />}
              {tab === 'tree' && (
                <SpanTree nodes={nodes} edges={edges} selectedId={selectedSpan?.id ?? null} onSelect={setSelectedSpan} />
              )}
              {tab === 'waterfall' && <Waterfall nodes={nodes} edges={edges} onSelect={setSelectedSpan} />}
              {tab === 'raw' && <RawInspector nodes={nodes} />}
            </div>
          </>
        )}
      </div>

      {selectedSpan && <SpanDetail span={selectedSpan} onClose={() => setSelectedSpan(null)} />}
    </div>
  );
}
