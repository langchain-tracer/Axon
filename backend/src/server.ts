/**
 * Agent Trace Backend Server
 * - Socket.IO for receiving trace events
 * - REST API for querying traces
 * Enhanced to work with frontend dashboard
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import {
  TraceModel,
  NodeModel
} from "./database/models.js";
import { db } from "./database/connection.js";
import { TraceEvent } from "./types/index.js";
import { storage } from "./storage-sqlite.js";

// Simple anomaly detection for backend
interface SimpleAnomaly {
  type: string;
  severity: string;
  title: string;
  description: string;
  affectedNodes: string[];
  cost?: number;
  latency?: number;
}

function detectSimpleAnomalies(nodes: any[], edges: any[]): SimpleAnomaly[] {
  const anomalies: SimpleAnomaly[] = [];
  
  if (nodes.length === 0) return anomalies;

  // Detect expensive operations
  const totalCost = nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
  const avgCost = totalCost / nodes.length;
  const expensiveThreshold = avgCost * 3;

  const expensiveNodes = nodes.filter(node => (node.cost || 0) > expensiveThreshold);
  for (const node of expensiveNodes) {
    anomalies.push({
      type: 'expensive_operation',
      severity: (node.cost || 0) > avgCost * 5 ? 'high' : 'medium',
      title: 'Expensive Operation',
      description: `Operation costs $${(node.cost || 0).toFixed(6)}, ${((node.cost || 0) / avgCost).toFixed(1)}x average`,
      affectedNodes: [node.id],
      cost: node.cost
    });
  }

  // Detect redundant tool calls
  const toolCalls = nodes.filter(node => node.type?.includes('tool_start'));
  const toolCallGroups = new Map<string, any[]>();

  for (const call of toolCalls) {
    const key = `${call.toolName}-${call.toolInput}`;
    if (!toolCallGroups.has(key)) {
      toolCallGroups.set(key, []);
    }
    toolCallGroups.get(key)!.push(call);
  }

  for (const [key, calls] of toolCallGroups) {
    if (calls.length > 3) {
      const [toolName] = key.split('-', 1);
      anomalies.push({
        type: 'redundant_calls',
        severity: calls.length > 5 ? 'high' : 'medium',
        title: 'Redundant Tool Calls',
        description: `Tool "${toolName}" called ${calls.length} times with same input`,
        affectedNodes: calls.map(c => c.id),
        cost: calls.reduce((sum, c) => sum + (c.cost || 0), 0)
      });
    }
  }

  return anomalies;
}

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate human-readable label for a node
 */
function generateNodeLabel(node: any, index: number): string {
  const stepNumber = index + 1;
  
  switch (node.type) {
    case "llm_start":
      return "LLM Processing";
    case "llm_end":
      return "LLM Response";
    case "tool_start":
      if (node.toolName) {
        return `${node.toolName} Call`;
      }
      return "Tool Execution";
    case "tool_end":
      if (node.toolName) {
        return `${node.toolName} Result`;
      }
      return "Tool Complete";
    case "chain_start":
      return "Process Start";
    case "chain_end":
      return "Process Complete";
    case "llm":
      return node.metadata?.model || `LLM Call ${stepNumber}`;
    case "tool":
      return node.toolName || `Tool Call ${stepNumber}`;
    case "chain":
      return node.metadata?.chainName || `Chain ${stepNumber}`;
    default:
      return `Step ${stepNumber}`;
  }
}

/**
 * Calculate cost for a node based on tokens and model
 */
function calculateCost(node: any): number {
  if (node.cost) return node.cost;
  
  // Basic cost calculation based on tokens
  const tokens = node.tokens;
  if (!tokens) {
    // If no token data, estimate based on content
    return estimateCostFromContent(node);
  }
  
  // Rough cost estimates (these should be configurable)
  const inputCostPer1k = 0.0015; // $0.0015 per 1k input tokens
  const outputCostPer1k = 0.002; // $0.002 per 1k output tokens
  
  const inputCost = (tokens.input || 0) / 1000 * inputCostPer1k;
  const outputCost = (tokens.output || 0) / 1000 * outputCostPer1k;
  
  return inputCost + outputCost;
}

/**
 * Estimate cost based on content when token data is not available
 */
