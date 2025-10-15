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

// ============================================================================
// TIMELINE VIEW COMPONENT
// ============================================================================

export const TimelineView = ({ nodes }) => {
  // Sort nodes by timestamp
  const sortedNodes = [...nodes].sort((a, b) => a.timestamp - b.timestamp);

  // Calculate relative timestamps
  const startTime = sortedNodes[0]?.timestamp || 0;
  const endTime = sortedNodes[sortedNodes.length - 1]?.timestamp || 0;
  const totalDuration = ((endTime - startTime) / 1000).toFixed(1);

  const timeline = sortedNodes.map((node, index) => {
    const relativeTime = ((node.timestamp - startTime) / 1000).toFixed(1);
    const duration = (node.latency / 1000).toFixed(1);
    const nextNode = sortedNodes[index + 1];
    const gap = nextNode
      ? ((nextNode.timestamp - node.timestamp - node.latency) / 1000).toFixed(1)
      : "0";

    return { node, relativeTime, duration, gap };
  });

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Timeline View</h2>
        <div className="text-sm text-slate-400">
          Total Duration: {totalDuration}s
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {timeline.map(({ node, relativeTime, duration, gap }) => (
          <div key={node.id}>
            {/* Node row */}
            <div className="flex items-center gap-4">
              {/* Timestamp */}
              <div className="w-20 text-sm text-slate-400 font-mono text-right">
                {relativeTime}s
              </div>

              {/* Type indicator */}
              <div
                className={`w-3 h-3 rounded-full ${
                  node.type === "llm"
                    ? "bg-blue-500"
                    : node.type === "tool"
                    ? "bg-green-500"
                    : "bg-purple-500"
                }`}
              />

              {/* Node card */}
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
                        {(
                          node.tokens.input + node.tokens.output
                        ).toLocaleString()}{" "}
                        tokens
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gap indicator */}
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
// ANALYTICS VIEW COMPONENT
// ============================================================================

export const AnalyticsView = ({ nodes }) => {
  // Calculate statistics
  const stats = {
    totalCost: nodes.reduce((sum, n) => sum + n.cost, 0),
    totalTokens: nodes.reduce(
      (sum, n) => sum + ((n.tokens?.input || 0) + (n.tokens?.output || 0)),
      0
    ),
    totalLatency: nodes.reduce((sum, n) => sum + n.latency, 0),
    avgCost: nodes.reduce((sum, n) => sum + n.cost, 0) / nodes.length,
    avgLatency: nodes.reduce((sum, n) => sum + n.latency, 0) / nodes.length
  };

  // Cost by node type
  const costByType = [
    {
      type: "LLM Calls",
      cost: nodes
        .filter((n) => n.type === "llm")
        .reduce((sum, n) => sum + n.cost, 0),
      count: nodes.filter((n) => n.type === "llm").length
    },
    {
      type: "Tool Calls",
      cost: nodes
        .filter((n) => n.type === "tool")
        .reduce((sum, n) => sum + n.cost, 0),
      count: nodes.filter((n) => n.type === "tool").length
    },
    {
      type: "Decisions",
      cost: nodes
        .filter((n) => n.type === "decision")
        .reduce((sum, n) => sum + n.cost, 0),
      count: nodes.filter((n) => n.type === "decision").length
    }
  ];

  // Top 5 most expensive operations
  const topExpensive = [...nodes]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
    .map((n) => ({
      name: n.label,
      cost: n.cost,
      percentage: ((n.cost / stats.totalCost) * 100).toFixed(1)
    }));

  // Token distribution
  const tokenData = nodes
    .filter((n) => n.tokens)
    .map((n) => ({
      name: n.label,
      input: n.tokens.input,
      output: n.tokens.output
    }));

  // Latency over time
  const latencyData = [...nodes]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((n, i) => ({
      step: i + 1,
      latency: n.latency / 1000,
      name: n.label
    }));

  const COLORS = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444"];

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full">
      <h2 className="text-2xl font-bold mb-6">Cost & Performance Analytics</h2>

      {/* Summary Cards */}
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
          <div className="text-3xl font-bold">{nodes.length}</div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        {/* Pie Chart - Cost by Type */}
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
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value.toFixed(4)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart - Top Expensive Operations */}
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

      {/* Token Usage */}
      {tokenData.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold mb-4">Token Usage Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tokenData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569"
                }}
              />
              <Legend />
              <Bar dataKey="input" fill="#3b82f6" name="Input Tokens" />
              <Bar dataKey="output" fill="#10b981" name="Output Tokens" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Latency Timeline */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold mb-4">Latency Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={latencyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="step"
              stroke="#94a3b8"
              label={{ value: "Step", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              stroke="#94a3b8"
              label={{
                value: "Latency (s)",
                angle: -90,
                position: "insideLeft"
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569"
              }}
              formatter={(value) => [`${value.toFixed(2)}s`, "Latency"]}
            />
            <Line
              type="monotone"
              dataKey="latency"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: "#8b5cf6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Optimization Suggestions */}
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
                  {topExpensive[0]?.name} accounts for{" "}
                  {topExpensive[0]?.percentage}% of total cost. Consider
                  reducing output tokens or caching results.
                </div>
                <div className="text-green-400 font-semibold mt-1">
                  Potential savings: ${(stats.totalCost * 0.3).toFixed(4)} (30%)
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1">⚡ Performance</div>
                <div className="text-slate-300">
                  Average latency is {(stats.avgLatency / 1000).toFixed(2)}s per
                  operation. Consider parallel execution for independent
                  operations.
                </div>
                <div className="text-green-400 font-semibold mt-1">
                  Potential speedup: ~40% faster
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Projection */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold mb-4">Monthly Cost Projection</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-slate-400 mb-1">At 100 runs/day</div>
            <div className="text-2xl font-bold text-green-400">
              ${(stats.totalCost * 100 * 30).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400 mb-1">At 500 runs/day</div>
            <div className="text-2xl font-bold text-yellow-400">
              ${(stats.totalCost * 500 * 30).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400 mb-1">At 1000 runs/day</div>
            <div className="text-2xl font-bold text-red-400">
              ${(stats.totalCost * 1000 * 30).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
