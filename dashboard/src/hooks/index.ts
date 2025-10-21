// src/hooks/index.ts
// Custom React hooks for Agent Trace Visualizer

import { useState, useEffect, useCallback, useRef } from "react";
import { Node, Edge } from "reactflow";
import { io, Socket } from "socket.io-client";
import type {
  UseTraceDataOptions,
  UseAnomalyDetectionOptions,
  TraceStatistics,
  Anomaly,
  ReplayResult,
  TraceComparison,
  LayoutType,
  FilterCriteria
} from "../types";

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
      console.log(data, 'data/n/n/n/n');
      console.log(data.nodes, 'data.nodes/n/n/n/n');
      console.log(data.edges, 'data.edges/n/n/n/n');

      // Convert backend format to ReactFlow format
      const flowNodes: Node[] = data.nodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        position: { x: 0, y: 0 }, // Will be layouted
        data: node
      }));

      const flowEdges: Edge[] = data.edges.map((edge: any, index: number) => ({
        id: `e${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching trace:", err);
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

  return { nodes, edges, loading, error, refetch: fetchTrace };
};

// ============================================================================
// useRealtimeUpdates - WebSocket connection for live updates
// ============================================================================

interface RealtimeUpdate {
  type: "node_start" | "node_complete" | "node_error" | "trace_complete";
  traceId: string;
  nodeId?: string;
  data?: any;
  timestamp?: number;
}

export const useRealtimeUpdates = (traceId: string | null) => {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);
  const wsRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<number>();

  const connect = useCallback(() => {
    if (!traceId) return;

    const socket = io("http://localhost:3000", {
      auth: {
        projectName: "dashboard"
      }
    });
    wsRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket.IO connected:", socket.id);
      setConnected(true);

      // Subscribe to trace updates
      socket.emit("watch_trace", traceId);
    });

    socket.on("trace_data", (data) => {
      setLastUpdate({
        type: "trace_complete",
        traceId: traceId,
        timestamp: Date.now(),
        data: data
      });
    });

    socket.on("new_event", (event) => {
      setLastUpdate({
        type: "node_complete",
        traceId: traceId,
        timestamp: Date.now(),
        data: event
      });
    });

    socket.on("disconnect", () => {
      console.log("Socket.IO disconnected");
      setConnected(false);

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connect();
      }, 3000);
    });

    return () => {
      socket.disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [traceId]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

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
      const key = `${e.ctrlKey || e.metaKey ? "ctrl+" : ""}${
        e.shiftKey ? "shift+" : ""
      }${e.key}`;

      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handlers]);
};

// ============================================================================
// useAnomalyDetection - Detect anomalies in trace
// ============================================================================

import { AnomalyDetector, Anomaly as DetectionAnomaly } from "../utils/AnomalyDetection";

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
  const { enabled = true, config, budgets } = options;
  const [anomalies, setAnomalies] = useState<DetectionAnomaly[]>([]);

  useEffect(() => {
    if (!enabled || nodes.length === 0) {
      setAnomalies([]);
      return;
    }

    const detector = new AnomalyDetector(nodes, []);
    const result = detector.detectAnomalies();
    setAnomalies(result.anomalies);
  }, [nodes, enabled, config, budgets]);

  const dismissAnomaly = useCallback((anomalyId: string) => {
    setAnomalies((prev) => prev.filter((a) => a.id !== anomalyId));
  }, []);

  const highSeverityCount = anomalies.filter(
    (a) => a.severity === "high"
  ).length;
  const mediumSeverityCount = anomalies.filter(
    (a) => a.severity === "medium"
  ).length;

  return {
    anomalies,
    dismissAnomaly,
    highSeverityCount,
    mediumSeverityCount,
    hasAnomalies: anomalies.length > 0
  };
};

// ============================================================================
// useTraceStatistics - Calculate trace statistics
// ============================================================================

import {
  calculateStatistics,
} from "../utils/UtilityFunctions";

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
      console.error("Error reading from localStorage:", error);
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
        console.error("Error writing to localStorage:", error);
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
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

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
    canGoBack: selectionHistory.length > 1
  };
};

// ============================================================================
// useExport - Handle exports
// ============================================================================

import {
  exportToJSON,
  exportToCSV,
  exportGraphAsImage,
  downloadFile
} from "../utils/UtilityFunctions";

export const useExport = (nodes: Node[], edges: Edge[]) => {
  const [exporting, setExporting] = useState(false);

  const exportData = useCallback(
    async (format: "json" | "csv" | "png" | "svg") => {
      setExporting(true);

      try {
        switch (format) {
          case "json":
            const jsonData = exportToJSON(nodes, edges, {
              includeMetadata: true
            });
            downloadFile(
              jsonData,
              `trace-${Date.now()}.json`,
              "application/json"
            );
            break;

          case "csv":
            const csvData = exportToCSV(nodes);
            downloadFile(csvData, `trace-${Date.now()}.csv`, "text/csv");
            break;

          case "png":
          case "svg":
            await exportGraphAsImage(format, `trace-${Date.now()}.${format}`);
            break;
        }
      } catch (error) {
        console.error("Export failed:", error);
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

import { applyLayout } from "../utils/LayoutAlgorithms";

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

// ============================================================================
// useReplay - Handle replay functionality
// ============================================================================


export const useReplay = () => {
  const [replaying, setReplaying] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);

  const replayFromNode = useCallback(
    async (
      traceId: string,
      nodeId: string,
      modifications: {
        prompt?: string;
        toolParams?: Record<string, any>;
        systemMessage?: string;
      }
    ) => {
      setReplaying(true);
      setResult(null);

      try {
        const response = await fetch("/api/replay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ traceId, nodeId, modifications })
        });

        if (!response.ok) {
          throw new Error("Replay failed");
        }

        const data = await response.json();
        setResult(data);
        return data;
      } catch (error) {
        console.error("Replay error:", error);
        throw error;
      } finally {
        setReplaying(false);
      }
    },
    []
  );

  return {
    replayFromNode,
    replaying,
    result,
    clearResult: () => setResult(null)
  };
};

// ============================================================================
// useTraceComparison - Compare two traces
// ============================================================================

import { compareTraces } from "../utils/UtilityFunctions";

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
  useTraceComparison
};
