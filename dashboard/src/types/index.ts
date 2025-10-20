// ============================================================================
// CORE TYPES
// ============================================================================

export interface TraceNodeData {
  label: string;
  type: "llm" | "tool" | "decision";
  cost: number;
  tokens?: {
    input: number;
    output: number;
  };
  latency: number;
  status: "complete" | "running" | "error" | "pending";
  prompt?: string;
  response?: string;
  toolParams?: Record<string, any>;
  toolResult?: any;
  timestamp: number;
  hasAnomaly?: boolean;
  anomalyType?: "loop" | "cost-spike" | "contradiction" | "timeout-risk";
  // Additional properties for replay functionality
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  model?: string;
  chainName?: string;
  metadata?: Record<string, any>;
}

export interface TraceNode {
  id: string;
  type: "llm" | "tool" | "decision";
  position: { x: number; y: number };
  data: TraceNodeData;
}

export interface TraceEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface Trace {
  id: string;
  startTime: number;
  endTime?: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
  metadata: TraceMetadata;
}

export interface TraceMetadata {
  totalCost: number;
  totalTokens: number;
  duration?: number;
  status: "running" | "complete" | "error";
  userId?: string;
  agentName?: string;
}

// ============================================================================
// ANOMALY TYPES
// ============================================================================

export interface Anomaly {
  id: string;
  nodeId: string;
  type:
    | "loop"
    | "cost-spike"
    | "contradiction"
    | "timeout-risk"
    | "token-spike"
    | "slow-operation";
  severity: "high" | "medium" | "low";
  message: string;
  suggestion: string;
  cost?: number;
  metadata?: Record<string, any>;
}

export interface DetectionConfig {
  loopThreshold?: number;
  costSpikeMultiplier?: number;
  latencySpikeMultiplier?: number;
  tokenSpikeMultiplier?: number;
  similarityThreshold?: number;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

export interface TraceStatistics {
  totalCost: number;
  totalTokens: number;
  totalLatency: number;
  avgCost: number;
  avgLatency: number;
  avgTokensPerNode: number;
  nodeCount: number;
  llmCount: number;
  toolCount: number;
  decisionCount: number;
  errorCount: number;
  costByType: Record<string, number>;
  latencyByType: Record<string, number>;
  tokensByType: Record<string, number>;
  mostExpensiveNode: { id: string; label: string; cost: number } | null;
  slowestNode: { id: string; label: string; latency: number } | null;
}

// ============================================================================
// LAYOUT TYPES
// ============================================================================

export type LayoutType =
  | "dagre"
  | "timeline"
  | "vertical-timeline"
  | "cost"
  | "type-grouped"
  | "dependency"
  | "circular"
  | "force";

export type LayoutDirection = "TB" | "BT" | "LR" | "RL";

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface FilterCriteria {
  types?: string[];
  minCost?: number;
  maxCost?: number;
  minLatency?: number;
  maxLatency?: number;
  statuses?: string[];
  dateRange?: { start: number; end: number };
  hasAnomaly?: boolean;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  searchInPrompts?: boolean;
  searchInResponses?: boolean;
  searchInParams?: boolean;
}

// ============================================================================
// REPLAY TYPES
// ============================================================================

export interface ReplayModifications {
  prompt?: string;
  toolParams?: Record<string, any>;
  systemMessage?: string;
}

export interface ReplayResult {
  originalCost: number;
  newCost: number;
  costSavings: number;
  savingsPercent: number;
  nodesRerun: number;
  duration: number;
}

export interface NodeState {
  nodeId: string;
  timestamp: number;
  conversationHistory: Message[];
  toolOutputs: Record<string, any>;
  contextVariables: Record<string, any>;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

// ============================================================================
// COMPARISON TYPES
// ============================================================================

export interface TraceComparison {
  costDiff: number;
  costDiffPercent: number;
  latencyDiff: number;
  latencyDiffPercent: number;
  nodeCountDiff: number;
  addedNodes: string[];
  removedNodes: string[];
  modifiedNodes: string[];
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export type ViewMode = "graph" | "timeline" | "analytics" | "replay";

export interface UIState {
  activeView: ViewMode;
  selectedNodeId: string | null;
  layoutType: LayoutType;
  showFilters: boolean;
  showSearch: boolean;
  showAnomalies: boolean;
  searchQuery: string;
  filters: FilterCriteria;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface APIResponse<T> {
  data: T;
  error?: string;
  timestamp: number;
}

export interface TraceListItem {
  id: string;
  startTime: number;
  endTime?: number;
  totalCost: number;
  nodeCount: number;
  status: "running" | "complete" | "error";
}

export interface WebSocketMessage {
  type: "node_start" | "node_complete" | "node_error" | "trace_complete";
  traceId: string;
  nodeId?: string;
  data?: any;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ExportFormat = "json" | "csv" | "png" | "svg";

export interface ExportOptions {
  includeMetadata?: boolean;
  format?: "json" | "csv";
  pretty?: boolean;
}

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UseTraceDataOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseAnomalyDetectionOptions {
  enabled?: boolean;
  config?: DetectionConfig;
  budgets?: { time?: number; cost?: number };
}

// ============================================================================
// CHART DATA TYPES
// ============================================================================

export interface CostBreakdownItem {
  name: string;
  cost: number;
  percentage: number;
}

export interface TimelineItem {
  step: number;
  time: string;
  name: string;
  duration: string;
  type: "llm" | "tool" | "decision";
}

export interface TokenUsageData {
  name: string;
  input: number;
  output: number;
}

export interface LatencyData {
  step: number;
  latency: number;
  name: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isLLMNode(node: TraceNode): boolean {
  return node.data.type === "llm";
}

export function isToolNode(node: TraceNode): boolean {
  return node.data.type === "tool";
}

export function isDecisionNode(node: TraceNode): boolean {
  return node.data.type === "decision";
}

export function hasAnomaly(node: TraceNode): boolean {
  return node.data.hasAnomaly === true;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const NODE_COLORS = {
  llm: "#3b82f6",
  tool: "#10b981",
  decision: "#a855f7"
} as const;

export const STATUS_COLORS = {
  complete: "#10b981",
  running: "#fbbf24",
  error: "#ef4444",
  pending: "#6b7280"
} as const;

export const SEVERITY_COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#fbbf24"
} as const;
