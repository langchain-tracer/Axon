import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { io, Socket } from 'socket.io-client';
import type {
  UseTraceDataOptions,
  UseAnomalyDetectionOptions,
  TraceStatistics,
  TraceComparison,
  LayoutType,
} from '../types';

// ---- Socket singleton (shared by hooks) ------------------------------------
export const replaySocket: Socket = io('/', {
  path: '/socket.io',
  transports: ['websocket'],
  auth: { projectName: 'dashboard' },
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

// ============================================================================
// useTraceData - Fetch and manage trace data
// ============================================================================

export const useTraceData = (
  traceId: string | null,
  options: UseTraceDataOptions = {}
) => {
  const { autoRefresh = false, refreshInterval = 5000 } = options;
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrace = useCallback(async () => {
    if (!traceId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/traces/${traceId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch trace: ${response.statusText}`);
      }

      const data = await response.json();

      // Convert backend format to ReactFlow format
      const flowNodes: Node[] = data.nodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        position: { x: 0, y: 0 }, // layout is applied elsewhere
        data: node,
      }));

      const flowEdges: Edge[] = data.edges.map((edge: any) => ({
        id: `e${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching trace:', err);
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    fetchTrace();

    if (autoRefresh) {
      const interval = setInterval(fetchTrace, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchTrace, autoRefresh, refreshInterval]);

  // 🔁 Refetch this trace when a replay completes for this traceId
  useEffect(() => {
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent)?.detail;
      if (!traceId) return;
      if (detail?.traceId && detail.traceId !== traceId) return; // only refetch for the active trace
      fetchTrace();
    };
    window.addEventListener('axon:replay_llm_result', handler as EventListener);
    return () =>
      window.removeEventListener(
        'axon:replay_llm_result',
        handler as EventListener
      );
  }, [traceId, fetchTrace]);

  return { nodes, edges, loading, error, refetch: fetchTrace };
};

// ============================================================================
// useRealtimeUpdates - WebSocket connection for live updates
// ============================================================================

interface RealtimeUpdate {
  type: 'node_start' | 'node_complete' | 'node_error' | 'trace_complete';
  traceId: string;
  nodeId?: string;
  data?: any;
  timestamp?: number;
}

export const useRealtimeUpdates = (traceId: string | null) => {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);

  useEffect(() => {
    if (!traceId) return;

    const socket = replaySocket;

    const onConnect = () => {
      console.log('🔌 Socket.IO connected:', socket.id);
      setConnected(true);
      socket.emit('watch_trace', traceId);
    };

    const onTraceData = (data: any) => {
      setLastUpdate({
        type: 'trace_complete',
        traceId,
        timestamp: Date.now(),
        data,
      });
    };

    const onNewEvent = (event: any) => {
      setLastUpdate({
        type: 'node_complete',
        traceId,
        timestamp: Date.now(),
        data: event,
      });
    };

    // 🎯 NEW: react to replay completion (not persisted) and broadcast a DOM event
    const onReplayLLMResult = (payload: any) => {
      console.log('🎯 replay_llm_result', payload);
      setLastUpdate({
        type: 'trace_complete',
        traceId,
        timestamp: Date.now(),
        data: payload,
      });
      // Let any interested hooks/components refetch
      window.dispatchEvent(
        new CustomEvent('axon:replay_llm_result', { detail: payload })
      );
    };

    const onDisconnect = (reason: any) => {
      console.log('⚠️ Socket.IO disconnected:', reason);
      setConnected(false);
    };

    const onError = (err: any) => {
      console.error('❌ Socket connection error:', err?.message || err);
    };

    socket.on('connect', onConnect);
    socket.on('trace_data', onTraceData);
    socket.on('new_event', onNewEvent);
    socket.on('replay_llm_result', onReplayLLMResult);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    // Cleanup listeners (do not disconnect shared socket)
    return () => {
      socket.off('connect', onConnect);
      socket.off('trace_data', onTraceData);
      socket.off('new_event', onNewEvent);
      socket.off('replay_llm_result', onReplayLLMResult);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
    };
  }, [traceId]);

  return { connected, lastUpdate };
};

// ============================================================================
// useKeyboardShortcuts - Handle keyboard shortcuts
// ============================================================================

interface ShortcutHandlers {
  [key: string]: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${
        e.shiftKey ? 'shift+' : ''
      }${e.key}`;

      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlers]);
};

// ============================================================================
// useAnomalyDetection - Detect anomalies in trace
// ============================================================================

import {
  AnomalyDetector,
  Anomaly as DetectionAnomaly,
} from '../utils/AnomalyDetection';

// Fix NodeJS namespace issue
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

export const useAnomalyDetection = (
  nodes: Node[],
  options: UseAnomalyDetectionOptions = {}
) => {
  const { enabled = true } = options;
  const [anomalies, setAnomalies] = useState<DetectionAnomaly[]>([]);

  useEffect(() => {
    if (!enabled || nodes.length === 0) {
      setAnomalies([]);
      return;
    }

    const detector = new AnomalyDetector(nodes, []);
    const result = detector.detectAnomalies();
    setAnomalies(result.anomalies);
  }, [nodes, enabled]);

  const dismissAnomaly = useCallback((anomalyId: string) => {
    setAnomalies((prev) => prev.filter((a) => a.id !== anomalyId));
  }, []);

  const highSeverityCount = anomalies.filter(
    (a) => a.severity === 'high'
  ).length;
  const mediumSeverityCount = anomalies.filter(
    (a) => a.severity === 'medium'
  ).length;

  return {
    anomalies,
    dismissAnomaly,
    highSeverityCount,
    mediumSeverityCount,
    hasAnomalies: anomalies.length > 0,
  };
};

// ============================================================================
// useTraceStatistics - Calculate trace statistics
// ============================================================================

import { calculateStatistics } from '../utils/UtilityFunctions';

export const useTraceStatistics = (nodes: Node[]) => {
  const [stats, setStats] = useState<TraceStatistics | null>(null);

  useEffect(() => {
    if (nodes.length === 0) {
      setStats(null);
      return;
    }

    const calculated = calculateStatistics(nodes);
    setStats(calculated);
  }, [nodes]);

  return stats;
};

// ============================================================================
// useLocalStorage - Persist state to localStorage
// ============================================================================

export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error('Error writing to localStorage:', error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
};

// ============================================================================
// useDebounce - Debounce a value
// ============================================================================

export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// ============================================================================
// useNodeSelection - Manage node selection state
// ============================================================================

export const useNodeSelection = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectionHistory, setSelectionHistory] = useState<string[]>([]);

  const selectNode = useCallback(
    (nodeId: string | null) => {
      if (nodeId && nodeId !== selectedNodeId) {
        setSelectionHistory((prev) => [...prev, nodeId]);
      }
      setSelectedNodeId(nodeId);
    },
    [selectedNodeId]
  );

  const goBack = useCallback(() => {
    if (selectionHistory.length > 1) {
      const newHistory = [...selectionHistory];
      newHistory.pop(); // Remove current
      const previous = newHistory[newHistory.length - 1];
      setSelectionHistory(newHistory);
      setSelectedNodeId(previous);
    }
  }, [selectionHistory]);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectionHistory([]);
  }, []);

  return {
    selectedNodeId,
    selectNode,
    goBack,
    clearSelection,
    canGoBack: selectionHistory.length > 1,
  };
};

// ============================================================================
// useExport - Handle exports
// ============================================================================

import {
  exportToJSON,
  exportToCSV,
  exportGraphAsImage,
  downloadFile,
} from '../utils/UtilityFunctions';

export const useExport = (nodes: Node[], edges: Edge[]) => {
  const [exporting, setExporting] = useState(false);

  const exportData = useCallback(
    async (format: 'json' | 'csv' | 'png' | 'svg') => {
      setExporting(true);

      try {
        switch (format) {
          case 'json': {
            const jsonData = exportToJSON(nodes, edges, {
              includeMetadata: true,
            });
            downloadFile(
              jsonData,
              `trace-${Date.now()}.json`,
              'application/json'
            );
            break;
          }
          case 'csv': {
            const csvData = exportToCSV(nodes);
            downloadFile(csvData, `trace-${Date.now()}.csv`, 'text/csv');
            break;
          }
          case 'png':
          case 'svg': {
            await exportGraphAsImage(format, `trace-${Date.now()}.${format}`);
            break;
          }
        }
      } catch (error) {
        console.error('Export failed:', error);
        throw error;
      } finally {
        setExporting(false);
      }
    },
    [nodes, edges]
  );

  return { exportData, exporting };
};

// ============================================================================
// useAutoLayout - Apply layout automatically
// ============================================================================

import { applyLayout } from '../utils/LayoutAlgorithms';

export const useAutoLayout = (
  nodes: Node[],
  edges: Edge[],
  layoutType: LayoutType
) => {
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>(nodes);

  useEffect(() => {
    if (nodes.length === 0) return;

    const layouted = applyLayout(layoutType, nodes, edges);
    setLayoutedNodes(layouted);
  }, [nodes, edges, layoutType]);

  return layoutedNodes;
};


export function useReplay() {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const deltaBufferRef = useRef<string[]>([]);

  const genId = () =>
    (globalThis as any)?.crypto?.randomUUID
      ? (globalThis as any).crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const replayFromNode = useCallback(
    async (startNodeId: string, opts: any) => {
      setLoading(true);
      setResult(null);
      setOutput('');
      deltaBufferRef.current = [];

      const requestId = genId();
      const model = opts?.model || 'gpt-4o-mini';
      const stream = opts?.stream ?? true;

      const messages =
        Array.isArray(opts?.messages) && opts.messages.length
          ? opts.messages.map((m: any) => ({
              role: (m.role || 'user') as 'system' | 'user' | 'assistant',
              content: m.content || '',
            }))
          : [
              {
                role: 'user' as const,
                content: opts?.prompt || opts?.promptText || 'Replay from node.',
              },
            ];

      const socket = replaySocket;

      // STREAM DELTAS
      const onDelta = (p: any) => {
        if (p?.requestId !== requestId) return;
        const delta = p?.delta || '';
        // accumulate for final payload and keep UI output updated
        deltaBufferRef.current.push(delta);
        setOutput((prev) => prev + delta);
        // 🔊 bubble up to the app
        window.dispatchEvent(
          new CustomEvent('axon:replay_llm_result', {
            detail: { requestId, delta, append: true },
          })
        );
        console.log('[WS<-] replay_llm_delta', p);
      };

      // MODEL INTERMEDIATE / FINAL TEXT RESPONSE (pre-final)
      const onResponse = (p: any) => {
        if (p?.requestId !== requestId) return;
        console.log('[WS<-] replay_llm_response', p);
        const payload = {
          ok: !!p?.ok,
          text: p?.text || '',
          requestId,
          timestamp: Date.now(),
        };
        // keep output consistent even if no streaming happened
        if (!output && p?.text) setOutput(p.text);
        setResult((prev: any) => ({ ...(prev || {}), ...payload }));
        // 🔊 bubble up
        window.dispatchEvent(
          new CustomEvent('axon:replay_llm_result', { detail: payload })
        );
      };

      // REPLAY SUMMARY / METRICS (final)
      const onResult = (p: any) => {
        if (p?.requestId !== requestId) return;
        console.log('[WS<-] replay_result', p);
        setLoading(false);

        // normalize and store as "final" so parents can render results overlay
        const finalPayload = {
          requestId,
          success: !!p?.success,
          executedNodes: p?.executedNodes || [],
          skippedNodes: p?.skippedNodes || [],
          sideEffects: p?.sideEffects || [],
          totalCost: p?.totalCost ?? 0,
          totalLatency: p?.totalLatency ?? 0,
          ok: p?.success, // convenience
          // prefer our accumulated buffer; fall back to server text
          text:
            deltaBufferRef.current && deltaBufferRef.current.length > 0
              ? deltaBufferRef.current.join('')
              : p?.text ?? '',
        };
        setResult((prev: any) => ({ ...(prev || {}), ...finalPayload }));

        // 🔊 bubble up final packet
        window.dispatchEvent(
          new CustomEvent('axon:replay_llm_result', { detail: finalPayload })
        );

        // cleanup listeners
        socket.off('replay_llm_delta', onDelta);
        socket.off('replay_llm_response', onResponse);
        socket.off('replay_result', onResult);

        // clear buffer after use
        deltaBufferRef.current = [];
      };

      socket.on('replay_llm_delta', onDelta);
      socket.on('replay_llm_response', onResponse);
      socket.on('replay_result', onResult);

      console.log('▶️ sending replay_llm_request', {
        requestId,
        model,
        stream,
        msgCount: messages.length,
      });

      socket.emit('replay_llm_request', {
        requestId,
        model,
        messages,
        temperature:
          typeof opts?.temperature === 'number' ? opts.temperature : 0.7,
        maxTokens: typeof opts?.maxTokens === 'number' ? opts.maxTokens : 512,
        traceId: opts?.traceId ?? null,
        startNodeId,
        stream,
      });

      return requestId;
    },
    []
  );

  return { replayFromNode, result, loading, output };
}

// ============================================================================
// useTraceComparison - Compare two traces
// ============================================================================

import { compareTraces } from '../utils/UtilityFunctions';

export const useTraceComparison = (
  trace1Nodes: Node[] | null,
  trace2Nodes: Node[] | null
) => {
  const [comparison, setComparison] = useState<TraceComparison | null>(null);

  useEffect(() => {
    if (!trace1Nodes || !trace2Nodes) {
      setComparison(null);
      return;
    }

    const result = compareTraces(trace1Nodes, trace2Nodes);
    setComparison(result);
  }, [trace1Nodes, trace2Nodes]);

  return comparison;
};

export default {
  useTraceData,
  useRealtimeUpdates,
  useKeyboardShortcuts,
  useAnomalyDetection,
  useTraceStatistics,
  useLocalStorage,
  useDebounce,
  useNodeSelection,
  useExport,
  useAutoLayout,
  useReplay,
  useTraceComparison,
};
