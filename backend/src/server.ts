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
  EdgeModel,
  AnomalyModel
} from "./database/models";
import { TraceEvent } from "./types";

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
  if (node.type === "llm") {
    return node.data?.model || `LLM Call ${index + 1}`;
  } else if (node.type === "tool") {
    return node.data?.toolName || `Tool Call ${index + 1}`;
  } else if (node.type === "chain") {
    return node.data?.chainName || `Chain ${index + 1}`;
  }
  return `Step ${index + 1}`;
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

    res.json({
      traces: traces || [], // ← Ensure it's always an array
      total: (traces || []).length
    });
  } catch (error) {
    console.error("Error listing traces:", error);
    res.status(500).json({
      error: "Failed to list traces",
      message: error.message // ← Send actual error message
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

    // Get related data
    const nodes = NodeModel.findByTraceId(traceId);
    const edges = EdgeModel.findByTraceId(traceId);
    const anomalies = AnomalyModel.findByTraceId(traceId);

    // Sort nodes by start time
    const sortedNodes = nodes.sort((a, b) => a.startTime - b.startTime);

    // Enhance nodes with frontend-compatible fields
    const enhancedNodes = sortedNodes.map((node, index) => {
      const position = calculateNodePosition(index);
      const label = generateNodeLabel(node, index);

      return {
        // Core fields
        id: node.runId, // Use runId as the display ID
        label: label,
        type: node.type,
        status: node.status,

        // Metrics
        cost: node.cost || 0,
        latency: node.latency || 0,
        tokens: node.tokens
          ? {
              input: node.tokens.input || 0,
              output: node.tokens.output || 0,
              total: node.tokens.total || 0
            }
          : undefined,

        // Timing
        timestamp: node.startTime,
        startTime: node.startTime,
        endTime: node.endTime,

        // Graph layout
        x: position.x,
        y: position.y,

        // Type-specific data
        prompt: node.data?.prompts?.[0],
        response: node.data?.response,
        model: node.data?.model,
        toolName: node.data?.toolName,
        toolParams: node.data?.input,
        toolResponse: node.data?.output,
        chainName: node.data?.chainName,

        // Relationships
        parentRunId: node.parentRunId,

        // Error info
        error: node.error,

        // Anomaly detection
        hasLoop: anomalies.some(
          (a) => a.type === "loop" && a.nodes?.includes(node.runId)
        )
      };
    });

    // Calculate trace latency
    const latency = calculateTraceLatency(trace);

    // Enhanced trace object
    const enhancedTrace = {
      ...trace,
      project: trace.projectName || "default",
      timestamp: trace.startTime,
      nodeCount: trace.totalNodes || nodes.length,
      cost: trace.totalCost || 0,
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
        totalCost: trace.totalCost || 0,
        totalLatency: latency,
        llmCount: nodes.filter((n) => n.type === "llm").length,
        toolCount: nodes.filter((n) => n.type === "tool").length,
        chainCount: nodes.filter((n) => n.type === "chain").length,
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
      // storage.addEvents(events);

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

  // Join trace room (for dashboard to receive updates)
  socket.on("watch_trace", (traceId: string) => {
    socket.join(`trace:${traceId}`);
    console.log(`👀 Client ${socket.id} watching trace: ${traceId}`);

    // Send existing trace data
    try {
      const trace = TraceModel.findById(traceId);
      if (trace) {
        const nodes = NodeModel.findByTraceId(traceId);
        const edges = EdgeModel.findByTraceId(traceId);

        socket.emit("trace_data", {
          trace,
          nodes,
          edges
        });
      }
    } catch (error) {
      console.error(`Error sending trace data for ${traceId}:`, error);
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
