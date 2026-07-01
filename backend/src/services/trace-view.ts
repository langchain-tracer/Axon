/**
 * Trace read/query service.
 *
 * Loads stored traces/nodes/edges and shapes them into the format the dashboard
 * expects. All HTTP concerns stay in the API router; this module is pure data.
 */

import { db } from "../database/connection.js";
import { TraceModel, NodeModel, EdgeModel } from "../database/models.js";
import {
  generateNodeLabel,
  calculateCost,
  calculateNodePosition,
} from "../utils/nodeUtils.js";
import {
  estimateTokensFromContent,
  generateTraceDescription,
} from "../utils/trace-enhance.js";
import { deriveDisplay, type RawSpan } from "../otel/derive.js";
import type { AxonNodeType } from "../otel/classifier.js";

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  animated: boolean;
};

/** List traces (optionally by project) enhanced with cost + node count. */
export function listTraces(project?: string) {
  const traces = project
    ? TraceModel.list({ projectName: project, limit: 100, offset: 0 })
    : TraceModel.list({ limit: 100, offset: 0 });

  if (!traces) return { traces: [], total: 0 };

  // DB rows are snake_case; normalize to the camelCase shape the dashboard expects.
  const enhancedTraces = traces.map((trace: any) => {
    const nodes = db.query("SELECT cost, type FROM nodes WHERE trace_id = ?", [trace.id]);
    const totalCost = nodes.reduce((sum: number, node: any) => sum + (node.cost || 0), 0);

    // Extract a human-readable description from the first span's prompt or span name
    let description = "";
    try {
      const firstNode = db.get<any>(
        "SELECT data FROM nodes WHERE trace_id = ? ORDER BY start_time ASC LIMIT 1",
        [trace.id],
      );
      if (firstNode?.data) {
        const data = typeof firstNode.data === "string" ? JSON.parse(firstNode.data) : firstNode.data;
        const attrs = data?.raw?.attributes ?? {};
        const prompt =
          attrs["gen_ai.prompt.0.content"] ??
          attrs["gen_ai.prompt"] ??
          attrs["input.value"] ??
          attrs["ai.prompt.messages"];
        description = prompt ? String(prompt) : (data?.raw?.name ?? "");
      }
    } catch {}

    return {
      id: trace.id,
      projectName: trace.project_name ?? trace.projectName ?? "default",
      description,
      status: trace.status,
      startTime: trace.start_time ?? trace.startTime,
      endTime: trace.end_time ?? trace.endTime,
      cost: totalCost,
      nodeCount: nodes.length,
    };
  });

  return { traces: enhancedTraces, total: enhancedTraces.length };
}

/**
 * Build the edge list for a trace: primary source is the edges table, with a
 * cross-batch fallback that derives any missing parent→child edge from the
 * parentRunId stored on each node. OTLP spans can flush in any order, so a child
 * may arrive before its parent and the FK-constrained edge insert can fail
 * silently — parentRunId is always written, so we recover here at read time.
 */
function buildEdges(traceId: string, runIdToNodeId: Map<string, string>, nodes: any[]): FlowEdge[] {
  const edges: FlowEdge[] = EdgeModel.findByTraceId(traceId)
    .map((edge: any) => {
      const source = runIdToNodeId.get(edge.fromNode);
      const target = runIdToNodeId.get(edge.toNode);
      if (!source || !target) return null;
      return { id: edge.id as string, source, target, type: "smoothstep", animated: false };
    })
    .filter((e): e is FlowEdge => e !== null);

  const seen = new Set(edges.map((e) => `${e.source}→${e.target}`));
  for (const node of nodes) {
    if (!node.parentRunId) continue;
    const parentNodeId = runIdToNodeId.get(node.parentRunId);
    if (!parentNodeId) continue;
    const key = `${parentNodeId}→${node.id}`;
    if (!seen.has(key)) {
      edges.push({ id: `derived-${parentNodeId}-${node.id}`, source: parentNodeId, target: node.id, type: "smoothstep", animated: false });
      seen.add(key);
    }
  }
  return edges;
}

