// Minimal types mirroring the backend /api responses.

export type SpanType = 'llm' | 'tool' | 'chain' | 'retriever' | 'agent' | 'custom';
export type SpanStatus = 'complete' | 'running' | 'error';

export interface Tokens {
  input: number;
  output: number;
  total: number;
}

/** The verbatim OTEL span persisted server-side (nodes.data.raw). */
export interface RawSpan {
  name: string;
  kind: number;
  statusCode: number;
  statusMessage?: string;
  attributes: Record<string, unknown>;
  resourceAttributes: Record<string, unknown>;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  events?: Array<{ name: string; timeUnixNano: string; attributes: Record<string, unknown> }>;
}

/** A node as returned by GET /api/traces/:id. */
export interface Span {
  id: string;
  label: string;
  type: SpanType;
  status: SpanStatus;
  cost: number;
  latency: number;
  tokens?: Tokens;
  startTime: number;
  endTime?: number;
  prompts: string[];
  response: string;
  reasoning: string;
  model: string;
  toolName: string;
  toolInput: string;
  toolOutput: string;
  chainName: string;
  chainInputs: string;
  chainOutputs: string;
  parentRunId?: string;
  error?: string;
  raw: RawSpan | null;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface TraceSummary {
  id: string;
  projectName?: string;
  description?: string;
  status: SpanStatus;
  startTime: number;
  endTime?: number;
  cost: number;
  nodeCount: number;
}

export interface TraceDetail {
  trace: TraceSummary & { project: string; description: string; latency: number };
  nodes: Span[];
  edges: Edge[];
  stats: {
    totalNodes: number;
    totalCost: number;
    totalLatency: number;
    llmCount: number;
    toolCount: number;
    chainCount: number;
    errorCount: number;
  };
}
