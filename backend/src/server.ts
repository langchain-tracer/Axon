import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import OpenAI from 'openai';

import llmRouter from './routes/llm';
import { TraceModel, NodeModel, EdgeModel } from './database/models.js';
import { db } from './database/connection.js';
import { initializeSchema } from './database/schema.js';
// import { TraceEvent } from "./types/index.js"; // (currently unused)
import { TraceProcessor } from './services/trace-processor.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Initialize database schema on startup
initializeSchema();

// Initialize trace processor
const traceProcessor = new TraceProcessor();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SimpleAnomaly {
  type: string;
  severity: string;
  title: string;
  description: string;
  affectedNodes: string[];
  cost?: number;
  latency?: number;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ReplayLLMRequest = {
  requestId: string;
  traceId?: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// App / Server / CORS
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

const DEV_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Socket.IO (CORS aligned with Vite)
const io = new Server(httpServer, {
  cors: {
    origin: DEV_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  },
});

// Express CORS + JSON
app.use(cors({ origin: DEV_ORIGIN, credentials: true }));
app.use(express.json());

// REST: LLM proxy (if you use REST for some paths)
app.use('/api/llm', llmRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function detectSimpleAnomalies(nodes: any[], edges: any[]): SimpleAnomaly[] {
  const anomalies: SimpleAnomaly[] = [];
  if (nodes.length === 0) return anomalies;

  const totalCost = nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
  const avgCost = totalCost / nodes.length || 0;
  const expensiveThreshold = avgCost * 3;

  const expensiveNodes = nodes.filter(
    (n) => (n.cost || 0) > expensiveThreshold
  );
  for (const node of expensiveNodes) {
    anomalies.push({
      type: 'expensive_operation',
      severity: (node.cost || 0) > avgCost * 5 ? 'high' : 'medium',
      title: 'Expensive Operation',
      description: `Operation costs $${(node.cost || 0).toFixed(6)}, ${(
        (node.cost || 0) / (avgCost || 1)
      ).toFixed(1)}x average`,
      affectedNodes: [node.id],
      cost: node.cost,
    });
  }

  // Redundant tool calls (same toolName + toolInput)
  const toolCalls = nodes.filter((node) => node.type?.includes('tool_start'));
  const toolCallGroups = new Map<string, any[]>();
  for (const call of toolCalls) {
    const key = `${call.toolName}-${call.toolInput}`;
    if (!toolCallGroups.has(key)) toolCallGroups.set(key, []);
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
        affectedNodes: calls.map((c) => c.id),
        cost: calls.reduce((sum, c) => sum + (c.cost || 0), 0),
      });
    }
  }

  return anomalies;
}

// Generate human-readable label for a node (was commented but used later)
function generateNodeLabel(node: any, index: number): string {
  const stepNumber = index + 1;
  switch (node.type) {
    case 'llm_start':
      return 'LLM Processing';
    case 'llm_end':
      return 'LLM Response';
    case 'tool_start':
      return node.toolName ? `${node.toolName} Call` : 'Tool Execution';
    case 'tool_end':
      return node.toolName ? `${node.toolName} Result` : 'Tool Complete';
    case 'chain_start':
      return 'Process Start';
    case 'chain_end':
      return 'Process Complete';
    case 'llm':
      return node.metadata?.model || `LLM Call ${stepNumber}`;
    case 'tool':
      return node.toolName || `Tool Call ${stepNumber}`;
    case 'chain':
      return node.metadata?.chainName || `Chain ${stepNumber}`;
    default:
      return `Step ${stepNumber}`;
  }
}

function calculateCost(node: any): number {
  if (node.cost) return node.cost;
  const tokens = node.tokens;
  if (!tokens) return estimateCostFromContent(node);
  const inputCostPer1k = 0.0015;
  const outputCostPer1k = 0.002;
  const inputCost = ((tokens.input || 0) / 1000) * inputCostPer1k;
  const outputCost = ((tokens.output || 0) / 1000) * outputCostPer1k;
  return inputCost + outputCost;
}