function estimateCostFromContent(node: any): number {
  let inputTokens = 0;
  let outputTokens = 0;
  
  // Estimate tokens based on content
  if (node.prompt) {
    inputTokens = Math.ceil(node.prompt.length / 4); // Rough estimate: 4 chars per token
  }
  
  if (node.response) {
    outputTokens = Math.ceil(node.response.length / 4);
  }
  
  if (node.toolInput) {
    inputTokens += Math.ceil(node.toolInput.length / 4);
  }
  
  if (node.toolOutput) {
    outputTokens += Math.ceil(node.toolOutput.length / 4);
  }
  
  // Apply cost rates
  const inputCostPer1k = 0.0015;
  const outputCostPer1k = 0.002;
  
  return (inputTokens / 1000 * inputCostPer1k) + (outputTokens / 1000 * outputCostPer1k);
}

/**
 * Estimate tokens from content when token data is not available
 */
function estimateTokensFromContent(node: any): { input: number; output: number; total: number } | undefined {
  let inputTokens = 0;
  let outputTokens = 0;
  
  // Estimate tokens based on content
  if (node.prompt) {
    inputTokens = Math.ceil(node.prompt.length / 4); // Rough estimate: 4 chars per token
  }
  
  if (node.response) {
    outputTokens = Math.ceil(node.response.length / 4);
  }
  
  if (node.toolInput) {
    inputTokens += Math.ceil(node.toolInput.length / 4);
  }
  
  if (node.toolOutput) {
    outputTokens += Math.ceil(node.toolOutput.length / 4);
  }
  
  // Only return token data if we have some content
  if (inputTokens > 0 || outputTokens > 0) {
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    };
  }
  
  return undefined;
}

/**
 * Calculate node position for graph layout
 */
function calculateNodePosition(index: number): { x: number; y: number } {
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);

  return {
    x: 200 + col * 250,
    y: 100 + row * 200
  };
}

/**
 * Generate trace description from nodes
 */
function generateTraceDescription(trace: any, nodes: any[]): string {
  const status = trace.status || "running";
  const nodeCount = nodes.length;

  // Try to get description from first LLM node
  const firstLLMNode = nodes.find((n) => n.type === "llm");
  if (firstLLMNode?.data?.prompts?.[0]) {
    const prompt = firstLLMNode.data.prompts[0];
    // Truncate long prompts
    return prompt.length > 100 ? prompt.substring(0, 100) + "..." : prompt;
  }

  // Fallback descriptions
  if (status === "complete") {
    return `Completed with ${nodeCount} steps`;
  } else if (status === "error") {
    return `Failed at step ${nodeCount}`;
  } else {
    return `Processing (${nodeCount} steps so far)`;
  }
}

/**
 * Calculate total latency for a trace
 */
function calculateTraceLatency(trace: any): number {
  if (trace.endTime && trace.startTime) {
    return trace.endTime - trace.startTime;
  }
  // If trace is still running
  return Date.now() - trace.startTime;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// ============================================================================
// REST API ROUTES
// ============================================================================

/**
 * GET /api/traces - Get all traces (enhanced for frontend)
 */
app.get("/api/traces", (req, res) => {
  try {
    const { project } = req.query;

    const traces = project
      ? TraceModel.list({
          projectName: project as string,
          limit: 100,
          offset: 0
        })
      : TraceModel.list({ limit: 100, offset: 0 });

    // ✅ ADD THIS CHECK
    if (!traces) {
      return res.json({ traces: [], total: 0 });
    }

    // Enhance traces with cost and node count
    const enhancedTraces = traces.map((trace: any) => {
      const events = db.query("SELECT cost, type FROM events WHERE trace_id = ?", [trace.trace_id]);
      const totalCost = events.reduce((sum: number, event: any) => sum + (event.cost || 0), 0);
      const nodeCount = events.length;
      
      return {
        ...trace,
        cost: totalCost,
        nodeCount: nodeCount
      };
    });

    res.json({
      traces: enhancedTraces || [], // ← Ensure it's always an array
      total: (enhancedTraces || []).length
    });
  } catch (error) {
    console.error("Error listing traces:", error);
    res.status(500).json({
      error: "Failed to list traces",
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/traces/:traceId - Get specific trace with enhanced node data
 */
app.get("/api/traces/:traceId", (req, res) => {
  try {
    const { traceId } = req.params;
    const trace = TraceModel.findById(traceId);

    if (!trace) {
      return res.status(404).json({ error: "Trace not found" });
    }

    // Get events and transform them into nodes and edges
    const events = db.query<any>(
      "SELECT * FROM events WHERE trace_id = ? ORDER BY timestamp ASC",
      [traceId]
    );
    
    // Transform events into nodes
    const nodes = events.map((event, index) => ({
      id: event.event_id,
      runId: event.run_id,
      parentRunId: event.parent_run_id,
      type: event.type,
      status: 'complete',
      startTime: event.timestamp,
      endTime: event.timestamp + (event.latency || 0),
      cost: event.cost || 0,
      latency: event.latency || 0,
      tokens: event.tokens_total ? {
        input: event.tokens_prompt || 0,
        output: event.tokens_completion || 0,
        total: event.tokens_total
      } : undefined,
      prompt: event.prompts,
      response: event.response,
      toolName: event.tool_name,
      toolInput: event.tool_input,
      toolOutput: event.tool_output,
      error: event.error,
      metadata: event.metadata ? JSON.parse(event.metadata) : {},
      createdAt: new Date(event.created_at)
    }));
    
    // Create edges based on parent-child relationships
    const edges = events
      .filter(event => event.parent_run_id)
      .map(event => {
        // Find the parent event by run_id
        const parentEvent = events.find(e => e.run_id === event.parent_run_id);
        return {
          id: `edge-${parentEvent?.event_id || event.parent_run_id}-${event.event_id}`,
          source: parentEvent?.event_id || event.parent_run_id,
          target: event.event_id,
          type: 'smoothstep',
          animated: false
        };
      });
    
    // Run anomaly detection
    const anomalies = detectSimpleAnomalies(nodes, edges);

    // Sort nodes by start time
    const sortedNodes = nodes.sort((a, b) => a.startTime - b.startTime);

    // Enhance nodes with frontend-compatible fields
    const enhancedNodes = sortedNodes.map((node, index) => {
      const position = calculateNodePosition(index);
      const label = generateNodeLabel(node, index);

      return {
        // Core fields
        id: node.id, // Use event ID as the display ID
        label: label,
        type: node.type,
        status: node.status,

        // Metrics
        cost: calculateCost(node),
        latency: node.latency || 0,
        tokens: node.tokens
          ? {
              input: node.tokens.input || 0,
              output: node.tokens.output || 0,
              total: node.tokens.total || (node.tokens.input || 0) + (node.tokens.output || 0)
            }
          : estimateTokensFromContent(node),

        // Timing
        timestamp: node.startTime,
        startTime: node.startTime,
        endTime: node.endTime,

        // Graph layout
        x: position.x,
        y: position.y,

        // Type-specific data
        prompt: node.prompt,
        response: node.response,
        model: node.metadata?.model || 'unknown',
        toolName: node.toolName,
        toolInput: node.toolInput,
        toolOutput: node.toolOutput,
        chainName: node.metadata?.chainName || 'unknown',

        // Relationships
        parentRunId: node.parentRunId,

        // Error info
        error: node.error,

        // Anomaly detection
        hasLoop: anomalies.some(
          (a) => a.type === "loop" && a.affectedNodes?.includes(node.runId)
        )
      };
    });

    // Calculate trace latency
    const latency = calculateTraceLatency(trace);

    // Enhanced trace object
    const totalCost = nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
    
    const enhancedTrace = {
      ...trace,
      project: trace.projectName || "default",
      timestamp: trace.startTime,
      nodeCount: trace.totalNodes || nodes.length,
      cost: totalCost,
      latency: latency,
      description: generateTraceDescription(trace, nodes)
    };

    res.json({
      trace: enhancedTrace,
      nodes: enhancedNodes,
      edges: edges,
      anomalies: anomalies,
      stats: {
        totalNodes: nodes.length,
        totalCost: nodes.reduce((sum, node) => sum + (node.cost || 0), 0),
        totalLatency: latency,
        llmCount: nodes.filter((n) => n.type.includes("llm")).length,
        toolCount: nodes.filter((n) => n.type.includes("tool")).length,
        chainCount: nodes.filter((n) => n.type.includes("chain")).length,
        errorCount: nodes.filter((n) => n.status === "error").length,
        anomalyCount: anomalies.length
      }
    });
  } catch (error) {
    console.error("Error getting trace:", error);
    res.status(500).json({ error: "Failed to get trace" });
  }
});

/**
 * GET /api/traces/:traceId/events - Get events for a trace
 */
app.get("/api/traces/:traceId/events", (req, res) => {
  try {
    const { traceId } = req.params;
    const trace = TraceModel.findById(traceId);

    if (!trace) {
      return res.status(404).json({ error: "Trace not found" });
    }

    const nodes = NodeModel.findByTraceId(traceId);

    // Convert nodes to event format
    const events = nodes.map((node) => ({
      eventId: node.runId,
      traceId: traceId,
      type: node.type,
      status: node.status,
      timestamp: node.startTime,
      cost: node.cost,
      latency: node.latency,
      tokens: node.tokens,
      data: node.data
    }));

    res.json({ events });
  } catch (error) {
    console.error("Error getting events:", error);
    res.status(500).json({ error: "Failed to get events" });
  }
});

/**
 * GET /api/stats - Get overall statistics
 */
app.get("/api/stats", (req, res) => {
  try {
    const traces = TraceModel.list({ limit: 1000, offset: 0 });

    const totalCost = traces.reduce((sum, trace) => {
      return sum + (trace.totalCost || 0);
    }, 0);

    const totalNodes = traces.reduce((sum, trace) => {
      return sum + (trace.totalNodes || 0);
    }, 0);

    const completedTraces = traces.filter(
      (t) => t.status === "complete"
    ).length;
    const runningTraces = traces.filter((t) => t.status === "running").length;
    const failedTraces = traces.filter((t) => t.status === "error").length;

    res.json({
      totalTraces: traces.length,
      completedTraces,
      runningTraces,
      failedTraces,
      totalCost,
      totalNodes,
      averageCostPerTrace: traces.length > 0 ? totalCost / traces.length : 0,
      averageNodesPerTrace: traces.length > 0 ? totalNodes / traces.length : 0
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

/**
 * GET /api/projects - Get list of all projects
 */
app.get("/api/projects", (req, res) => {
  try {
    const traces = TraceModel.list({ limit: 1000, offset: 0 });

    // Extract unique project names
    const projects = [
      ...new Set(traces.map((t) => t.projectName || "default"))
    ];

    // Get stats for each project
    const projectStats = projects.map((project) => {
      const projectTraces = traces.filter(
        (t) => (t.projectName || "default") === project
      );

      const totalCost = projectTraces.reduce(
        (sum, t) => sum + (t.totalCost || 0),
        0
      );

      return {
        name: project,
        traceCount: projectTraces.length,
        totalCost: totalCost,
        lastActivity: Math.max(...projectTraces.map((t) => t.startTime))
      };
    });

    res.json({ projects: projectStats });
  } catch (error) {
    console.error("Error getting projects:", error);
    res.status(500).json({ error: "Failed to get projects" });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map OpenAI event types to standard trace event types
 */
function mapOpenAIEventType(openaiType: string): string {
  switch (openaiType) {
    case 'function_call_start':
      return 'llm_start';
    case 'function_call_end':
      return 'llm_end';
    case 'tool_selection':
      return 'tool_start';
    case 'conversation_turn':
      return 'llm_end';
    case 'error':
      return 'error';
    default:
      return 'custom';
  }
}

// ============================================================================
// SOCKET.IO CONNECTION HANDLING
// ============================================================================

io.on("connection", (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Get auth info
  const { apiKey, projectName } = socket.handshake.auth;
  console.log(`   Project: ${projectName || "default"}`);

  // Handle trace events
  socket.on("trace_events", (events: TraceEvent[]) => {
    try {
      // Validate events
      if (!Array.isArray(events) || events.length === 0) {
        console.error("❌ Invalid events received");
        return;
      }

      console.log(`📥 Received ${events.length} events from ${socket.id}`);

      // Process each event (assuming you have a processor)
      storage.addEvents(events);

      // Broadcast to dashboard clients (for real-time updates)
      for (const event of events) {
        io.to(`trace:${event.traceId}`).emit("new_event", event);
      }

      // Also broadcast to project room for project-wide updates
      if (projectName) {
        io.to(`project:${projectName}`).emit("trace_update", {
          traceId: events[0]?.traceId,
          eventCount: events.length,
          timestamp: Date.now()
        });
      }

      // Acknowledge receipt
      socket.emit("events_received", {
        count: events.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("❌ Error processing events:", error);
      socket.emit("error", { message: "Failed to process events" });
    }
  });

  // Handle OpenAI events
  socket.on("openai_events", async (data: any) => {
    try {
      const { traceId, projectName, events, metadata } = data;
      
      console.log(`📥 Received ${events.length} OpenAI events from ${socket.id} for trace: ${traceId}`);

      // Convert OpenAI events to standard trace events
      const traceEvents: TraceEvent[] = events.map((event: any) => ({
        eventId: event.eventId,
        traceId: event.traceId,
        runId: event.eventId, // Use eventId as runId for OpenAI events
        type: mapOpenAIEventType(event.type),
        timestamp: event.timestamp,
        data: event.data,
        metadata: {
          projectName,
          ...metadata,
          ...event.metadata
        }
      }));

      // Process the converted events
      for (const event of traceEvents) {
        storage.addEvents([event]);

        // Broadcast to dashboard clients
        io.to(`trace:${event.traceId}`).emit("trace_update", {
          traceId: event.traceId,
          event
        });
      }

      // Send acknowledgment
      socket.emit("openai_events_ack", {
        received: events.length,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error("❌ Error handling OpenAI events:", error);
      socket.emit("openai_events_error", {
        error: "Failed to process OpenAI events"
      });
    }
  });

  // Join trace room (for dashboard to receive updates)
  socket.on("watch_trace", (traceId: string) => {
    socket.join(`trace:${traceId}`);
    console.log(`👀 Client ${socket.id} watching trace: ${traceId}`);

    // Send existing trace data
    try {
      const trace = TraceModel.findById(traceId);
      if (trace) {
        // Get events from the events table and transform them to nodes/edges
        const events = db.query("SELECT * FROM events WHERE trace_id = ? ORDER BY timestamp ASC", [traceId]);
        
        if (events.length === 0) {
          socket.emit("trace_data", {
            trace,
            nodes: [],
            edges: [],
            anomalies: [],
            stats: {
              totalNodes: 0,
              totalCost: 0,
              totalLatency: 0,
              llmCount: 0,
              toolCount: 0,
              chainCount: 0,
              errorCount: 0,
              anomalyCount: 0
            }
          });
          return;
        }

        // Transform events to nodes (same logic as the API endpoint)
        const sortedNodes = events.map((event: any) => ({
          id: event.event_id,
          type: event.type,
          status: "complete", // Events are always complete when stored
          startTime: event.timestamp,
          endTime: event.timestamp, // Events don't have separate end times
          latency: event.latency || 0,
          runId: event.run_id,
          parentRunId: event.parent_run_id,
          prompt: event.prompts ? JSON.parse(event.prompts) : undefined,
          response: event.response,
          toolName: event.tool_name,
          toolInput: event.tool_input ? JSON.parse(event.tool_input) : undefined,
          toolOutput: event.tool_output,
          metadata: event.metadata ? JSON.parse(event.metadata) : {},
          tokens: event.tokens_prompt ? {
            input: event.tokens_prompt,
            output: event.tokens_completion,
            total: event.tokens_total
          } : undefined,
          cost: event.cost || 0,
          error: event.error
        }));

        // Calculate positions for nodes
        const calculateNodePosition = (index: number) => ({
          x: (index % 3) * 300 + 100,
          y: Math.floor(index / 3) * 200 + 100
        });

        // Generate node labels
        const generateNodeLabel = (node: any, index: number): string => {
          const stepNumber = index + 1;
          switch (node.type) {
            case "llm_start":
              return "LLM Processing";
            case "llm_end":
              return "LLM Response";
            case "tool_start":
              if (node.toolName) {
                return `${node.toolName} Call`;
              }
              return "Tool Execution";
            case "tool_end":
              if (node.toolName) {
                return `${node.toolName} Result`;
              }
              return "Tool Complete";
            case "chain_start":
              return "Process Start";
            case "chain_end":
              return "Process Complete";
            default:
              return `Step ${stepNumber}`;
          }
        };

        // Calculate cost
        const calculateCost = (node: any): number => {
          if (node.cost) return node.cost;
          const tokens = node.tokens;
          if (!tokens) return 0;
          const inputCostPer1k = 0.0015;
          const outputCostPer1k = 0.002;
          const inputCost = (tokens.input || 0) / 1000 * inputCostPer1k;
          const outputCost = (tokens.output || 0) / 1000 * outputCostPer1k;
          return inputCost + outputCost;
        };

        // Estimate tokens from content
        const estimateTokensFromContent = (node: any): { input: number; output: number; total: number } | undefined => {
          let inputTokens = 0;
          let outputTokens = 0;
          if (node.prompt) inputTokens = Math.ceil(node.prompt.length / 4);
          if (node.response) outputTokens = Math.ceil(node.response.length / 4);
          if (node.toolInput) inputTokens += Math.ceil(node.toolInput.length / 4);
          if (node.toolOutput) outputTokens += Math.ceil(node.toolOutput.length / 4);
          if (inputTokens > 0 || outputTokens > 0) {
            return { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens };
          }
          return undefined;
        };

        // Transform to enhanced nodes
        const enhancedNodes = sortedNodes.map((node, index) => {
          const position = calculateNodePosition(index);
          const label = generateNodeLabel(node, index);
          return {
            id: node.id,
            label: label,
            type: node.type,
            status: node.status,
            cost: calculateCost(node),
            latency: node.latency || 0,
            tokens: node.tokens || estimateTokensFromContent(node),
            timestamp: node.startTime,
            startTime: node.startTime,
            endTime: node.endTime,
            x: position.x,
            y: position.y,
            prompt: node.prompt,
            response: node.response,
            model: node.metadata?.model || 'unknown',
            toolName: node.toolName,
            toolInput: node.toolInput,
            toolOutput: node.toolOutput,
            chainName: node.metadata?.chainName || 'unknown',
            parentRunId: node.parentRunId,
            error: node.error,
            hasLoop: false
          };
        });

        // Create edges
        const edges = events
          .filter(event => event.parent_run_id)
          .map(event => {
            const parentEvent = events.find(e => e.run_id === event.parent_run_id);
            return {
              id: `edge-${parentEvent?.event_id || event.parent_run_id}-${event.event_id}`,
              source: parentEvent?.event_id || event.parent_run_id,
              target: event.event_id,
              type: 'smoothstep',
              animated: false
            };
          });

        // Calculate stats
        const totalCost = enhancedNodes.reduce((sum, node) => sum + (node.cost || 0), 0);
        const totalLatency = enhancedNodes.reduce((sum, node) => sum + (node.latency || 0), 0);
        const llmCount = enhancedNodes.filter(n => n.type.includes("llm")).length;
        const toolCount = enhancedNodes.filter(n => n.type.includes("tool")).length;
        const chainCount = enhancedNodes.filter(n => n.type.includes("chain")).length;
        const errorCount = enhancedNodes.filter(n => n.status === "error").length;

        socket.emit("trace_data", {
          trace,
          nodes: enhancedNodes,
          edges,
          anomalies: [],
          stats: {
            totalNodes: enhancedNodes.length,
            totalCost,
            totalLatency,
            llmCount,
            toolCount,
            chainCount,
            errorCount,
            anomalyCount: 0
          }
        });
      } else {
        socket.emit("error", { message: "Trace not found" });
      }
    } catch (error) {
      console.error(`Error sending trace data for ${traceId}:`, error);
      socket.emit("error", { message: "Failed to load trace data" });
    }
  });

  // Leave trace room
  socket.on("unwatch_trace", (traceId: string) => {
    socket.leave(`trace:${traceId}`);
    console.log(`👋 Client ${socket.id} stopped watching trace: ${traceId}`);
  });

  // Join project room (for project-wide updates)
  socket.on("watch_project", (projectName: string) => {
    socket.join(`project:${projectName}`);
    console.log(`👀 Client ${socket.id} watching project: ${projectName}`);
  });

  // Leave project room
  socket.on("unwatch_project", (projectName: string) => {
    socket.leave(`project:${projectName}`);
    console.log(
      `👋 Client ${socket.id} stopped watching project: ${projectName}`
    );
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error(`❌ Socket error from ${socket.id}:`, error);
  });
});

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

// Cleanup old traces every hour (optional - remove if you want to keep all data)
// setInterval(() => {
//   try {
//     // Delete traces older than 7 days
//     const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
//     // Implement cleanup logic here
//     console.log('🧹 Cleaned up old traces');
//   } catch (error) {
//     console.error('Error during cleanup:', error);
//   }
// }, 60 * 60 * 1000);

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🚀 Agent Trace Backend Server           ║
╠════════════════════════════════════════════╣
║   HTTP:      http://localhost:${PORT}      ║
║   WebSocket: ws://localhost:${PORT}        ║
║   Health:    http://localhost:${PORT}/health ║
║   Traces:    http://localhost:${PORT}/api/traces ║
╚════════════════════════════════════════════╝
  `);
  console.log("✅ Server ready to receive traces!\n");
});

export { app, io, httpServer };
