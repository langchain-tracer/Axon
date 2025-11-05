import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import OpenAI from 'openai';
import crypto from 'node:crypto';

import llmRouter from './routes/llm';
import { TraceModel, NodeModel, EdgeModel } from './database/models.js';
import { db } from './database/connection.js';
import { initializeSchema } from './database/schema.js';
import { TraceProcessor } from './services/trace-processor.js';

import { performance } from 'node:perf_hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Environment flags
// ─────────────────────────────────────────────────────────────────────────────
const REPLAY_MODE = (process.env.REPLAY_MODE || '').toLowerCase(); // '', 'component', 'full'

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI
// ─────────────────────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ─────────────────────────────────────────────────────────────────────────────
// Tool providers (env-driven)
// ─────────────────────────────────────────────────────────────────────────────
type ToolConfig = { url: string; result_path?: string };
const TOOL_PROVIDERS: Record<string, ToolConfig> = (() => {
  try {
    return JSON.parse(process.env.TOOL_PROVIDERS || '{}');
  } catch {
    return {};
  }
})();

function normalizeQuery(s: string) {
  return (s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s,.-]/gu, '');
}

async function fetchJSON(url: string) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'axon-trace-replayer/1.0',
      Accept: 'application/json',
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

function getByPath(obj: any, path?: string) {
  if (!path) return obj;
  return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

// Geocode any free-form place (city, "city, state", etc.)
async function geocodeCity(
  q: string
): Promise<{ lat: number; lon: number } | null> {
  const input = normalizeQuery(q);
  if (!input) return null;

  // 0) Env provider hook
  const tryProvider = async () => {
    const geoCfg = TOOL_PROVIDERS['geocode'];
    if (!geoCfg?.url) return null;
    try {
      const url = geoCfg.url.replace('{q}', encodeURIComponent(input));
      console.debug('[tool] GET geocode →', url);
      const data = await fetchJSON(url);
      const lat =
        getByPath(data, 'results.0.latitude') ??
        getByPath(data, 'features.0.geometry.coordinates.1') ??
        getByPath(data, 'lat') ??
        getByPath(data, 'latitude');
      const lon =
        getByPath(data, 'results.0.longitude') ??
        getByPath(data, 'features.0.geometry.coordinates.0') ??
        getByPath(data, 'lon') ??
        getByPath(data, 'lng') ??
        getByPath(data, 'longitude');
      if (typeof lat === 'number' && typeof lon === 'number')
        return { lat, lon };
    } catch (e) {
      console.warn('[geocode] provider failed:', (e as Error).message);
    }
    return null;
  };

  // 1) Open-Meteo geocoding
  const tryOpenMeteo = async () => {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        input
      )}&count=1`;
      console.debug('[tool] GET geocode(open-meteo) →', url);
      const data = await fetchJSON(url);
      const lat = getByPath(data, 'results.0.latitude');
      const lon = getByPath(data, 'results.0.longitude');
      if (typeof lat === 'number' && typeof lon === 'number')
        return { lat, lon };
    } catch (e) {
      console.warn('[geocode] open-meteo failed:', (e as Error).message);
    }
    return null;
  };

  // 2) Nominatim
  const tryNominatim = async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        input
      )}&format=json&limit=1&addressdetails=0`;
      console.debug('[tool] GET geocode(nominatim) →', url);
      const arr = await fetchJSON(url);
      if (Array.isArray(arr) && arr[0]?.lat && arr[0]?.lon) {
        const lat = Number(arr[0].lat);
        const lon = Number(arr[0].lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
      }
    } catch (e) {
      console.warn('[geocode] nominatim failed:', (e as Error).message);
    }
    return null;
  };

  return (
    (await tryProvider()) ?? (await tryOpenMeteo()) ?? (await tryNominatim())
  );
}

// Weather normalization → always return a Fahrenheit string, e.g. "72°F"
function toFahrenheitString(
  value: unknown,
  source: 'open-meteo' | 'wttr' | 'unknown'
): string | null {
  if (value == null) return null;
  if (source === 'wttr') {
    const n = Number(value);
    if (!Number.isNaN(n)) return `${Math.round(n)}°F`;
    const s = String(value).trim();
    return s.endsWith('°F') ? s : `${s}°F`;
  }
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  const f = Math.round((n * 9) / 5 + 32);
  return `${f}°F`;
}

