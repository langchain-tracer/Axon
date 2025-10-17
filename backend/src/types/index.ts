/**
 * Shared TypeScript types for backend
 */

// ============================================================================
// Node Types
// ============================================================================

export type NodeType = "llm" | "tool" | "chain" | "agent";
export type NodeStatus = "pending" | "running" | "complete" | "error";

// ============================================================================
// Anomaly Types
// ============================================================================

export type AnomalyType =
  | "loop"
  | "contradiction"
  | "cost_spike"
  | "timeout_risk";
export type AnomalySeverity = "low" | "medium" | "high" | "critical";

// ============================================================================
// Trace Events
// ============================================================================

export interface TraceEvent {
  eventId: string;
  traceId: string;
  runId: string;
  parentRunId?: string;
  timestamp: number;
  type: string;
  metadata?: Record<string, any>;

  // LLM properties (optional)
  model?: string;
  prompts?: string[];
  response?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  latency?: number;
  invocationParams?: Record<string, any>;

  // Tool properties (optional)
  toolName?: string;
  input?: string | Record<string, any>;
  output?: string;

  // Chain properties (optional)
  chainName?: string;
  inputs?: any;
  outputs?: any;

  // Error properties (optional)
  error?: string;
  stack?: string;
  stackTrace?: string;
}

export interface LLMStartEvent extends TraceEvent {
  type: "llm_start";
  model: string;
  prompts: string[];
  invocationParams?: Record<string, any>;
}

export interface LLMEndEvent extends TraceEvent {
  type: "llm_end";
  response: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  latency: number;
}

export interface ToolStartEvent extends TraceEvent {
  type: "tool_start";
  toolName: string;
  input: string | Record<string, any>;
}

export interface ToolEndEvent extends TraceEvent {
  type: "tool_end";
  toolName: string;
  output: string;
  latency: number;
}

export interface ChainStartEvent extends TraceEvent {
  type: "chain_start";
  chainName: string;
  inputs: any;
}

export interface ChainEndEvent extends TraceEvent {
  type: "chain_end";
  chainName: string;
  outputs: any;
  latency: number;
}

export interface ErrorEvent extends TraceEvent {
  type: "error";
  error: string;
  stackTrace?: string;
  stack?: string;
}

// ============================================================================
// Database Models
// ============================================================================

/**
 * Base trace information
 */
export interface Trace {
  id: string; // ✅ Lowercase 'id'
  projectName: string;
  startTime: number;
  endTime?: number;
  status: "running" | "complete" | "error";
  totalCost: number;
  totalNodes: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Trace with full event details
 */
export interface TraceWithEvents extends Trace {
  events: TraceEvent[];
  nodes?: Node[];
  edges?: Edge[];
  anomalies?: Anomaly[];
}

/**
 * Minimal trace info for list views
 */
export interface TraceListItem {
  id: string;
  projectName: string;
  startTime: number;
  endTime?: number;
  status: "running" | "complete" | "error";
  totalCost: number;
  totalNodes: number;
}

/**
 * Statistics about a trace execution
 */
export interface TraceStats {
  totalEvents: number;
  llmCalls: number;
  toolCalls: number;
  totalCost: number;
  totalLatency: number;
  errors: number;
}

export interface Node {
  id: string;
  traceId: string;
  runId: string;
  parentRunId?: string;
  type: NodeType;
  status: NodeStatus;
  startTime: number;
  endTime?: number;
  data: any;
  cost?: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency?: number;
  error?: string;
  createdAt: Date;
}

export interface Edge {
  id: string;
  traceId: string;
  fromNode: string;
  toNode: string;
  createdAt: Date;
}

export interface Anomaly {
  id: string;
  traceId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  nodes: string[];
  suggestion?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Input for creating an anomaly (without auto-generated fields)
 */
export type CreateAnomalyInput = Omit<Anomaly, "id" | "createdAt">;

/**
 * Input for creating a node (without auto-generated fields)
 */
export type CreateNodeInput = Omit<Node, "id" | "createdAt">;

/**
 * Input for creating an edge (without auto-generated fields)
 */
export type CreateEdgeInput = Omit<Edge, "id" | "createdAt">;

/**
 * Input for creating a trace (without auto-generated fields)
 */
export type CreateTraceInput = Omit<Trace, "id" | "createdAt" | "updatedAt">;

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ListTracesRequest {
  projectName?: string;
  limit?: number;
  offset?: number;
}

export interface ListTracesResponse {
  traces: Trace[];
  count: number;
  total?: number;
}

export interface GetTraceResponse {
  trace: Trace;
  nodes: Node[];
  edges: Edge[];
  anomalies: Anomaly[];
}

export interface CostAnalysisResponse {
  total_cost: number;
  total_tokens: number;
  avg_cost_per_node: number;
  nodes_by_cost: Array<{
    name: string;
    cost: number;
    tokens: number;
  }>;
  cost_by_model: Array<{
    name: string;
    cost: number;
  }>;
  suggestions: Array<{
    title: string;
    description: string;
    savings: number;
    savings_percentage: number;
  }>;
}

export interface ReplayRequest {
  from_node: string;
  modifications?: {
    prompt?: string;
    model?: string;
    temperature?: number;
    [key: string]: any;
  };
}

export interface ReplayResponse {
  replay_trace_id: string;
  original_trace_id: string;
  from_node: string;
  modifications?: any;
  state: {
    conversation_history: Array<{
      role: string;
      content: string;
    }>;
    tool_outputs: Record<string, any>;
    timestamp: number;
  };
  message: string;
}

// ============================================================================
// WebSocket Events
// ============================================================================

export interface TraceUpdateEvent {
  traceId: string;
  event: TraceEvent;
}

export interface AnomalyDetectedEvent {
  traceId: string;
  anomalies: Anomaly[];
}

export interface TraceEventsAck {
  received: number;
  timestamp: number;
}

export interface TraceEventsError {
  error: string;
  details?: any;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: number;
  uptime: number;
  database: "connected" | "disconnected";
  memory?: NodeJS.MemoryUsage;
}

export interface ErrorResponse {
  error: string;
  details?: any;
  timestamp?: number;
}