/** Get a single trace with enhanced nodes, edges and stats; null if not found. */
export function getTraceDetail(traceId: string) {
  const trace = TraceModel.findById(traceId);
  if (!trace) return null;

  const nodes = NodeModel.findByTraceId(traceId).map((node) => {
    const data = typeof node.data === "string" ? JSON.parse(node.data) : node.data;
    // Single source of truth: the verbatim span lives in data.raw; display
    // fields are derived from it at read time (see otel/derive.ts).
    const raw: RawSpan | undefined = data?.raw;
    const display = raw
      ? deriveDisplay(raw, node.type as AxonNodeType)
      : { prompts: [], response: "", reasoning: "" };
    return {
      id: node.id,
      runId: node.runId,
      parentRunId: node.parentRunId,
      type: node.type,
      status: node.status,
      startTime: node.startTime,
      endTime: node.endTime,
      model: node.model || "unknown",
      cost: node.cost || 0,
      latency: node.latency || 0,
      tokens: typeof node.tokens === "string" ? JSON.parse(node.tokens) : node.tokens,
      prompts: display.prompts,
      response: display.response,
      reasoning: display.reasoning,
      toolName: display.toolName || "",
      toolInput: display.toolInput || "",
      toolOutput: display.toolOutput || "",
      chainName: display.chainName || "",
      chainInputs: display.inputs || "",
      chainOutputs: display.outputs || "",
      agentActions: display.agentActions || [],
      error: node.error,
      // Verbatim OTEL span for the Raw inspector + Copy-JSON.
      raw: raw ?? null,
      metadata: raw?.attributes ?? {},
      createdAt: new Date(node.createdAt),
    };
  });

  const runIdToNodeId = new Map(nodes.map((n) => [n.runId, n.id]));
  const edges = buildEdges(traceId, runIdToNodeId, nodes);

  const sortedNodes = nodes.sort((a, b) => a.startTime - b.startTime);
  const enhancedNodes = sortedNodes.map((node, index) => {
    const position = calculateNodePosition(index);
    return {
      id: node.id,
      label: generateNodeLabel(node, index),
      type: node.type,
      status: node.status,
      cost: calculateCost(node),
      latency: node.latency || 0,
      tokens: node.tokens
        ? {
            input: node.tokens.input || 0,
            output: node.tokens.output || 0,
            total: node.tokens.total || (node.tokens.input || 0) + (node.tokens.output || 0),
          }
        : estimateTokensFromContent(node),
      timestamp: node.startTime,
      startTime: node.startTime,
      endTime: node.endTime,
      x: position.x,
      y: position.y,
      prompts: node.prompts,
      response: node.response,
      reasoning: node.reasoning,
      model: node.model || "unknown",
      toolName: node.toolName,
      toolInput: node.toolInput,
      toolOutput: node.toolOutput,
      chainName: node.chainName || node.metadata?.chainName || "unknown",
      chainInputs: node.chainInputs,
      chainOutputs: node.chainOutputs,
      agentActions: node.agentActions,
      parentRunId: node.parentRunId,
      error: node.error,
      // Verbatim OTEL span for the Raw inspector + Copy-JSON.
      raw: node.raw,
    };
  });

  // Normalize snake_case trace columns to the camelCase shape the dashboard reads.
  const t: any = trace;
  const startTime = t.start_time ?? t.startTime;
  const endTime = t.end_time ?? t.endTime;
  const project = t.project_name ?? t.projectName ?? "default";
  const latency =
    startTime != null ? (endTime ?? Date.now()) - startTime : 0;
  const totalCost = nodes.reduce((sum, node) => sum + (node.cost || 0), 0);

  return {
    trace: {
      id: t.id,
      projectName: project,
      project,
      status: t.status,
      startTime,
      endTime,
      timestamp: startTime,
      nodeCount: t.total_nodes ?? nodes.length,
      cost: totalCost,
      latency,
      description: generateTraceDescription(trace, nodes),
    },
    nodes: enhancedNodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalCost,
      totalLatency: latency,
      llmCount: nodes.filter((n) => n.type.includes("llm")).length,
      toolCount: nodes.filter((n) => n.type.includes("tool")).length,
      chainCount: nodes.filter((n) => n.type.includes("chain")).length,
      errorCount: nodes.filter((n) => n.status === "error").length,
    },
  };
}

/** Get a trace's nodes in flat event format; null if the trace is not found. */
export function getTraceEvents(traceId: string) {
  const trace = TraceModel.findById(traceId);
  if (!trace) return null;

  return NodeModel.findByTraceId(traceId).map((node) => ({
    eventId: node.runId,
    traceId,
    type: node.type,
    status: node.status,
    timestamp: node.startTime,
    cost: node.cost,
    latency: node.latency,
    tokens: node.tokens,
    data: node.data,
  }));
}

/** Aggregate statistics across all traces. */
export function getStats() {
  const traces = TraceModel.list({ limit: 1000, offset: 0 });
  const totalCost = traces.reduce((sum, t) => sum + (t.totalCost || 0), 0);
  const totalNodes = traces.reduce((sum, t) => sum + (t.totalNodes || 0), 0);

  return {
    totalTraces: traces.length,
    completedTraces: traces.filter((t) => t.status === "complete").length,
    runningTraces: traces.filter((t) => t.status === "running").length,
    failedTraces: traces.filter((t) => t.status === "error").length,
    totalCost,
    totalNodes,
    averageCostPerTrace: traces.length > 0 ? totalCost / traces.length : 0,
    averageNodesPerTrace: traces.length > 0 ? totalNodes / traces.length : 0,
  };
}

/** Per-project rollup (trace count, cost, last activity). */
export function getProjects() {
  const traces = TraceModel.list({ limit: 1000, offset: 0 });
  const projects = [...new Set(traces.map((t) => t.projectName || "default"))];

  return projects.map((project) => {
    const projectTraces = traces.filter((t) => (t.projectName || "default") === project);
    return {
      name: project,
      traceCount: projectTraces.length,
      totalCost: projectTraces.reduce((sum, t) => sum + (t.totalCost || 0), 0),
      lastActivity: Math.max(...projectTraces.map((t) => t.startTime)),
    };
  });
}
