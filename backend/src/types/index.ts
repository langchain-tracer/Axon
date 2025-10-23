/**
 * Shared TypeScript types for backend
 */

// ============================================================================
// Node Types - Enhanced for Complete Decision Graph
// ============================================================================

export type NodeType = 
  | "llm_call"           // LLM invocation with full prompt/response
  | "tool_invocation"    // Tool call with parameters and results
  | "decision_point"     // Agent decision with reasoning context
  | "state_transition"   // State change in agent execution
  | "chain_step"         // Step in a processing chain
  | "agent_action"       // High-level agent action
  | "reasoning_step"     // Internal reasoning process
  | "context_update"     // Context or memory update
  | "error_handling"     // Error recovery or handling
  | "validation"         // Input/output validation
  | "optimization"       // Performance or cost optimization
  | "user_interaction"   // User input or feedback
  | "llm"                // Legacy: LLM invocation
  | "tool"               // Legacy: Tool call
  | "chain"              // Legacy: Chain step
  | "custom";            // Legacy: Custom event

export type NodeStatus = "pending" | "running" | "complete" | "error" | "cancelled" | "timeout";

// Enhanced edge types for causal dependencies
export type EdgeType = 
  | "data_flow"          // Data passed between nodes
  | "causal_dependency" // One node caused another
  | "temporal_sequence"  // Time-based ordering
  | "conditional_branch" // If-then logic flow
  | "error_propagation"  // Error flows through system
  | "state_dependency"   // State-based dependencies
  | "resource_usage"    // Resource sharing between nodes
  | "feedback_loop";    // Feedback mechanisms

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
// Event Types (separate from NodeTypes for trace events)
// ============================================================================

export type EventType = 
  | "llm_start"
  | "llm_end"
  | "tool_start"
  | "tool_end"
  | "chain_start"
  | "chain_end"
  | "error"
  | "custom"
  | NodeType; // Also allow NodeType for flexibility

// ============================================================================
// Trace Events
// ============================================================================

export interface TraceEvent {
  eventId: string;
  traceId: string;
  runId: string;
  parentRunId?: string;
  timestamp: number;
  type: EventType;
  status: NodeStatus;
  metadata?: Record<string, any>;

  // Enhanced LLM properties for complete decision capture
  model?: string;
  prompts?: string[];
  response?: string;
  reasoning?: string;           // Internal reasoning process
  agentActions?: Array<{         // Agent actions and decisions
    tool: string;
    toolInput: any;
    log: string;
    messageLog?: any[];
  }>;
  decisionContext?: {             // Context that influenced the decision
    previousSteps: string[];
    availableOptions: string[];
    constraints: Record<string, any>;
    goals: string[];
  };
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  latency?: number;
  invocationParams?: Record<string, any>;

  // Enhanced tool properties
  toolName?: string;
  input?: string | Record<string, any>;
  output?: string;
  toolMetadata?: {
    version?: string;
    category?: string;
    performance?: Record<string, number>;
  };

  // Enhanced chain properties
  chainName?: string;
  inputs?: any;
  outputs?: any;
  chainStep?: number;
  totalSteps?: number;

  // Decision point properties
  decisionType?: "choice" | "evaluation" | "planning" | "execution" | "validation";
  alternatives?: Array<{
    option: string;
    reasoning: string;
    confidence: number;
    consequences?: string[];
  }>;
  selectedAlternative?: string;
  confidence?: number;

  // State transition properties
  stateBefore?: Record<string, any>;
  stateAfter?: Record<string, any>;
  stateChanges?: Array<{
    key: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }>;

  // Context and memory
  context?: Record<string, any>;
  memoryUpdates?: Array<{
    type: "add" | "update" | "remove";
    key: string;
    value: any;
    reason: string;
  }>;

  // Error properties (enhanced)
  error?: string;
  stack?: string;
  stackTrace?: string;
  errorContext?: {
    retryCount: number;
    fallbackUsed: boolean;
    recoveryActions: string[];
  };

  // Performance and optimization
  performance?: {
    memoryUsage?: number;
    cpuTime?: number;
    networkLatency?: number;
    cacheHit?: boolean;
  };
  optimization?: {
    technique: string;
    improvement: number;
    tradeoffs?: string[];
  };
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
  model?: string;
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
  edgeType: EdgeType;
  weight?: number;              // Strength of the relationship
  data?: any;                   // Data passed along the edge
  metadata?: {
    causation?: string;         // How the source caused the target
    temporalOrder?: number;     // Order in execution
    confidence?: number;        // Confidence in the relationship
    conditions?: Record<string, any>; // Conditions for this edge
  };
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
// Time-Travel Replay Types
// ============================================================================

export interface ReplayState {
  timestamp: number;
  nodeId: string;
  agentState: {
    conversationHistory: Array<{
      role: string;
      content: string;
      timestamp: number;
    }>;
    context: Record<string, any>;
    memory: Record<string, any>;
    goals: string[];
    constraints: Record<string, any>;
  };
  executionContext: {
    availableTools: string[];
    environment: Record<string, any>;
    userPreferences: Record<string, any>;
  };
}

export interface ReplayModification {
  nodeId: string;
  type: "prompt_change" | "model_change" | "parameter_change" | "context_change";
  changes: Record<string, any>;
  reason: string;
}

export interface ReplayResult {
  originalTraceId: string;
  replayTraceId: string;
  modifications: ReplayModification[];
  outcome: {
    success: boolean;
    finalState: ReplayState;
    differences: Array<{
      nodeId: string;
      original: any;
      modified: any;
      impact: string;
    }>;
  };
}

// ============================================================================
// Decision Analysis Types
// ============================================================================

export interface DecisionPath {
  startNode: string;
  endNode: string;
  path: string[];
  reasoning: string[];
  confidence: number;
  alternatives: Array<{
    path: string[];
    reasoning: string;
    confidence: number;
    outcome?: string;
  }>;
}

export interface ReasoningChain {
  id: string;
  traceId: string;
  nodes: string[];
  reasoning: string;
  confidence: number;
  evidence: Array<{
    nodeId: string;
    evidence: string;
    strength: number;
  }>;
}

export interface DecisionAnalysis {
  decisionPoints: Array<{
    nodeId: string;
    decisionType: string;
    options: string[];
    selected: string;
    reasoning: string;
    confidence: number;
    consequences: string[];
  }>;
  reasoningChains: ReasoningChain[];
  decisionPaths: DecisionPath[];
  insights: Array<{
    type: "pattern" | "anomaly" | "optimization" | "risk";
    description: string;
    confidence: number;
    recommendations: string[];
  }>;
}

// ============================================================================
// Enhanced Visualization Types
// ============================================================================

export interface NodeVisualization {
  id: string;
  type: NodeType;
  status: NodeStatus;
  position: { x: number; y: number };
  size: { width: number; height: number };
  color: string;
  label: string;
  details: {
    summary: string;
    keyMetrics: Record<string, number>;
    decisionContext?: any;
    reasoning?: string;
  };
}

export interface EdgeVisualization {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  weight: number;
  color: string;
  label?: string;
  details: {
    causation: string;
    dataFlow?: any;
    confidence: number;
  };
}

export interface GraphVisualization {
  nodes: NodeVisualization[];
  edges: EdgeVisualization[];
  layout: {
    algorithm: "force-directed" | "hierarchical" | "circular" | "custom";
    parameters: Record<string, any>;
  };
  metadata: {
    totalNodes: number;
    totalEdges: number;
    complexity: number;
    decisionPoints: number;
  };
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