function estimateCostFromContent(node: any): number {
  let inputTokens = 0;
  let outputTokens = 0;
  if (node.prompt) inputTokens += Math.ceil(node.prompt.length / 4);
  if (node.response) outputTokens += Math.ceil(node.response.length / 4);
  if (node.toolInput) inputTokens += Math.ceil(node.toolInput.length / 4);
  if (node.toolOutput) outputTokens += Math.ceil(node.toolOutput.length / 4);

  const inputCostPer1k = 0.0015;
  const outputCostPer1k = 0.002;
  return (
    (inputTokens / 1000) * inputCostPer1k +
    (outputTokens / 1000) * outputCostPer1k
  );
}

function estimateTokensFromContent(
  node: any
): { input: number; output: number; total: number } | undefined {
  let inputTokens = 0;
  let outputTokens = 0;
  if (node.prompt) inputTokens += Math.ceil(node.prompt.length / 4);
  if (node.response) outputTokens += Math.ceil(node.response.length / 4);
  if (node.toolInput) inputTokens += Math.ceil(node.toolInput.length / 4);
  if (node.toolOutput) outputTokens += Math.ceil(node.toolOutput.length / 4);

  if (inputTokens > 0 || outputTokens > 0) {
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    };
  }
  return undefined;
}

function calculateNodePosition(index: number): { x: number; y: number } {
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: 200 + col * 250, y: 100 + row * 200 };
}

function generateTraceDescription(trace: any, nodes: any[]): string {
  const status = trace.status || 'running';
  const nodeCount = nodes.length;
  const firstLLMNode = nodes.find((n) => n.type === 'llm');
  if (firstLLMNode?.data?.prompts?.[0]) {
    const prompt = firstLLMNode.data.prompts[0];
    return prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
  }
  if (status === 'complete') return `Completed with ${nodeCount} steps`;
  if (status === 'error') return `Failed at step ${nodeCount}`;
  return `Processing (${nodeCount} steps so far)`;
}

function calculateTraceLatency(trace: any): number {
  if (trace.endTime && trace.startTime) return trace.endTime - trace.startTime;
  return Date.now() - trace.startTime;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// ─────────────────────────────────────────────────────────────────────────────
// REST API: Traces / Stats
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/traces', (req, res) => {
  try {
    const { project } = req.query;
    const traces = project
      ? TraceModel.list({
          projectName: project as string,
          limit: 100,
          offset: 0,
        })
      : TraceModel.list({ limit: 100, offset: 0 });

    if (!traces) return res.json({ traces: [], total: 0 });

    const enhancedTraces = traces.map((trace: any) => {
      const nodes = db.query(
        'SELECT cost, type FROM nodes WHERE trace_id = ?',
        [trace.id]
      );
      const totalCost = nodes.reduce(
        (sum: number, n: any) => sum + (n.cost || 0),
        0
      );
      return { ...trace, cost: totalCost, nodeCount: nodes.length };
    });

    res.json({
      traces: enhancedTraces || [],
      total: (enhancedTraces || []).length,
    });
  } catch (error: any) {
    console.error('Error listing traces:', error);
    res
      .status(500)
      .json({ error: 'Failed to list traces', message: error.message });
  }
});

