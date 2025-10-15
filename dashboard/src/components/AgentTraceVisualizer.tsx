import React, { useState, useMemo } from "react";
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
  ChevronRight
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

import { TimelineView, AnalyticsView } from "./AnalyticsComponents";

const AgentTraceVisualizer = () => {
  const [viewMode, setViewMode] = useState("graph"); // 'graph', 'timeline', 'analytics'
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [sidebarView, setSidebarView] = useState("details");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [replayResults, setReplayResults] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const baseTime = Date.now();

  const nodes = [
    {
      id: "1",
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
    {
      id: "2",
      label: "Weather API Call",
      type: "tool",
      cost: 0.0001,
      latency: 450,
      status: "complete",
      timestamp: baseTime + 1200,
      toolParams: { location: "San Francisco" },
      x: 200,
      y: 200
    },
    {
      id: "3",
      label: "Parse Response",
      type: "decision",
      cost: 0.0008,
      tokens: { input: 200, output: 100 },
      latency: 800,
      status: "complete",
      timestamp: baseTime + 1650,
      x: 600,
      y: 200
    },
    {
      id: "4",
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
      y: 350
    },
    {
      id: "5",
      label: "Save to Cache",
      type: "tool",
      cost: 0.0001,
      latency: 200,
      status: "running",
      timestamp: baseTime + 3950,
      x: 250,
      y: 500
    },
    {
      id: "6",
      label: "Log Analytics",
      type: "tool",
      cost: 0.0001,
      latency: 150,
      status: "pending",
      timestamp: baseTime + 4150,
      hasLoop: true,
      x: 550,
      y: 500
    }
  ];

  const edges = [
    { from: "1", to: "2" },
    { from: "1", to: "3" },
    { from: "2", to: "4" },
    { from: "3", to: "4" },
    { from: "4", to: "5" },
    { from: "4", to: "6" }
  ];

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const stats = useMemo(
    () => ({
      totalCost: nodes.reduce((sum, n) => sum + n.cost, 0),
      totalNodes: nodes.length,
      llmCount: nodes.filter((n) => n.type === "llm").length,
      toolCount: nodes.filter((n) => n.type === "tool").length,
      avgLatency: nodes.reduce((sum, n) => sum + n.latency, 0) / nodes.length
    }),
    [nodes]
  );

  const getTypeColor = (type) => {
    switch (type) {
      case "llm":
        return {
          border: "border-blue-500",
          bg: "bg-blue-500/10",
          line: "#3b82f6",
          text: "text-blue-400"
        };
      case "tool":
        return {
          border: "border-green-500",
          bg: "bg-green-500/10",
          line: "#10b981",
          text: "text-green-400"
        };
      case "decision":
        return {
          border: "border-purple-500",
          bg: "bg-purple-500/10",
          line: "#a855f7",
          text: "text-purple-400"
        };
      default:
        return {
          border: "border-slate-500",
          bg: "bg-slate-500/10",
          line: "#64748b",
          text: "text-slate-400"
        };
    }
  };

  const handleReplay = () => {
    setReplayResults({
      originalCost: selectedNode.cost,
      newCost: selectedNode.cost * 0.7,
      nodesAffected: 5,
      estimatedTime: 3.2
    });
  };

  const handleNodeClick = (node) => {
    setSelectedNodeId(node.id);
    setEditedPrompt(node.prompt || "");
    setSidebarView("details");
    setReplayResults(null);
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === "svg") {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Network className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">Agent Trace Visualizer</h1>
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* View Mode Tabs */}
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

          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg">
              <span className="text-slate-400">Nodes:</span>
              <span className="font-bold">{stats.totalNodes}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg">
              <span className="text-slate-400">Latency:</span>
              <span className="font-bold">
                {(stats.avgLatency / 1000).toFixed(2)}s
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded-lg font-bold">
            <DollarSign className="w-4 h-4" />
            <span>${stats.totalCost.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === "timeline" && <TimelineView nodes={nodes} />}

        {viewMode === "analytics" && <AnalyticsView nodes={nodes} />}

        {viewMode === "graph" && (
          <>
            {/* Graph View */}
            <div className="flex-1 relative bg-slate-950 overflow-hidden">
              {/* Zoom Controls */}
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button
                  onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
                  className="bg-slate-800 border border-slate-700 p-2 rounded hover:bg-slate-700 transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
                  className="bg-slate-800 border border-slate-700 p-2 rounded hover:bg-slate-700 transition-colors"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setZoom(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="bg-slate-800 border border-slate-700 px-3 py-2 rounded hover:bg-slate-700 text-sm transition-colors"
                >
                  Reset
                </button>
              </div>

              {/* Anomaly Alert */}
              {nodes.some((n) => n.hasLoop) && (
                <div className="absolute top-4 left-4 max-w-lg z-10">
                  <div className="bg-red-900/90 backdrop-blur border-2 border-red-500 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-red-400 mb-1">
                        Loop Detected!
                      </div>
                      <div className="text-sm text-slate-200">
                        API call repeated multiple times with identical
                        parameters.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Graph Canvas */}
              <div
                className="w-full h-full flex items-center justify-center overflow-hidden"
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  style={{
                    transform: `scale(${zoom}) translate(${
                      panOffset.x / zoom
                    }px, ${panOffset.y / zoom}px)`,
                    transformOrigin: "center",
                    transition: isDragging ? "none" : "transform 0.1s ease-out"
                  }}
                >
                  <svg width="900" height="600" className="relative">
                    {/* Grid Background */}
                    <defs>
                      <pattern
                        id="grid"
                        width="20"
                        height="20"
                        patternUnits="userSpaceOnUse"
                      >
                        <circle cx="1" cy="1" r="1" fill="#334155" />
                      </pattern>
                    </defs>
                    <rect width="900" height="600" fill="url(#grid)" />

                    {/* Edges */}
                    {edges.map((conn, idx) => {
                      const fromNode = nodes.find((n) => n.id === conn.from);
                      const toNode = nodes.find((n) => n.id === conn.to);
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
                            strokeDasharray={
                              toNode.status === "pending" ? "5,5" : ""
                            }
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
                    {nodes.map((node) => {
                      const colors = getTypeColor(node.type);
                      const isSelected = selectedNodeId === node.id;

                      return (
                        <div
                          key={node.id}
                          className="absolute pointer-events-auto cursor-pointer transition-transform hover:scale-105"
                          style={{
                            left: node.x - 100,
                            top: node.y,
                            width: "200px"
                          }}
                          onClick={() => handleNodeClick(node)}
                        >
                          <div
                            className={`
                            px-4 py-3 rounded-lg border-2 ${colors.border} ${
                              colors.bg
                            } bg-slate-800
                            ${
                              isSelected
                                ? "ring-2 ring-blue-400 shadow-lg shadow-blue-500/50"
                                : ""
                            }
                            ${
                              node.status === "running"
                                ? "ring-2 ring-yellow-400 animate-pulse"
                                : ""
                            }
                            ${node.hasLoop ? "ring-2 ring-red-500" : ""}
                          `}
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
                                <span>${node.cost.toFixed(4)}</span>
                              </div>
                              <div className="flex items-center justify-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3" />
                                <span>{(node.latency / 1000).toFixed(2)}s</span>
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

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-4">
                <div className="font-bold text-sm mb-3">Legend</div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span>LLM Call</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span>Tool Call</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                    <span>Decision</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            {selectedNode && (
              <div className="w-96 bg-slate-800 border-l border-slate-700 overflow-y-auto flex flex-col">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">{selectedNode.label}</h3>
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* View Toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSidebarView("details")}
                      className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${
                        sidebarView === "details"
                          ? "bg-blue-600"
                          : "bg-slate-700 hover:bg-slate-600"
                      }`}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setSidebarView("replay")}
                      className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${
                        sidebarView === "replay"
                          ? "bg-blue-600"
                          : "bg-slate-700 hover:bg-slate-600"
                      }`}
                    >
                      Replay
                    </button>
                  </div>
                </div>

                {/* Sidebar Content */}
                <div className="flex-1 overflow-y-auto">
                  {sidebarView === "details" ? (
                    <div className="p-4">
                      <div
                        className={`inline-block px-3 py-1 rounded text-xs font-bold mb-4 ${
                          selectedNode.type === "llm"
                            ? "bg-blue-500/20 text-blue-400"
                            : selectedNode.type === "tool"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-purple-500/20 text-purple-400"
                        }`}
                      >
                        {selectedNode.type.toUpperCase()}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-900 rounded-lg p-3">
                          <div className="text-xs text-slate-400 mb-1">
                            Latency
                          </div>
                          <div className="text-lg font-bold">
                            {(selectedNode.latency / 1000).toFixed(2)}s
                          </div>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-3">
                          <div className="text-xs text-slate-400 mb-1">
                            Cost
                          </div>
                          <div className="text-lg font-bold text-green-400">
                            ${selectedNode.cost.toFixed(4)}
                          </div>
                        </div>
                        {selectedNode.tokens && (
                          <>
                            <div className="bg-slate-900 rounded-lg p-3">
                              <div className="text-xs text-slate-400 mb-1">
                                Input Tokens
                              </div>
                              <div className="text-lg font-bold">
                                {selectedNode.tokens.input}
                              </div>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-3">
                              <div className="text-xs text-slate-400 mb-1">
                                Output Tokens
                              </div>
                              <div className="text-lg font-bold">
                                {selectedNode.tokens.output}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {selectedNode.type === "llm" && selectedNode.prompt && (
                        <>
                          <div className="mb-4">
                            <div className="font-bold text-sm mb-2">Prompt</div>
                            <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs max-h-32 overflow-y-auto border border-slate-700">
                              {selectedNode.prompt}
                            </div>
                          </div>
                          {selectedNode.response && (
                            <div className="mb-4">
                              <div className="font-bold text-sm mb-2">
                                Response
                              </div>
                              <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto border border-slate-700">
                                {selectedNode.response}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {selectedNode.type === "tool" &&
                        selectedNode.toolParams && (
                          <div className="mb-4">
                            <div className="font-bold text-sm mb-2">
                              Parameters
                            </div>
                            <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs border border-slate-700">
                              {JSON.stringify(selectedNode.toolParams, null, 2)}
                            </div>
                          </div>
                        )}

                      {selectedNode.hasLoop && (
                        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
                          <div className="font-bold text-red-400 text-sm mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Loop Detected
                          </div>
                          <div className="text-xs text-slate-300">
                            This operation was called multiple times with
                            identical parameters, wasting $
                            {(selectedNode.cost * 4).toFixed(4)}.
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => setSidebarView("replay")}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Replay from Here
                      </button>
                    </div>
                  ) : (
                    <div className="p-4">
                      <h4 className="text-lg font-bold mb-4 text-blue-400">
                        Replay Studio
                      </h4>

                      <div className="mb-6">
                        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 mb-4">
                          <div className="text-sm font-bold mb-2 text-slate-400">
                            Original Configuration
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cost:</span>
                              <span className="font-bold text-red-400">
                                ${selectedNode.cost.toFixed(4)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Latency:</span>
                              <span className="font-bold">
                                {(selectedNode.latency / 1000).toFixed(2)}s
                              </span>
                            </div>
                            {selectedNode.tokens && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Tokens:</span>
                                <span className="font-bold">
                                  {selectedNode.tokens.input +
                                    selectedNode.tokens.output}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {selectedNode.type === "llm" && selectedNode.prompt && (
                          <div>
                            <div className="text-sm font-bold mb-2">
                              Edit Prompt
                            </div>
                            <textarea
                              value={editedPrompt}
                              onChange={(e) => setEditedPrompt(e.target.value)}
                              className="w-full bg-slate-900 rounded-lg p-3 font-mono text-xs h-40 border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                              placeholder="Modify the prompt to test optimizations..."
                            />
                          </div>
                        )}
                      </div>

                      {replayResults && (
                        <div className="bg-green-900/20 border-2 border-green-500 rounded-lg p-4 mb-4">
                          <div className="text-sm font-bold mb-3 text-green-400 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Replay Results
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-300">New Cost:</span>
                              <span className="font-bold text-green-400">
                                ${replayResults.newCost.toFixed(4)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-300">Savings:</span>
                              <span className="font-bold text-green-400">
                                $
                                {(
                                  replayResults.originalCost -
                                  replayResults.newCost
                                ).toFixed(4)}{" "}
                                (30%)
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-300">
                                Nodes Affected:
                              </span>
                              <span className="font-bold">
                                {replayResults.nodesAffected}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleReplay}
                        disabled={
                          selectedNode.type === "llm" &&
                          (!editedPrompt ||
                            editedPrompt === selectedNode.prompt)
                        }
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-bold flex items-center justify-center gap-2 transition-colors mb-3"
                      >
                        <Play className="w-5 h-5" />
                        {replayResults ? "Replay Again" : "Start Replay"}
                      </button>

                      <button
                        onClick={() => setSidebarView("details")}
                        className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        Back to Details
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Stats Bar */}
      <div className="bg-slate-900 border-t border-slate-700 p-3">
        <div className="grid grid-cols-5 gap-4 text-center text-sm">
          <div>
            <div className="text-xs text-slate-400 mb-1">LLM Calls</div>
            <div className="text-lg font-bold text-blue-400">
              {stats.llmCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Tool Calls</div>
            <div className="text-lg font-bold text-green-400">
              {stats.toolCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Total Cost</div>
            <div className="text-lg font-bold text-green-400">
              ${stats.totalCost.toFixed(4)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Avg Latency</div>
            <div className="text-lg font-bold">
              {(stats.avgLatency / 1000).toFixed(2)}s
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Status</div>
            <div className="text-lg font-bold text-yellow-400">Running</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentTraceVisualizer;
