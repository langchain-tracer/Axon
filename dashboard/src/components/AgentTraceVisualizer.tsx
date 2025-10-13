import React, { useState } from "react";
import { 
  DollarSign, 
  Clock, 
  Zap, 
  TrendingUp, 
  Play,
  Network,
  Maximize2,
  Minimize2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from "recharts";

// ============================================================================
// TYPES
// ============================================================================

interface TraceNodeData {
  label: string;
  type: "llm" | "tool" | "decision";
  cost: number;
  tokens?: { input: number; output: number };
  latency: number;
  status: "complete" | "running" | "error" | "pending";
  timestamp: number;
  prompt?: string;
  response?: string;
  toolParams?: any;
  x: number;
  y: number;
}

interface NodeConnection {
  from: string;
  to: string;
}

type ViewMode = "graph" | "timeline" | "analytics" | "replay";

// ============================================================================
// MOCK DATA
// ============================================================================

const generateMockData = () => {
  const baseTime = Date.now();
  
  const nodes: Record<string, TraceNodeData> = {
    "1": {
      label: "Initial Query",
      type: "llm",
      cost: 0.0023,
      tokens: { input: 150, output: 50 },
      latency: 1200,
      status: "complete",
      timestamp: baseTime,
      prompt: "What is the weather in San Francisco?",
      response: "I'll check the weather for you.",
      x: 400,
      y: 50
    },
    "2": {
      label: "Weather API Call",
      type: "tool",
      cost: 0.0001,
      latency: 450,
      status: "complete",
      timestamp: baseTime + 1200,
      toolParams: { location: "San Francisco" },
      x: 200,
      y: 180
    },
    "3": {
      label: "Parse Response",
      type: "decision",
      cost: 0.0008,
      tokens: { input: 200, output: 100 },
      latency: 800,
      status: "complete",
      timestamp: baseTime + 1650,
      x: 600,
      y: 180
    },
    "4": {
      label: "Format Output",
      type: "llm",
      cost: 0.0042,
      tokens: { input: 300, output: 250 },
      latency: 1500,
      status: "complete",
      timestamp: baseTime + 2450,
      prompt: "Format the weather data nicely",
      response: "The weather in San Francisco is 68°F and sunny.",
      x: 400,
      y: 310
    },
    "5": {
      label: "Save to Cache",
      type: "tool",
      cost: 0.0001,
      latency: 200,
      status: "complete",
      timestamp: baseTime + 3950,
      x: 250,
      y: 440
    },
    "6": {
      label: "Log Analytics",
      type: "tool",
      cost: 0.0001,
      latency: 150,
      status: "complete",
      timestamp: baseTime + 4150,
      x: 550,
      y: 440
    }
  };

  const connections: NodeConnection[] = [
    { from: "1", to: "2" },
    { from: "1", to: "3" },
    { from: "2", to: "4" },
    { from: "3", to: "4" },
    { from: "4", to: "5" },
    { from: "4", to: "6" }
  ];

  return { nodes, connections };
};

// ============================================================================
// GRAPH VIEW
// ============================================================================

const GraphView: React.FC<{ 
  nodes: Record<string, TraceNodeData>;
  connections: NodeConnection[];
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
}> = ({ nodes, connections, selectedNode, onNodeClick }) => {
  const [zoom, setZoom] = useState(1);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "llm": return { border: "border-blue-500", bg: "bg-blue-500/10", line: "#3b82f6" };
      case "tool": return { border: "border-green-500", bg: "bg-green-500/10", line: "#10b981" };
      case "decision": return { border: "border-purple-500", bg: "bg-purple-500/10", line: "#a855f7" };
      default: return { border: "border-slate-500", bg: "bg-slate-500/10", line: "#64748b" };
    }
  };

  return (
    <div className="h-full relative bg-slate-950 overflow-hidden">
      {/* Zoom Controls */}
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

      {/* Graph Canvas */}
      <div className="w-full h-full flex items-center justify-center overflow-auto">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
          <svg width="900" height="550" className="relative">
            {/* Grid Background */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#334155" />
              </pattern>
            </defs>
            <rect width="900" height="550" fill="url(#grid)" />

            {/* Connections */}
            {connections.map((conn, idx) => {
              const fromNode = nodes[conn.from];
              const toNode = nodes[conn.to];
              const color = getTypeColor(fromNode.type).line;
              
              return (
                <g key={idx}>
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y + 40}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.6"
                  />
                  <circle
                    cx={toNode.x}
                    cy={toNode.y}
                    r="4"
                    fill={color}
                  />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {Object.entries(nodes).map(([id, node]) => {
              const colors = getTypeColor(node.type);
              const isSelected = selectedNode === id;
              
              return (
                <div
                  key={id}
                  className="absolute pointer-events-auto cursor-pointer transition-transform hover:scale-105"
                  style={{
                    left: node.x - 100,
                    top: node.y,
                    width: '200px'
                  }}
                  onClick={() => onNodeClick(id)}
                >
                  <div className={`
                    px-4 py-3 rounded-lg border-2 ${colors.border} ${colors.bg} bg-slate-800
                    ${isSelected ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-500/50' : ''}
                  `}>
                    <div className="font-bold text-sm mb-2">{node.label}</div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2 text-green-400">
                        <DollarSign className="w-3 h-3" />
                        <span>${node.cost.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{(node.latency / 1000).toFixed(2)}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TIMELINE VIEW
// ============================================================================

const TimelineView: React.FC<{ nodes: Record<string, TraceNodeData> }> = ({ nodes }) => {
  const sortedNodes = Object.entries(nodes).sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );

  const startTime = sortedNodes[0]?.[1].timestamp || 0;
  const timeline = sortedNodes.map(([id, node], index) => {
    const relativeTime = ((node.timestamp - startTime) / 1000).toFixed(1);
    const duration = (node.latency / 1000).toFixed(1);
    const nextNode = sortedNodes[index + 1];
    const gap = nextNode
      ? ((nextNode[1].timestamp - node.timestamp - node.latency) / 1000).toFixed(1)
      : "0";

    return { id, node, relativeTime, duration, gap };
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Timeline View</h2>
        <div className="text-sm text-slate-400">
          Total Duration:{" "}
          {(
            (sortedNodes[sortedNodes.length - 1]?.[1].timestamp - startTime + 
             sortedNodes[sortedNodes.length - 1]?.[1].latency) / 1000
          ).toFixed(1)}s
        </div>
      </div>

      <div className="space-y-2">
        {timeline.map(({ id, node, relativeTime, duration, gap }) => (
          <div key={id}>
            <div className="flex items-center gap-4">
              <div className="w-20 text-sm text-slate-400 font-mono text-right">
                {relativeTime}s
              </div>

              <div
                className={`w-3 h-3 rounded-full ${
                  node.type === "llm"
                    ? "bg-blue-500"
                    : node.type === "tool"
                    ? "bg-green-500"
                    : "bg-purple-500"
                }`}
              />

              <div className="flex-1 bg-slate-800 rounded-lg p-4 hover:bg-slate-700 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-bold">{node.label}</div>
                    <div
                      className={`text-xs px-2 py-0.5 rounded ${
                        node.type === "llm"
                          ? "bg-blue-500/20 text-blue-400"
                          : node.type === "tool"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-purple-500/20 text-purple-400"
                      }`}
                    >
                      {node.type.toUpperCase()}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>{duration}s</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-400">
                      <DollarSign className="w-4 h-4" />
                      <span>${node.cost.toFixed(4)}</span>
                    </div>
                    {node.tokens && (
                      <div className="text-slate-400 text-xs">
                        {(node.tokens.input + node.tokens.output).toLocaleString()} tokens
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {Number(gap) > 0.1 && (
              <div className="flex items-center gap-4 my-1">
                <div className="w-20" />
                <div className="w-3 flex justify-center">
                  <div className="w-0.5 h-4 bg-slate-600" />
                </div>
                <div className="text-xs text-slate-500 italic">{gap}s gap</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ANALYTICS VIEW
// ============================================================================

const AnalyticsView: React.FC<{ nodes: Record<string, TraceNodeData> }> = ({ nodes }) => {
  const nodeArray = Object.values(nodes);
  
  const stats = {
    totalCost: nodeArray.reduce((sum, n) => sum + n.cost, 0),
    totalTokens: nodeArray.reduce(
      (sum, n) => sum + ((n.tokens?.input || 0) + (n.tokens?.output || 0)),
      0
    ),
    totalLatency: nodeArray.reduce((sum, n) => sum + n.latency, 0),
    avgLatency: nodeArray.reduce((sum, n) => sum + n.latency, 0) / nodeArray.length
  };

  const costByType = [
    {
      type: "LLM Calls",
      cost: nodeArray.filter((n) => n.type === "llm").reduce((sum, n) => sum + n.cost, 0),
      count: nodeArray.filter((n) => n.type === "llm").length
    },
    {
      type: "Tool Calls",
      cost: nodeArray.filter((n) => n.type === "tool").reduce((sum, n) => sum + n.cost, 0),
      count: nodeArray.filter((n) => n.type === "tool").length
    },
    {
      type: "Decisions",
      cost: nodeArray.filter((n) => n.type === "decision").reduce((sum, n) => sum + n.cost, 0),
      count: nodeArray.filter((n) => n.type === "decision").length
    }
  ];

  const topExpensive = [...nodeArray]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
    .map((n) => ({
      name: n.label,
      cost: n.cost,
      percentage: ((n.cost / stats.totalCost) * 100).toFixed(1)
    }));

  const COLORS = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444"];

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-bold mb-6">Cost & Performance Analytics</h2>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <div className="text-sm text-slate-400">Total Cost</div>
          </div>
          <div className="text-3xl font-bold text-green-400">
            ${stats.totalCost.toFixed(4)}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <div className="text-sm text-slate-400">Total Tokens</div>
          </div>
          <div className="text-3xl font-bold">
            {stats.totalTokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <div className="text-sm text-slate-400">Avg Latency</div>
          </div>
          <div className="text-3xl font-bold">
            {(stats.avgLatency / 1000).toFixed(2)}s
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <div className="text-sm text-slate-400">Total Nodes</div>
          </div>
          <div className="text-3xl font-bold">{nodeArray.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold mb-4">Cost Distribution by Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={costByType}
                dataKey="cost"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.type}: $${entry.cost.toFixed(4)}`}
              >
                {costByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold mb-4">Most Expensive Operations</h3>
          <div className="space-y-3">
            {topExpensive.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-slate-400">{item.percentage}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-end px-2 text-xs font-bold"
                    style={{ width: `${item.percentage}%` }}
                  >
                    ${item.cost.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Zap className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-blue-400 mb-2">
              Optimization Suggestions
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-semibold mb-1">💰 Cost Optimization</div>
                <div className="text-slate-300">
                  {topExpensive[0]?.name} accounts for {topExpensive[0]?.percentage}% of total cost. 
                  Consider reducing output tokens or caching results.
                </div>
                <div className="text-green-400 font-semibold mt-1">
                  Potential savings: ${(stats.totalCost * 0.3).toFixed(4)} (30%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// REPLAY STUDIO
// ============================================================================

const ReplayStudio: React.FC<{ node: TraceNodeData }> = ({ node }) => {
  const [editedPrompt, setEditedPrompt] = useState(node.prompt || "");
  const [replayResults, setReplayResults] = useState<any>(null);

  const handleReplay = () => {
    setReplayResults({
      originalCost: node.cost,
      newCost: node.cost * 0.7,
      nodesAffected: 5,
      estimatedTime: 3.2
    });
  };

  return (
    <div className="bg-slate-900 rounded-xl border-2 border-slate-700 overflow-hidden">
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <h3 className="text-xl font-bold">Replay from: {node.label}</h3>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-700">
        <div className="p-6">
          <h4 className="text-lg font-bold mb-4 text-slate-400">Original</h4>
          {node.type === "llm" && node.prompt && (
            <div className="mb-4">
              <div className="text-sm font-bold mb-2">Prompt</div>
              <div className="bg-slate-800 rounded-lg p-4 font-mono text-xs h-32 overflow-y-auto border border-slate-700">
                {node.prompt}
              </div>
            </div>
          )}
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-sm mb-2">
              Cost: <span className="text-red-400 font-bold">${node.cost.toFixed(4)}</span>
            </div>
            <div className="text-sm">
              Latency: {(node.latency / 1000).toFixed(2)}s
            </div>
          </div>
        </div>

        <div className="p-6">
          <h4 className="text-lg font-bold mb-4 text-blue-400">Modified</h4>
          {node.type === "llm" && (
            <div className="mb-4">
              <div className="text-sm font-bold mb-2">Prompt (Editable)</div>
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="w-full bg-slate-800 rounded-lg p-4 font-mono text-xs h-32 border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          )}

          {replayResults && (
            <div className="bg-slate-800 rounded-lg p-4 border-2 border-green-500">
              <div className="text-sm font-bold mb-3 text-green-400">Replay Results</div>
              <div className="space-y-2 text-sm">
                <div>
                  Savings: ${(replayResults.originalCost - replayResults.newCost).toFixed(4)} (30%)
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleReplay}
            disabled={!editedPrompt || editedPrompt === node.prompt}
            className="w-full mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-5 h-5" />
            {replayResults ? "Replay Again" : "Start Replay"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AgentTraceVisualizer: React.FC = () => {
  const { nodes, connections } = generateMockData();
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null;

  return (
    <div className="w-full h-screen bg-slate-950 text-white flex flex-col">
      <div className="bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Network className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">Agent Trace Visualizer</h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("graph")}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
              viewMode === "graph" ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            Graph
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
              viewMode === "timeline" ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode("analytics")}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
              viewMode === "analytics" ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setViewMode("replay")}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
              viewMode === "replay" ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            Replay
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {viewMode === "graph" && (
          <GraphView 
            nodes={nodes} 
            connections={connections}
            selectedNode={selectedNodeId}
            onNodeClick={setSelectedNodeId}
          />
        )}

        {viewMode === "timeline" && <TimelineView nodes={nodes} />}

        {viewMode === "analytics" && <AnalyticsView nodes={nodes} />}

        {viewMode === "replay" && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">Replay Studio</h2>
            {selectedNode ? (
              <ReplayStudio node={selectedNode} />
            ) : (
              <div className="text-center text-slate-400 py-12">
                Select a node from the graph view to start replay
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentTraceVisualizer;