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
  NodeModel,
  EdgeModel
} from "./database/models.js";
import { db } from "./database/connection.js";
import { initializeSchema } from "./database/schema.js";
import { TraceEvent } from "./types/index.js";
import { TraceProcessor } from "./services/trace-processor.js";
import { generateNodeLabel, calculateCost, calculateNodePosition } from "./utils/nodeUtils.js";

// Initialize database schema on startup
initializeSchema();

// Initialize trace processor
const traceProcessor = new TraceProcessor();

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

    // Enhance traces with cost and node count from nodes table
    const enhancedTraces = traces.map((trace: any) => {
      const nodes = db.query("SELECT cost, type FROM nodes WHERE trace_id = ?", [trace.id]);
      const totalCost = nodes.reduce((sum: number, node: any) => sum + (node.cost || 0), 0);
      const nodeCount = nodes.length;
      
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

    // Get nodes from the nodes table
    const nodes = NodeModel.findByTraceId(traceId).map((node) => {
      const data = typeof node.data === 'string' ? JSON.parse(node.data) : node.data;
      return {
        id: node.id,
        runId: node.runId,
        parentRunId: node.parentRunId,
        type: node.type,
        status: node.status,
        startTime: node.startTime,
        endTime: node.endTime,
        model: node.model || data.model || 'unknown',
        cost: node.cost || 0,
        latency: node.latency || 0,
        tokens: typeof node.tokens === 'string' ? JSON.parse(node.tokens) : node.tokens,
        prompts: data.prompts || [],
        response: data.response || '',
        reasoning: data.reasoning || '',
        toolName: data.toolName || '',
        toolInput: data.toolInput || '',
        toolOutput: data.toolOutput || '',
        chainName: data.chainName || '',
        chainInputs: data.inputs || '',
        chainOutputs: data.outputs || '',
        agentActions: data.agentActions || [],
        error: node.error,
        metadata: data.metadata || {},
        createdAt: new Date(node.createdAt)
      };
    });
    
    // Create edges based on parent-child relationships
    // Map run_id to node id for React Flow
    const runIdToNodeId = new Map(nodes.map(n => [n.runId, n.id]));
    console.log(`[DEBUG] nodes array length: ${nodes.length}`);
    console.log(`[DEBUG] First 3 nodes:`, nodes.slice(0, 3).map(n => ({ id: n.id, runId: n.runId, type: n.type })));
    console.log(`[DEBUG] runIdToNodeId map size: ${runIdToNodeId.size}`);
    console.log(`[DEBUG] First 3 map entries:`, Array.from(runIdToNodeId.entries()).slice(0, 3));
    
    const edgesFromDB = EdgeModel.findByTraceId(traceId);
    console.log(`[DEBUG] edges from DB: ${edgesFromDB.length}`);
    if (edgesFromDB.length > 0) {
      console.log(`[DEBUG] First edge:`, edgesFromDB[0]);
      console.log(`[DEBUG] Lookup from_node in map:`, runIdToNodeId.get(edgesFromDB[0].fromNode));
      console.log(`[DEBUG] Lookup to_node in map:`, runIdToNodeId.get(edgesFromDB[0].toNode));
    }
    
    const edges = edgesFromDB
      .map(edge => {
        const sourceNodeId = runIdToNodeId.get(edge.fromNode);
        const targetNodeId = runIdToNodeId.get(edge.toNode);
        
        if (!sourceNodeId || !targetNodeId) {
          console.log(`[DEBUG] Mapping failed for edge ${edge.id}: from=${edge.fromNode} (found: ${sourceNodeId}) to=${edge.toNode} (found: ${targetNodeId})`);
          return null;
        }
        
        return {
          id: edge.id,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'smoothstep',
          animated: false
        };
      })
      .filter(edge => edge !== null);
    
    console.log(`[DEBUG] Successfully mapped ${edges.length} out of ${edgesFromDB.length} edges`);
    
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
        prompts: node.prompts,
        response: node.response,
        reasoning: node.reasoning,
        model: node.model || 'unknown',
        toolName: node.toolName,
        toolInput: node.toolInput,
        toolOutput: node.toolOutput,
        chainName: node.chainName || node.metadata?.chainName || 'unknown',
        chainInputs: node.chainInputs,
        chainOutputs: node.chainOutputs,
        agentActions: node.agentActions,

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

      // Process each event using the new trace processor
      for (const event of events) {
        traceProcessor.processEvent(event);
        // Broadcast to dashboard clients (for real-time updates)
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
        traceProcessor.processEvent(event);

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
        // Get nodes from the nodes table
        const nodes = NodeModel.findByTraceId(traceId);
        const edges = EdgeModel.findByTraceId(traceId);
        
        if (nodes.length === 0) {
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

        // Transform nodes for frontend (same logic as API endpoint)
        const sortedNodes = nodes.map((node: any) => {
          const data = typeof node.data === 'string' ? JSON.parse(node.data) : node.data;
          return {
            id: node.id,
            type: node.type,
            status: node.status,
            startTime: node.startTime,
            endTime: node.endTime,
            model: node.model || data.model || 'unknown',
            latency: node.latency || 0,
            runId: node.runId,
            parentRunId: node.parentRunId,
            prompts: data.prompts || [],
            response: data.response || '',
            reasoning: data.reasoning || '',
            toolName: data.toolName || '',
            toolInput: data.toolInput || '',
            toolOutput: data.toolOutput || '',
            chainName: data.chainName || '',
            chainInputs: data.inputs || '',
            chainOutputs: data.outputs || '',
            agentActions: data.agentActions || [],
            metadata: data.metadata || {},
            tokens: typeof node.tokens === 'string' ? JSON.parse(node.tokens) : node.tokens,
            cost: node.cost || 0,
            error: node.error
          };
        });

        // Calculate positions for nodes



        // Transform to enhanced nodes
        const enhancedNodes = sortedNodes.map((node, index) => {
          const position = calculateNodePosition(index);
          const label = generateNodeLabel(node, index);
          return {
            id: node.id,
            label: label,
            type: node.type,
            status: node.status,
            cost: calculateCost(node) || 0,
            latency: node.latency || 0,
            tokens: node.tokens || estimateTokensFromContent(node),
            timestamp: node.startTime,
            startTime: node.startTime,
            endTime: node.endTime,
            x: position.x,
            y: position.y,
            prompts: node.prompts,
            response: node.response,
            reasoning: node.reasoning,
            model: node.model || 'unknown',
            toolName: node.toolName,
            toolInput: node.toolInput,
            toolOutput: node.toolOutput,
            chainName: node.chainName || node.metadata?.chainName || 'unknown',
            chainInputs: node.chainInputs,
            chainOutputs: node.chainOutputs,
            agentActions: node.agentActions,
            parentRunId: node.parentRunId,
            error: node.error,
            hasLoop: false
          };
        });

        // Create edges - map run_id to node id for React Flow
        const runIdToNodeId = new Map(sortedNodes.map((n: any) => [n.runId, n.id]));
        const edgesData = EdgeModel.findByTraceId(traceId)
          .map((edge: any) => {
            const sourceNodeId = runIdToNodeId.get(edge.fromNode);
            const targetNodeId = runIdToNodeId.get(edge.toNode);
            
            if (!sourceNodeId || !targetNodeId) {
              return null;
            }
            
            return {
              id: edge.id,
              source: sourceNodeId,
              target: targetNodeId,
              type: 'smoothstep',
              animated: false
            };
          })
          .filter((edge: any) => edge !== null);

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
          edges: edgesData,
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

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1'; // Use 127.0.0.1 to avoid EPERM on macOS

httpServer.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🚀 Agent Trace Backend Server           ║
╠════════════════════════════════════════════╣
║   HTTP:      http://${HOST}:${PORT}      ║
║   WebSocket: ws://${HOST}:${PORT}        ║
║   Health:    http://${HOST}:${PORT}/health ║
║   Traces:    http://${HOST}:${PORT}/api/traces ║
╚════════════════════════════════════════════╝
  `);
  console.log("✅ Server ready to receive traces!\n");
});

export { app, io, httpServer };