async function runExternalTool(toolName: string, rawInput: string) {
  const cfg = TOOL_PROVIDERS[toolName];
  if (!cfg?.url) return null;

  let url = cfg.url;
  const q = normalizeQuery(rawInput);

  if (url.includes('{q}')) url = url.replace('{q}', encodeURIComponent(q));

  if (url.includes('{lat}') || url.includes('{lon}')) {
    const coords = await geocodeCity(q);
    if (coords) {
      url = url
        .replace('{lat}', String(coords.lat))
        .replace('{lon}', String(coords.lon));
    } else if (cfg.url.includes('{q}')) {
      url = cfg.url
        .replace('{q}', encodeURIComponent(q))
        .replace(/\{lat\}|\{lon\}/g, '');
    } else {
      console.warn(
        '[tool] geocode failed and provider needs lat/lon only:',
        toolName,
        'input=',
        q
      );
      return null;
    }
  }

  if (/\{(?:lat|lon|q)\}/.test(url)) {
    console.warn('[tool] unresolved placeholders in url:', url);
    return null;
  }

  try {
    console.debug('[tool] GET', toolName, '→', url);
    const data = await fetchJSON(url);
    const value = getByPath(data, cfg.result_path);

    // ─────────────────────────────────────────────────────────────────────────
    // Special normalization for weather_api
    // ─────────────────────────────────────────────────────────────────────────
    if (toolName === 'weather_api') {
      const isOpenMeteo = /open-meteo\.com/.test(cfg.url);
      const v = value ?? data;

      // If Open-Meteo already returns Fahrenheit (because of temperature_unit=fahrenheit),
      // don't convert again — just format nicely.
      const unitIsF =
        isOpenMeteo &&
        /(?:^|[?&])temperature_unit=fahrenheit(?:&|$)/i.test(url);

      if (isOpenMeteo) {
        if (unitIsF) {
          const n = Number(v);
          if (!Number.isNaN(n)) return `${Math.round(n)}°F`;
          const s = String(v).trim();
          return s.endsWith('°F') ? s : `${s}°F`;
        }
        // Otherwise convert °C → °F
        const normalized = toFahrenheitString(v, 'open-meteo');
        return (
          normalized ?? (typeof v === 'object' ? JSON.stringify(v) : String(v))
        );
      }

      // Non-Open-Meteo fallback (e.g. wttr, others)
      const normalized = toFahrenheitString(v, 'unknown');
      return (
        normalized ?? (typeof v === 'object' ? JSON.stringify(v) : String(v))
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    return value ?? data;
  } catch (e) {
    console.warn('[tool] fetch failed:', (e as Error).message);
    return null;
  }
}

// Keep calculator built-in; everything else is env-configured tools
async function tryRunTool(
  action: string,
  input: string
): Promise<string | null> {
  const name = action.trim().toLowerCase();

  // Calculator: evaluate, NO tokens/cost elsewhere
  if (name === 'calculator') {
    if (!/^[\d\s+\-*/().]+$/.test(input)) return '(invalid expression)';
    // eslint-disable-next-line no-new-func
    const out = String(Function(`"use strict"; return (${input});`)());
    return `The result of ${input} is ${out}.`;
  }

  if (TOOL_PROVIDERS[name]) {
    let val = await runExternalTool(name, input);

    // Weather fallback chain
    if (
      val == null &&
      name === 'weather_api' &&
      TOOL_PROVIDERS['weather_api_fallback']
    ) {
      const fallback = await runExternalTool('weather_api_fallback', input);
      if (fallback != null) {
        const normalized = toFahrenheitString(fallback, 'wttr');
        val = normalized ?? fallback;
      }
    }

    if (val == null) return null;
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB init
// ─────────────────────────────────────────────────────────────────────────────
initializeSchema();
const traceProcessor = new TraceProcessor(); // retained for side-effects

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

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-4o-mini': { input: 0.005, output: 0.015 },
  'gpt-4o': { input: 0.005, output: 0.015 },
};
function priceForModel(model: string | undefined | null) {
  const m = (model || '').toLowerCase();
  if (m.includes('3.5')) return MODEL_PRICING['gpt-3.5-turbo'];
  if (m.includes('4o-mini')) return MODEL_PRICING['gpt-4o-mini'];
  if (m.includes('4o')) return MODEL_PRICING['gpt-4o'];
  if (m.includes('4-turbo') || m === 'gpt-4' || m.includes('gpt-4'))
    return MODEL_PRICING['gpt-4o'];
  return MODEL_PRICING['gpt-4o'];
}

// ─────────────────────────────────────────────────────────────────────────────
// Express + Socket.IO
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);
const DEV_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: {
    origin: DEV_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  },
  path: '/socket.io',
});

