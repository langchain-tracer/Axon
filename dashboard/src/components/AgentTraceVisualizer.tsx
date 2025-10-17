import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DollarSign,
  Clock,
  Zap,
  TrendingUp,
  Play,
  Network,
  X,
  Edit,
  AlertCircle,
  Maximize2,
  Minimize2,
  ChevronRight,
  List,
  Activity,
  Search,
  RefreshCw,
  Filter,
  Wifi,
  WifiOff
} from "lucide-react";

import { AnalyticsView, TimelineView } from "./AnalyticsComponents";
import { transformTrace } from "../utils/apiAdapter";

// Backend API URL
const BACKEND_URL = "http://localhost:3000";

// Socket.IO client connection
const createSocketConnection = () => {
  // Check if io is available (from socket.io-client CDN)
  if (typeof io === "undefined") {
    console.warn(
      'Socket.IO client not loaded. Add this to your HTML: <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>'
    );
    return null;
  }

  const socket = io(BACKEND_URL, {
    auth: {
      apiKey: "your-api-key",
      projectName: "dashboard"
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  return socket;
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

const AgentTraceViewer = () => {
  const [currentView, setCurrentView] = useState("list");
  const [traces, setTraces] = useState([]);
  const [selectedTrace, setSelectedTrace] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [liveUpdates, setLiveUpdates] = useState(0);

  const socketRef = useRef(null);

  useEffect(() => {
    const socket = createSocketConnection();
    if (!socket) {
      setConnectionError("Socket.IO client not available");
      return;
    }

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to trace server");
      setIsConnected(true);
      setConnectionError(null);
      fetchTraces();
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from trace server");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    socket.on("trace_update", (data) => {
      console.log("📥 Trace update received:", data);
      setLiveUpdates((prev) => prev + 1);
      fetchTraces();
    });

    socket.on("events_received", (data) => {
      console.log(`✅ Events received: ${data.count}`);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
      setConnectionError(error.message);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // In AgentTraceViewer component

  const fetchTraces = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/traces");
      if (!response.ok) throw new Error("Failed to fetch traces");

      const data = await response.json();

      // Transform backend format to frontend format
      const transformedTraces = data.traces.map(transformTrace);

      setTraces(transformedTraces);
    } catch (error) {
      console.error("Error fetching traces:", error);
      // Fallback to mock data
      setTraces(generateMockTraces());
    }
  };

  const handleRefresh = () => {
    fetchTraces();
    setLiveUpdates((prev) => prev + 1);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        fetchTraces();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const projects = useMemo(() => {
    return [...new Set(traces.map((t) => t.project))];
  }, [traces]);

  const filteredTraces = useMemo(() => {
    return traces.filter((trace) => {
      const matchesSearch =
        trace.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trace.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject =
        filterProject === "all" || trace.project === filterProject;
      const matchesStatus =
        filterStatus === "all" || trace.status === filterStatus;

      return matchesSearch && matchesProject && matchesStatus;
    });
  }, [traces, searchQuery, filterProject, filterStatus]);

  const overallStats = useMemo(
    () => ({
      totalTraces: traces.length,
      totalCost: traces.reduce((sum, t) => sum + (t.cost || 0), 0),
      avgLatency:
        traces.length > 0
          ? traces.reduce((sum, t) => sum + (t.latency || 0), 0) / traces.length
          : 0,
      completedTraces: traces.filter((t) => t.status === "complete").length,
      runningTraces: traces.filter((t) => t.status === "running").length,
      failedTraces: traces.filter(
        (t) => t.status === "error" || t.status === "failed"
      ).length
    }),
    [traces]
  );

  const handleTraceClick = (trace) => {
    setSelectedTrace(trace);
    setCurrentView("trace");
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "complete":
        return "text-green-400 bg-green-500/20";
      case "running":
        return "text-yellow-400 bg-yellow-500/20";
      case "error":
      case "failed":
        return "text-red-400 bg-red-500/20";
      default:
        return "text-slate-400 bg-slate-500/20";
    }
  };

  if (currentView === "trace" && selectedTrace) {
    return (
      <TraceDetailView
        trace={selectedTrace}
        socket={socketRef.current}
        isConnected={isConnected}
        onBack={() => {
          setCurrentView("list");
          setSelectedTrace(null);
        }}
      />
    );
  }

  return (
    <div className="w-full h-screen bg-slate-950 text-white flex flex-col">
      <div className="bg-slate-900 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Network className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold">Agent Trace Dashboard</h1>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                isConnected
                  ? "bg-green-900/30 border border-green-500/30"
                  : "bg-red-900/30 border border-red-500/30"
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">Disconnected</span>
                </>
              )}
            </div>
            {liveUpdates > 0 && (
              <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-500/30 px-3 py-1 rounded-lg">
                <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
                <span className="text-sm text-blue-400">
                  {liveUpdates} updates
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-xs">
              <div className="bg-slate-800 px-3 py-2 rounded-lg">
                <span className="text-slate-400">Total: </span>
                <span className="font-bold">{overallStats.totalTraces}</span>
              </div>
              <div className="bg-slate-800 px-3 py-2 rounded-lg">
                <span className="text-slate-400">Running: </span>
                <span className="font-bold text-yellow-400">
                  {overallStats.runningTraces}
                </span>
              </div>
              <div className="bg-slate-800 px-3 py-2 rounded-lg">
                <span className="text-slate-400">Avg Latency: </span>
                <span className="font-bold">
                  {(overallStats.avgLatency / 1000).toFixed(2)}s
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded-lg font-bold">
              <DollarSign className="w-4 h-4" />
              <span>${overallStats.totalCost.toFixed(4)}</span>
            </div>
          </div>
        </div>
        {connectionError && (
          <div className="mt-3 bg-red-900/20 border border-red-500 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">
              Connection Error: {connectionError}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search traces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Projects</option>
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="complete">Complete</option>
            <option value="running">Running</option>
            <option value="error">Failed</option>
          </select>
          <button
            onClick={handleRefresh}
            className="bg-slate-800 border border-slate-700 rounded-lg p-2 hover:bg-slate-700 transition-colors"
            title="Refresh traces"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 text-sm text-slate-400">
            Showing {filteredTraces.length} of {traces.length} traces
          </div>
          <div className="space-y-3">
            {filteredTraces.map((trace) => (
              <div
                key={trace.id}
                onClick={() => handleTraceClick(trace)}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:bg-slate-700 hover:border-blue-500 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="font-bold text-lg">{trace.id}</div>
                      <div
                        className={`text-xs px-2 py-1 rounded font-bold ${getStatusColor(
                          trace.status
                        )}`}
                      >
                        {trace.status?.toUpperCase() || "UNKNOWN"}
                      </div>
                      <div className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                        {trace.project || "default"}
                      </div>
                    </div>
                    <div className="text-sm text-slate-300 mb-3">
                      {trace.description || "No description"}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span>{formatTimestamp(trace.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Activity className="w-4 h-4" />
                        <span>{trace.nodeCount || 0} nodes</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Zap className="w-4 h-4" />
                        <span>{((trace.latency || 0) / 1000).toFixed(2)}s</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-400">
                        <DollarSign className="w-4 h-4" />
                        <span>${(trace.cost || 0).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
          {filteredTraces.length === 0 && (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <div className="text-lg font-bold text-slate-400 mb-2">
                No traces found
              </div>
              <div className="text-sm text-slate-500">
                {traces.length === 0
                  ? "Waiting for traces... Make sure your agent is sending events to the backend."
                  : "Try adjusting your filters or search query"}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="bg-slate-900 border-t border-slate-700 p-4">
        <div className="grid grid-cols-5 gap-4 text-center text-sm">
          <div>
            <div className="text-xs text-slate-400 mb-1">Total Traces</div>
            <div className="text-lg font-bold">{overallStats.totalTraces}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Completed</div>
            <div className="text-lg font-bold text-green-400">
              {overallStats.completedTraces}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Running</div>
            <div className="text-lg font-bold text-yellow-400">
              {overallStats.runningTraces}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Failed</div>
            <div className="text-lg font-bold text-red-400">
              {overallStats.failedTraces}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Total Cost</div>
            <div className="text-lg font-bold text-green-400">
              ${overallStats.totalCost.toFixed(4)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TRACE DETAIL VIEW COMPONENT
// ============================================================================

const TraceDetailView = ({ trace, socket, isConnected, onBack }) => {
  const [viewMode, setViewMode] = useState("graph");
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveEvents, setLiveEvents] = useState([]);
  const [traceData, setTraceData] = useState(trace);

  useEffect(() => {
    const fetchTraceDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${BACKEND_URL}/api/traces/${trace.id}`);
        if (!response.ok) throw new Error("Failed to fetch trace details");

        const data = await response.json();
        setTraceData(data.trace);
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setAnomalies(data.anomalies || []);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching trace details:", error);
        setLoading(false);
      }
    };

    fetchTraceDetails();
  }, [trace.id]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log(`👀 Watching trace: ${trace.id}`);
    socket.emit("watch_trace", trace.id);

    const handleNewEvent = (event) => {
      console.log("📥 New event received:", event);
      setLiveEvents((prev) => [...prev, event]);

      fetch(`${BACKEND_URL}/api/traces/${trace.id}`)
        .then((res) => res.json())
        .then((data) => {
          setNodes(data.nodes || []);
          setTraceData(data.trace);
        })
        .catch(console.error);
    };

    const handleTraceData = (data) => {
      console.log("📊 Trace data updated:", data);
      if (data.trace) setTraceData(data.trace);
      if (data.nodes) setNodes(data.nodes);
      if (data.edges) setEdges(data.edges);
    };

    socket.on("new_event", handleNewEvent);
    socket.on("trace_data", handleTraceData);

    return () => {
      console.log(`👋 Stopped watching trace: ${trace.id}`);
      socket.emit("unwatch_trace", trace.id);
      socket.off("new_event", handleNewEvent);
      socket.off("trace_data", handleTraceData);
    };
  }, [socket, isConnected, trace.id]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const getTypeColor = (type) => {
    switch (type) {
      case "llm":
        return {
          border: "border-blue-500",
          bg: "bg-blue-500/10",
          text: "text-blue-400"
        };
      case "tool":
        return {
          border: "border-green-500",
          bg: "bg-green-500/10",
          text: "text-green-400"
        };
      case "chain":
      case "decision":
        return {
          border: "border-purple-500",
          bg: "bg-purple-500/10",
          text: "text-purple-400"
        };
      default:
        return {
          border: "border-slate-500",
          bg: "bg-slate-500/10",
          text: "text-slate-400"
        };
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
          <div className="text-lg font-bold">Loading trace details...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-950 text-white flex flex-col">
      <div className="bg-slate-900 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <Network className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold">{traceData.id}</h1>
              <div className="text-sm text-slate-400">
                {traceData.project || "default"}
              </div>
            </div>
            {liveEvents.length > 0 && (
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/30 px-3 py-1 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-400">
                  {liveEvents.length} new events
                </span>
              </div>
            )}
            {anomalies.length > 0 && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">
                  {anomalies.length} anomalies
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("graph")}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  viewMode === "graph"
                    ? "bg-blue-600"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                Graph
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  viewMode === "timeline"
                    ? "bg-blue-600"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode("analytics")}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  viewMode === "analytics"
                    ? "bg-blue-600"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                Analytics
              </button>
            </div>
            <div className="bg-green-600 px-4 py-2 rounded-lg font-bold">
              ${(traceData.cost || 0).toFixed(4)}
            </div>
          </div>
        </div>
      </div>

      {viewMode === "timeline" && <TimelineView nodes={nodes} />}
      {viewMode === "analytics" && <AnalyticsView nodes={nodes} />}

      {viewMode === "graph" && (
        <div className="flex-1 relative bg-slate-950 overflow-hidden flex">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
              className="bg-slate-800 border border-slate-700 p-2 rounded hover:bg-slate-700"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
              className="bg-slate-800 border border-slate-700 p-2 rounded hover:bg-slate-700"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="bg-slate-800 border border-slate-700 px-3 py-2 rounded hover:bg-slate-700 text-sm"
            >
              Reset
            </button>
          </div>
          <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden">
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
            >
              <div
                className="relative"
                style={{ width: "900px", height: "700px" }}
              >
                {nodes.map((node) => {
                  const colors = getTypeColor(node.type);
                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="absolute cursor-pointer transition-transform hover:scale-105"
                      style={{ left: node.x, top: node.y, width: "180px" }}
                    >
                      <div
                        className={`px-4 py-3 rounded-lg border-2 ${
                          colors.border
                        } ${colors.bg} bg-slate-800 ${
                          selectedNodeId === node.id
                            ? "ring-2 ring-blue-400"
                            : ""
                        } ${node.hasLoop ? "ring-2 ring-red-500" : ""}`}
                      >
                        <div className="font-bold text-sm mb-2 text-center">
                          {node.label}
                        </div>
                        <div
                          className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text} text-center mb-2 font-bold`}
                        >
                          {node.type.toUpperCase()}
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center justify-center gap-1 text-green-400">
                            <DollarSign className="w-3 h-3" />
                            <span>${(node.cost || 0).toFixed(4)}</span>
                          </div>
                          <div className="flex items-center justify-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>
                              {((node.latency || 0) / 1000).toFixed(2)}s
                            </span>
                          </div>
                        </div>
                        {node.hasLoop && (
                          <div className="mt-2 text-xs text-red-400 text-center font-bold">
                            ⚠️ Loop
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {selectedNode && (
            <div className="w-96 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">{selectedNode.label}</h3>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="p-1 hover:bg-slate-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Type</div>
                  <div className="font-bold">
                    {selectedNode.type.toUpperCase()}
                  </div>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Cost</div>
                  <div className="font-bold text-green-400">
                    ${(selectedNode.cost || 0).toFixed(4)}
                  </div>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Latency</div>
                  <div className="font-bold">
                    {((selectedNode.latency || 0) / 1000).toFixed(2)}s
                  </div>
                </div>
                {selectedNode.tokens && (
                  <>
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">
                        Input Tokens
                      </div>
                      <div className="font-bold">
                        {selectedNode.tokens.input || 0}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">
                        Output Tokens
                      </div>
                      <div className="font-bold">
                        {selectedNode.tokens.output || 0}
                      </div>
                    </div>
                  </>
                )}
                {selectedNode.type === "llm" && selectedNode.prompt && (
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-2">Prompt</div>
                    <div className="text-xs font-mono bg-slate-950 p-2 rounded max-h-32 overflow-y-auto">
                      {selectedNode.prompt}
                    </div>
                  </div>
                )}
                {selectedNode.type === "llm" && selectedNode.response && (
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-2">Response</div>
                    <div className="text-xs font-mono bg-slate-950 p-2 rounded max-h-32 overflow-y-auto">
                      {selectedNode.response}
                    </div>
                  </div>
                )}
                {selectedNode.type === "tool" && selectedNode.toolName && (
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Tool Name</div>
                    <div className="font-bold">{selectedNode.toolName}</div>
                  </div>
                )}
                {selectedNode.type === "tool" && selectedNode.toolParams && (
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-2">
                      Parameters
                    </div>
                    <div className="text-xs font-mono bg-slate-950 p-2 rounded max-h-32 overflow-y-auto">
                      {JSON.stringify(selectedNode.toolParams, null, 2)}
                    </div>
                  </div>
                )}
                {selectedNode.error && (
                  <div className="bg-red-900/20 border border-red-500 rounded-lg p-3">
                    <div className="text-xs text-red-400 mb-2 font-bold">
                      Error
                    </div>
                    <div className="text-xs text-slate-300">
                      {selectedNode.error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentTraceViewer;