app.get('/api/traces/:traceId', (req, res) => {
  try {
    const { traceId } = req.params;
    const trace = TraceModel.findById(traceId);
    if (!trace) return res.status(404).json({ error: 'Trace not found' });

    const nodes = NodeModel.findByTraceId(traceId).map((node) => {
      const data =
        typeof node.data === 'string' ? JSON.parse(node.data) : node.data;
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
        tokens:
          typeof node.tokens === 'string'
            ? JSON.parse(node.tokens)
            : node.tokens,
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
        createdAt: new Date(node.createdAt),
      };
    });

    const runIdToNodeId = new Map(nodes.map((n) => [n.runId, n.id]));
    const edgesFromDB = EdgeModel.findByTraceId(traceId);
    const edges = edgesFromDB
      .map((edge) => {
        const sourceNodeId = runIdToNodeId.get(edge.fromNode);
        const targetNodeId = runIdToNodeId.get(edge.toNode);
        if (!sourceNodeId || !targetNodeId) return null;
        return {
          id: edge.id,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'smoothstep',
          animated: false,
        };
      })
      .filter((e) => e !== null) as any[];

    const anomalies = detectSimpleAnomalies(nodes as any[], edges);

    const sortedNodes = (nodes as any[]).sort(
      (a, b) => a.startTime - b.startTime
    );
    const enhancedNodes = sortedNodes.map((node, index) => {
      const position = calculateNodePosition(index);
      const label = generateNodeLabel(node, index);
      return {
        id: node.id,
        label,
        type: node.type,
        status: node.status,
        cost: calculateCost(node),
        latency: node.latency || 0,
        tokens: node.tokens
          ? {
              input: node.tokens.input || 0,
              output: node.tokens.output || 0,
              total:
                node.tokens.total ||
                (node.tokens.input || 0) + (node.tokens.output || 0),
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
        hasLoop: anomalies.some(
          (a) => a.type === 'loop' && a.affectedNodes?.includes(node.runId)
        ),
      };
    });

    const latency = calculateTraceLatency(trace);
    const totalCost = nodes.reduce((sum, n: any) => sum + (n.cost || 0), 0);

    const enhancedTrace = {
      ...trace,
      project: trace.projectName || 'default',
      timestamp: trace.startTime,
      nodeCount: (trace as any).totalNodes || nodes.length,
      cost: totalCost,
      latency,
      description: generateTraceDescription(trace, nodes as any[]),
    };

    res.json({
      trace: enhancedTrace,
      nodes: enhancedNodes,
      edges,
      anomalies,
      stats: {
        totalNodes: nodes.length,
        totalCost,
        totalLatency: latency,
        llmCount: enhancedNodes.filter((n) => n.type.includes('llm')).length,
        toolCount: enhancedNodes.filter((n) => n.type.includes('tool')).length,
        chainCount: enhancedNodes.filter((n) => n.type.includes('chain'))
          .length,
        errorCount: enhancedNodes.filter((n) => n.status === 'error').length,
        anomalyCount: anomalies.length,
      },
    });
  } catch (error) {
    console.error('Error getting trace:', error);
    res.status(500).json({ error: 'Failed to get trace' });
  }
});