app.use(cors({ origin: DEV_ORIGIN, credentials: true }));
app.use(express.json());
app.use('/api/llm', llmRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (anomalies / labels / cost / tokens / latency / transcript grounding)
// ─────────────────────────────────────────────────────────────────────────────
function detectSimpleAnomalies(nodes: any[], _edges: any[]): SimpleAnomaly[] {
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
        ((node.cost || 0) / (avgCost || 1)) as number
      ).toFixed(1)}x average`,
      affectedNodes: [node.id],
      cost: node.cost,
    });
  }
  return anomalies;
}

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

// Cost used by REST payloads for UI — ensure tools cost 0, calculator 0
function calculateCost(node: any): number {
  if (node?.type === 'tool') return 0;
  if (node?.toolName?.toLowerCase?.() === 'calculator') return 0;
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
  // Only LLM nodes should be estimated
  if (node?.type !== 'llm') return 0;
  let inputTokens = 0,
    outputTokens = 0;
  if (node.prompt) inputTokens += Math.ceil(node.prompt.length / 4);
  if (node.response) outputTokens += Math.ceil(node.response.length / 4);
  if (node.toolInput) inputTokens += Math.ceil(node.toolInput.length / 4);
  if (node.toolOutput) outputTokens += Math.ceil(node.toolOutput.length / 4);
  const inputCostPer1k = 0.0015,
    outputCostPer1k = 0.002;
  return (
    (inputTokens / 1000) * inputCostPer1k +
    (outputTokens / 1000) * outputCostPer1k
  );
}

function estimateTokensFromContent(
  node: any
): { input: number; output: number; total: number } | undefined {
  let inputTokens = 0,
    outputTokens = 0;
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

// Looser grounding regex (allows hyphens, extra breaks)
const actionRe =
  /Action:\s*([a-zA-Z0-9_\-]+)\s*[\r\n]+Action Input:\s*([^\r\n]+?)(?=(?:\r?\n){1,2}Observation:|$)(?:(?:\r?\n)+Observation:\s*(.*))?/gi;

// --- NEW: post-facto grounding for “weather in <city> is …” when the LLM skipped Action/Observation ---
async function fillWeatherMentions(text: string): Promise<string> {
  // common phrasings we’ve seen
  const patterns = [
    /(?:current\s+)?weather\s+in\s+([A-Za-z .,'-]+?)(?:,?\s*[A-Za-z]{2})?\s+is\s*\.\.\./gi,
    /(?:current\s+)?weather\s+in\s+([A-Za-z .,'-]+?)(?:,?\s*[A-Za-z]{2})?\s+is\s+(?:unknown|not\s+available|tbd)/gi,
  ];

  let out = text;
  for (const re of patterns) {
    // Replace each match by looking up weather for captured city
    out = await (async () => {
      let m: RegExpExecArray | null;
      let rebuilt = '';
      let last = 0;
      while ((m = re.exec(out)) !== null) {
        const [full, cityRaw] = m;
        const city = (cityRaw || '').trim();
        rebuilt += out.slice(last, m.index);

        // Try primary weather_api then fallback
        let value = await runExternalTool('weather_api', city);
        if (value == null && TOOL_PROVIDERS['weather_api_fallback']) {
          const fallback = await runExternalTool('weather_api_fallback', city);
          if (fallback != null)
            value = toFahrenheitString(fallback, 'wttr') ?? String(fallback);
        }
        const pretty = value != null ? String(value) : '(unavailable)';

        // Synthesize a clean phrase
        const replacement = full.replace(/is\s*.*$/i, `is ${pretty}`);
        rebuilt += replacement;
        last = m.index + full.length;
      }
      return rebuilt + out.slice(last);
    })();
  }
  return out;
}

async function postProcessTranscript(txt: string): Promise<string> {
  let m: RegExpExecArray | null;
  let rebuilt = '';
  let lastIndex = 0;

  // Pass 1: Action/Observation grounding
  while ((m = actionRe.exec(txt)) !== null) {
    const [full, action, input] = m;
    rebuilt += txt.slice(lastIndex, m.index);

    const toolResult = await tryRunTool(action, input);
    const groundedObservation =
      toolResult !== null
        ? `Observation: ${toolResult}\n`
        : `Observation: (tool "${action}" not executed during replay — result unavailable)\n`;

    rebuilt += `Action: ${action}\nAction Input: ${input}\n${groundedObservation}`;
    lastIndex = m.index + full.length;
  }
  rebuilt += txt.slice(lastIndex);

  // Pass 2: if the LLM skipped tools, patch obvious weather holes in the final prose
  rebuilt = await fillWeatherMentions(rebuilt);

  return rebuilt;
}

// ─────────────────────────────────────────────────────────────────────────────
// Replay execution (only LLM nodes accrue cost/tokens)
// ─────────────────────────────────────────────────────────────────────────────
type ReplayOverrides = {
  costByNodeId?: Record<string, number>;
  tokensByNodeId?: Record<
    string,
    { input: number; output: number; total: number }
  >;
  promptByNodeId?: Record<string, string>;
  modelByNodeId?: Record<string, string>;
};

function isLLMNode(n: any): boolean {
  if (!n) return false;
  if (n.type === 'llm') return true;
  const m = (n.model || '').toString().toLowerCase();
  return !!m && /gpt|claude|mistral|llama|gemini/.test(m);
}

async function performReplay(
  traceId: string,
  startNodeIdOrRunId: string | undefined,
  overrides?: ReplayOverrides
) {
  const trace = TraceModel.findById(traceId);
  if (!trace) throw new Error('Trace not found');

  const rawNodes = NodeModel.findByTraceId(traceId) || [];
  const rawEdges = EdgeModel.findByTraceId(traceId) || [];

  // Normalize nodes
  const nodes = rawNodes.map((n: any) => {
    const data =
      typeof n.data === 'string' ? JSON.parse(n.data || '{}') : n.data || {};
    const tokens =
      typeof n.tokens === 'string'
        ? JSON.parse(n.tokens || '{}')
        : n.tokens || {};
    return {
      id: n.id,
      runId: n.runId,
      parentRunId: n.parentRunId,
      type: n.type,
      status: n.status,
      startTime: n.startTime,
      endTime: n.endTime,
      model: n.model || data.model || 'unknown',
      cost: n.cost || 0,
      latency: n.latency || 0,
      tokens,
      prompts: data.prompts || [],
      response: data.response || '',
      reasoning: data.reasoning || '',
      toolName: data.toolName || '',
      toolInput: data.toolInput || '',
      toolOutput: data.toolOutput || '',
      chainName: data.chainName || data.metadata?.chainName || '',
      chainInputs: data.inputs || '',
      chainOutputs: data.outputs || '',
      agentActions: data.agentActions || [],
      metadata: data.metadata || {},
      raw: n,
    };
  });

  const idToNode = new Map<string, any>(nodes.map((n) => [n.id, n]));
  const runIdToNode = new Map<string, any>(nodes.map((n) => [n.runId, n]));
  const runIdToId = new Map<string, string>(nodes.map((n) => [n.runId, n.id]));

  const resolveToNodeId = (val: string | undefined) => {
    if (!val) return undefined;
    if (idToNode.has(val)) return val;
    const maybe = runIdToId.get(val);
    return maybe && idToNode.has(maybe) ? maybe : undefined;
  };

  // Resolve start node
  let startNode =
    (startNodeIdOrRunId &&
      (idToNode.get(startNodeIdOrRunId) ||
        runIdToNode.get(startNodeIdOrRunId))) ||
    nodes.slice().sort((a, b) => (a.startTime || 0) - (b.startTime || 0))[0];
  if (!startNode) throw new Error('Start node not found for replay');

  // Canonical edges
  type CanonEdge = { fromId: string; toId: string };
  const canonEdges: CanonEdge[] = [];
  for (const e of rawEdges) {
    const fromId = resolveToNodeId((e as any).fromNode);
    const toId = resolveToNodeId((e as any).toNode);
    if (fromId && toId) canonEdges.push({ fromId, toId });
  }

  // Always add parent->child
  for (const n of nodes) {
    if (!n.parentRunId) continue;
    const parentId = runIdToId.get(n.parentRunId);
    if (parentId) canonEdges.push({ fromId: parentId, toId: n.id });
  }

  // Fallback: linear by time
  if (canonEdges.length === 0 && nodes.length > 1) {
    const sorted = nodes
      .slice()
      .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    for (let i = 0; i < sorted.length - 1; i++) {
      canonEdges.push({ fromId: sorted[i].id, toId: sorted[i + 1].id });
    }
  }

  // Build adjacency (forward / reverse)
  const buildAdj = (edges: CanonEdge[]) => {
    const adj = new Map<string, string[]>();
    for (const { fromId, toId } of edges) {
      if (!adj.has(fromId)) adj.set(fromId, []);
      adj.get(fromId)!.push(toId);
    }
    return adj;
  };
  const forwardAdj = buildAdj(canonEdges);
  const reverseAdj = buildAdj(
    canonEdges.map((e) => ({ fromId: e.toId, toId: e.fromId }))
  );

  // DFS helper
  const walk = (adj: Map<string, string[]>, start: string) => {
    const visited = new Set<string>();
    const stack = [start];
    const out: string[] = [];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      out.push(cur);
      for (const nb of adj.get(cur) || []) {
        if (!visited.has(nb)) stack.push(nb);
      }
    }
    return out;
  };

  // Pass 1
  let executedNodeIds = walk(forwardAdj, startNode.id);

  // If traversal looks anemic, retry with union of forward ∪ reverse
  const threshold = Math.max(5, Math.floor(nodes.length * 0.1));
  if (executedNodeIds.length < threshold) {
    const unionAdj = new Map<string, string[]>(forwardAdj);
    for (const [k, v] of reverseAdj) {
      if (!unionAdj.has(k)) unionAdj.set(k, []);
      unionAdj.get(k)!.push(...v);
    }
    for (const [k, v] of unionAdj) unionAdj.set(k, Array.from(new Set(v)));
    executedNodeIds = walk(unionAdj, startNode.id);
  }

  // Undirected component fallback or full
  {
    const undirected = new Map<string, Set<string>>();
    for (const { fromId, toId } of canonEdges) {
      if (!undirected.has(fromId)) undirected.set(fromId, new Set());
      if (!undirected.has(toId)) undirected.set(toId, new Set());
      undirected.get(fromId)!.add(toId);
      undirected.get(toId)!.add(fromId);
    }

    const comp: string[] = [];
    const vis = new Set<string>();
    const stack = [startNode.id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (vis.has(cur)) continue;
      vis.add(cur);
      comp.push(cur);
      for (const nb of undirected.get(cur) || [])
        if (!vis.has(nb)) stack.push(nb);
    }

    console.debug(
      '[replay] component size:',
      comp.length,
      'start:',
      startNode.id
    );

    if (REPLAY_MODE === 'full') {
      const allIds = nodes
        .slice()
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
        .map((n) => n.id);
      executedNodeIds = allIds;
    } else {
      const tooSmall =
        executedNodeIds.length < Math.max(10, Math.floor(comp.length * 0.6));
      if (tooSmall) {
        comp.sort(
          (a, b) =>
            (idToNode.get(a)?.startTime ?? 0) -
            (idToNode.get(b)?.startTime ?? 0)
        );
        executedNodeIds = comp;
      }
    }
  }

  console.debug(
    '[replay] nodes:',
    nodes.length,
    'canonEdges:',
    canonEdges.length,
    'executed:',
    executedNodeIds.length
  );

  const skippedNodes = nodes
    .map((n) => n.id)
    .filter((id) => !executedNodeIds.includes(id));
  console.debug(
    '[replay] after-component executed:',
    executedNodeIds.length,
    'skipped:',
    skippedNodes.length
  );

  // Per-node aggregation — ONLY LLM nodes accrue cost/tokens
  const nodeCosts: Record<
    string,
    {
      cost: number;
      latency: number;
      tokens: { input: number; output: number; total: number };
    }
  > = {};
  let totalCost = 0;
  let totalLatency = 0;

  for (const id of executedNodeIds) {
    const n = idToNode.get(id);
    if (!n) continue;

    const latency =
      n.latency ||
      (n.endTime && n.startTime ? Math.max(0, n.endTime - n.startTime) : 0);

    // Non-LLM (tools/chains/calculator/weather) → zeroed
    if (!isLLMNode(n) || n.toolName?.toLowerCase() === 'calculator') {
      nodeCosts[id] = {
        cost: 0,
        latency,
        tokens: { input: 0, output: 0, total: 0 },
      };
      totalLatency += latency;
      continue;
    }

    // ── MINIMAL CHANGE: add fallback token estimation if missing/zero ──
    const t = n.tokens || {};
    let inputTokens = Number((t.input ?? t.prompt ?? 0) as number);
    let outputTokens = Number((t.output ?? t.completion ?? 0) as number);
    if (inputTokens + outputTokens === 0) {
      const est = estimateTokensFromContent({
        prompt: Array.isArray(n.prompts)
          ? n.prompts.join('\n')
          : (n as any).prompt,
        response: n.response,
        toolInput: n.toolInput,
        toolOutput: n.toolOutput,
      });
      if (est) {
        inputTokens = est.input;
        outputTokens = est.output;
      }
    }
    // ──────────────────────────────────────────────────────────────────

    const model = n.model || 'gpt-3.5-turbo';
    const price = priceForModel(model);

    const overrideCost =
      typeof overrides?.costByNodeId?.[id] === 'number'
        ? overrides!.costByNodeId![id]
        : undefined;
    const overrideTokens = overrides?.tokensByNodeId?.[id];

    const computedCost =
      overrideCost ??
      (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;

    nodeCosts[id] = {
      cost: Number((computedCost || 0).toFixed(6)),
      latency,
      tokens: {
        input: overrideTokens?.input ?? inputTokens ?? 0,
        output: overrideTokens?.output ?? outputTokens ?? 0,
        total:
          overrideTokens?.total ??
          (overrideTokens
            ? overrideTokens.input + overrideTokens.output
            : (inputTokens || 0) + (outputTokens || 0)),
      },
    };

    totalCost += nodeCosts[id].cost;
    totalLatency += latency;
  }

  return {
    executedNodes: executedNodeIds,
    skippedNodes,
    totalCost,
    totalLatency,
    nodeCosts,
    sideEffects: [],
    newTraceId: null,
    startTraceId: traceId,
    startNodeId: startNode.id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('watch_trace', (arg: { traceId?: string } | string) => {
    const traceId = typeof arg === 'string' ? arg : arg?.traceId;
    if (!traceId) return;
    socket.join(`trace:${traceId}`);
    console.log(`👀 Client ${socket.id} watching trace: ${traceId}`);

    socket.on('replay_request', async (payload) => {
      console.log('🎬 Received replay_request:', payload);
      try {
        const { nodeId, traceId } = payload || {};
        const result = await performReplay(traceId, nodeId);
        socket.emit('replay_result', {
          requestId: payload?.requestId,
          success: true,
          ...result,
          totalCost: result.totalCost,
          nodeCosts: result.nodeCosts,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        socket.emit('replay_result', {
          requestId: payload?.requestId,
          success: false,
          error: message,
        });
      }
    });

    // Initial snapshot
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

  // LLM replay (LLM call → grounded transcript → graph traversal w/ overrides)
  socket.on('replay_llm_request', async (payload: any) => {
    const incomingId = payload?.requestId;
    const requestId =
      typeof incomingId === 'string' && incomingId.length
        ? incomingId
        : crypto.randomUUID();
    const traceId: string | undefined = payload?.traceId;
    const model = payload?.model || 'gpt-4o-mini';
    const rawMessages: ChatMessage[] = Array.isArray(payload?.messages)
      ? payload.messages
      : [];
    const temperature =
      typeof payload?.temperature === 'number' ? payload.temperature : 0.0;
    const maxTokens =
      typeof payload?.maxTokens === 'number' ? payload.maxTokens : 150;
    const stream = payload?.stream === true;
    const startNodeId: string | undefined =
      payload?.startNodeId ||
      payload?.nodeId ||
      payload?.selectedNodeId ||
      payload?.start;

    const startedAt = Date.now();

    console.log('🎬 replay_llm_request', {
      requestId,
      hasIncomingId: !!incomingId,
      traceId,
      model,
      stream,
      msgCount: rawMessages.length,
      startNodeId,
    });

    try {
      const messages: ChatMessage[] = rawMessages.length
        ? rawMessages.map((m: any) => ({
            role: (m.role || 'user') as 'system' | 'user' | 'assistant',
            content: m.content || '',
          }))
        : [{ role: 'user', content: 'No prompt provided.' }];

      let finalText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      if (stream) {
        const text = messages.map((m) => m.content || '').join('\n');
        inputTokens = Math.ceil(text.length / 4);

        const streamResp = await openai.chat.completions.create({
          model,
          messages: messages as any,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        });

        for await (const chunk of streamResp) {
          const delta = chunk.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            finalText += delta;
            socket.emit('replay_llm_delta', { requestId, delta });
          }
        }
        outputTokens = Math.ceil(finalText.length / 4);

        let grounded = await postProcessTranscript(finalText);
        socket.emit('replay_llm_response', {
          requestId,
          ok: true,
          text: grounded,
          timestamp: Date.now(),
        });
        if (traceId) {
          io.to(`trace:${traceId}`).emit('replay_llm_result', {
            traceId,
            requestId,
            text: grounded,
            timestamp: Date.now(),
          });
        }
        finalText = grounded;
      } else {
        const resp = await openai.chat.completions.create({
          model,
          messages: messages as any,
          temperature,
          max_tokens: maxTokens,
        });

        const finalTextRaw = resp.choices?.[0]?.message?.content ?? '';
        finalText = await postProcessTranscript(finalTextRaw);

        const u = (resp as any).usage || {};
        inputTokens = Number(u.prompt_tokens || 0);
        outputTokens = Number(u.completion_tokens || 0);

        socket.emit('replay_llm_response', {
          requestId,
          ok: true,
          text: finalText,
          timestamp: Date.now(),
        });
        if (traceId) {
          io.to(`trace:${traceId}`).emit('replay_llm_result', {
            traceId,
            requestId,
            text: finalText,
            timestamp: Date.now(),
          });
        }
      }

      // Compute replay LLM cost & traverse graph with cost override on start node if provided
      const price = priceForModel(model);
      const replayLlmCost =
        (inputTokens / 1000) * price.input +
        (outputTokens / 1000) * price.output;
      const llmLatencyMs = Date.now() - startedAt;

      let replaySummary: any = null;
      if (traceId) {
        const overrides: ReplayOverrides | undefined = startNodeId
          ? {
              costByNodeId: { [startNodeId]: replayLlmCost },
              tokensByNodeId: {
                [startNodeId]: {
                  input: inputTokens,
                  output: outputTokens,
                  total: inputTokens + outputTokens,
                },
              },
            }
          : undefined;

        replaySummary = await performReplay(traceId, startNodeId, overrides);
      }

      const finalTotalCost = replaySummary
        ? replaySummary.totalCost
        : replayLlmCost;
      const finalTotalLatency =
        (replaySummary?.totalLatency || 0) + llmLatencyMs;

      socket.emit('replay_result', {
        requestId,
        success: true,
        ...(replaySummary ?? {
          executedNodes: startNodeId ? [startNodeId] : [],
          skippedNodes: [],
          sideEffects: [],
          newTraceId: null,
          startTraceId: traceId || null,
          startNodeId: startNodeId || null,
          nodeCosts: startNodeId
            ? {
                [startNodeId]: {
                  cost: Number(replayLlmCost.toFixed(6)),
                  latency: llmLatencyMs,
                  tokens: {
                    input: inputTokens,
                    output: outputTokens,
                    total: inputTokens + outputTokens,
                  },
                },
              }
            : {},
        }),
        replayLlmCost,
        llmTokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        totalCost: finalTotalCost,
        totalLatency: finalTotalLatency,
      });

      console.log('✅ replay_done', {
        requestId,
        finalTotalCost: Number(finalTotalCost).toFixed(6),
      });
    } catch (err: any) {
      console.error('❌ replay_llm_request error:', err?.message || err);
      socket.emit('replay_result', {
        requestId,
        success: false,
        executedNodes: [],
        skippedNodes: [],
        totalCost: 0,
        totalLatency: 0,
        sideEffects: [],
        newTraceId: null,
        error: err?.message || 'Replay failed',
      });
      socket.emit('replay_llm_response', {
        requestId,
        ok: false,
        error: err?.message || 'LLM call failed',
      });
    }
  });

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
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    providers_loaded: Object.keys(TOOL_PROVIDERS),
    replay_mode: REPLAY_MODE || '(default)',
  });
});

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
      // NOTE: tools (including calculator) have zero cost via calculateCost
      const nodes = db.query('SELECT * FROM nodes WHERE trace_id = ?', [
        trace.id,
      ]);
      const totalCost = nodes.reduce(
        (sum: number, n: any) => sum + calculateCost(n),
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
        model: node.model || (data as any).model || 'unknown',
        cost: calculateCost(node), // ensure tools are zeroed
        latency: node.latency || 0,
        tokens:
          typeof node.tokens === 'string'
            ? JSON.parse(node.tokens)
            : node.tokens,
        prompts: (data as any).prompts || [],
        response: (data as any).response || '',
        reasoning: (data as any).reasoning || '',
        toolName: (data as any).toolName || '',
        toolInput: (data as any).toolInput || '',
        toolOutput: (data as any).toolOutput || '',
        chainName: (data as any).chainName || '',
        chainInputs: (data as any).inputs || '',
        chainOutputs: (data as any).outputs || '',
        agentActions: (data as any).agentActions || [],
        error: node.error,
        metadata: (data as any).metadata || {},
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
        cost: node.cost,
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
        chainName:
          node.chainName || (node as any).metadata?.chainName || 'unknown',
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
    const totalCost = enhancedNodes.reduce(
      (sum, n: any) => sum + (n.cost || 0),
      0
    );

    const enhancedTrace = {
      ...trace,
      project: (trace as any).projectName || 'default',
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
      cost: calculateCost(node),
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
      ...new Set(traces.map((t) => (t as any).projectName || 'default')),
    ];

    const projectStats = projects.map((project) => {
      const projectTraces = traces.filter(
        (t) => ((t as any).projectName || 'default') === project
      );
      const totalCost = projectTraces.reduce(
        (sum, t) => sum + ((t as any).totalCost || 0),
        0
      );
      return {
        name: project,
        traceCount: projectTraces.length,
        totalCost,
        lastActivity: Math.max(
          ...projectTraces.map((t) => (t as any).startTime)
        ),
      };
    });

    res.json({ projects: projectStats });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Debug endpoints
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/debug/tool', async (req, res) => {
  try {
    const name = String(req.query.name || '');
    const q = String(req.query.q || '');
    if (!name) return res.status(400).json({ error: 'missing name' });

    let val = await runExternalTool(name, q);

    if (
      val == null &&
      name === 'weather_api' &&
      TOOL_PROVIDERS['weather_api_fallback']
    ) {
      val = await runExternalTool('weather_api_fallback', q);
    }

    res.json({
      name,
      q,
      ok: val != null,
      value: val,
      providers: Object.keys(TOOL_PROVIDERS),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'tool failed' });
  }
});

// Convenience: normalized weather demo
app.get('/api/debug/weather', async (req, res) => {
  try {
    const q = String(req.query.q || '');
    if (!q) return res.status(400).json({ error: 'missing q' });
    let v = await runExternalTool('weather_api', q);
    if (v == null && TOOL_PROVIDERS['weather_api_fallback']) {
      v = await runExternalTool('weather_api_fallback', q);
      if (v != null) v = toFahrenheitString(v, 'wttr');
    }
    res.json({ q, value: v });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'weather failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Start server
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

  console.log('🔧 REPLAY_MODE:', REPLAY_MODE || '(default)');
  if (!process.env.TOOL_PROVIDERS) {
    console.warn(
      '⚠️  TOOL_PROVIDERS not set. Weather/geocode tools will be unavailable.'
    );
  } else {
    try {
      const parsed = JSON.parse(process.env.TOOL_PROVIDERS);
      console.log('🔧 TOOL_PROVIDERS loaded keys:', Object.keys(parsed));
    } catch {
      console.warn('⚠️  TOOL_PROVIDERS is not valid JSON.');
    }
  }

  console.log('✅ Server ready to receive traces!\n');
});

export { app, io, httpServer };