app.get('/api/traces/:traceId/events', (req, res) => {
  try {
    const { traceId } = req.params;
    const trace = TraceModel.findById(traceId);
    if (!trace) return res.status(404).json({ error: 'Trace not found' });

    const nodes = NodeModel.findByTraceId(traceId);
    const events = nodes.map((node) => ({
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
    res.json({ events });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

app.get('/api/stats', (_req, res) => {
  try {
    const traces = TraceModel.list({ limit: 1000, offset: 0 });
    const totalCost = traces.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const totalNodes = traces.reduce((sum, t) => sum + (t.totalNodes || 0), 0);
    const completedTraces = traces.filter(
      (t) => t.status === 'complete'
    ).length;
    const runningTraces = traces.filter((t) => t.status === 'running').length;
    const failedTraces = traces.filter((t) => t.status === 'error').length;

    res.json({
      totalTraces: traces.length,
      completedTraces,
      runningTraces,
      failedTraces,
      totalCost,
      totalNodes,
      averageCostPerTrace: traces.length ? totalCost / traces.length : 0,
      averageNodesPerTrace: traces.length ? totalNodes / traces.length : 0,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

app.get('/api/projects', (_req, res) => {
  try {
    const traces = TraceModel.list({ limit: 1000, offset: 0 });
    const projects = [
      ...new Set(traces.map((t) => t.projectName || 'default')),
    ];

    const projectStats = projects.map((project) => {
      const projectTraces = traces.filter(
        (t) => (t.projectName || 'default') === project
      );
      const totalCost = projectTraces.reduce(
        (sum, t) => sum + (t.totalCost || 0),
        0
      );
      return {
        name: project,
        traceCount: projectTraces.length,
        totalCost,
        lastActivity: Math.max(...projectTraces.map((t) => t.startTime)),
      };
    });

    res.json({ projects: projectStats });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/** SOCKET.IO CONNECTION HANDLING */
// ─────────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Normalize watch_trace payload (accepts {traceId} or "traceId")
  socket.on('watch_trace', (arg: { traceId?: string } | string) => {
    const traceId = typeof arg === 'string' ? arg : arg?.traceId;
    if (!traceId) return;
    socket.join(`trace:${traceId}`);
    console.log(`👀 Client ${socket.id} watching trace: ${traceId}`);

    try {
      const trace = TraceModel.findById(traceId);
      if (!trace) return;
      const nodes = NodeModel.findByTraceId(traceId);
      const edges = EdgeModel.findByTraceId(traceId);

      socket.emit('trace_data', {
        trace,
        nodes: nodes ?? [],
        edges: edges ?? [],
        anomalies: [],
        stats: {
          totalNodes: nodes?.length ?? 0,
          totalCost: 0,
          totalLatency: 0,
          llmCount: 0,
          toolCount: 0,
          chainCount: 0,
          errorCount: 0,
          anomalyCount: 0,
        },
      });
    } catch (e) {
      console.error('Failed to send initial trace snapshot:', e);
    }
  });

  // LLM Replay via Socket.IO
  socket.on('replay_llm_request', async (payload: ReplayLLMRequest) => {
    console.log('🎯 replay_llm_request', {
      requestId: payload?.requestId,
      model: payload?.model,
      msgCount: payload?.messages?.length,
    });
    let {
      requestId,
      traceId,
      model = 'gpt-4o-mini',
      messages,
      temperature = 0.7,
      maxTokens = 512,
      stream = false,
    } = payload || ({} as ReplayLLMRequest);

    const MODEL_MAP: Record<string, string> = {
      'gpt-3.5-turbo': 'gpt-4o-mini',
      'gpt-3.5-turbo-0125': 'gpt-4o-mini',
      'gpt-4': 'gpt-4o-mini',
    };
    model = MODEL_MAP[model] ?? model;
    console.log('🧪 normalized model:', model);

    const fail = (msg: string) => {
      console.error('❌ replay_llm_request error:', { requestId, model, msg });
      socket.emit('replay_llm_response', { requestId, ok: false, error: msg });
    };

    try {
      if (!model || !Array.isArray(messages))
        return fail('model and messages are required');
      if (!process.env.OPENAI_API_KEY)
        return fail('OPENAI_API_KEY is not set on backend');

      if (!stream) {
        const resp = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        });
        const text =
          resp.choices?.[0]?.message?.content ??
          resp.choices?.[0]?.delta?.content ??
          '';

        socket.emit('replay_llm_response', {
          requestId,
          ok: true,
          text,
          timestamp: Date.now(),
        });
        console.log('✅ replay_llm_response (oneshot)', {
          requestId,
          length: text.length,
        });

        if (traceId) {
          io.to(`trace:${traceId}`).emit('replay_llm_result', {
            traceId,
            text,
            timestamp: Date.now(),
          });
        }
        return;
      }

      // streaming mode
      const streamResp = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      let full = '';
      for await (const chunk of streamResp) {
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          socket.emit('replay_llm_delta', { requestId, delta });
        }
      }

      socket.emit('replay_llm_response', {
        requestId,
        ok: true,
        text: full,
        timestamp: Date.now(),
      });
      console.log('✅ replay_llm_response (streamed)', {
        requestId,
        length: full.length,
      });

      if (traceId) {
        io.to(`trace:${traceId}`).emit('replay_llm_result', {
          traceId,
          text: full,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      console.error('replay_llm_request error:', err);
      fail(err?.message || 'LLM call failed');
    }
  });

  // (you can add your trace_events / openai_events handlers here)

  socket.on('unwatch_trace', (traceId: string) => {
    socket.leave(`trace:${traceId}`);
    console.log(`👋 Client ${socket.id} stopped watching trace: ${traceId}`);
  });

  socket.on('watch_project', (projectName: string) => {
    socket.join(`project:${projectName}`);
    console.log(`👀 Client ${socket.id} watching project: ${projectName}`);
  });

  socket.on('unwatch_project', (projectName: string) => {
    socket.leave(`project:${projectName}`);
    console.log(
      `👋 Client ${socket.id} stopped watching project: ${projectName}`
    );
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error(`❌ Socket error from ${socket.id}:`, error);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

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
  console.log('✅ Server ready to receive traces!\n');
});

export { app, io, httpServer };
