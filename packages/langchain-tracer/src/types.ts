/**
 * Core types for agent tracing
 */

export type NodeType = 'llm' | 'tool' | 'chain' | 'agent';

export type NodeStatus = 'pending' | 'running' | 'complete' | 'error';

export interface TraceConfig {
  /** Backend endpoint URL */
  endpoint: string;
  
  /** API key for authentication (optional) */
  apiKey?: string;
  
  /** Project name for organizing traces */
  projectName?: string;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Batch events before sending (ms) */
  batchInterval?: number;
  
  /** Maximum batch size */
  batchSize?: number;
  
  /** Custom metadata to attach to all events */
  metadata?: Record<string, any>;
}

export interface BaseEvent {
  /** Unique event ID */
  eventId: string;
  
  /** Trace ID (groups related events) */
  traceId: string;
  
  /** Run ID from LangChain */
  runId: string;
  
  /** Parent run ID (for nested calls) */
  parentRunId?: string;
  
  /** Event timestamp */
  timestamp: number;
  
  /** Event type */
  type: string;
  
  /** Custom metadata */
  metadata?: Record<string, any>;
}

export interface LLMStartEvent extends BaseEvent {
  type: 'llm_start';
  model: string;
  prompts: string[];
  invocationParams?: Record<string, any>;
}

export interface LLMEndEvent extends BaseEvent {
  type: 'llm_end';
  response: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  latency: number;
  reasoning?: string;
  agentActions?: Array<{
    tool: string;
    toolInput: any;
    log: string;
    messageLog?: any[];
  }>;
}

export interface ToolStartEvent extends BaseEvent {
  type: 'tool_start';
  toolName: string;
  input: string | Record<string, any>;
}

export interface ToolEndEvent extends BaseEvent {
  type: 'tool_end';
  toolName: string;
  output: string;
  cost?: number;
  latency: number;
  reasoning?: string;
  agentActions?: Array<{
    tool: string;
    toolInput: any;
    log: string;
    messageLog?: any[];
  }>;
}

export interface ChainStartEvent extends BaseEvent {
  type: 'chain_start';
  chainName: string;
  inputs: Record<string, any>;
}

export interface ChainEndEvent extends BaseEvent {
  type: 'chain_end';
  chainName: string;
  outputs: Record<string, any>;
  latency: number;
  reasoning?: string;
  agentActions?: Array<{
    tool: string;
    toolInput: any;
    log: string;
    messageLog?: any[];
  }>;
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  error: string;
  stack?: string;
}

export interface TextEvent extends BaseEvent {
  type: 'text';
  text: string;
}

export interface AgentActionEvent extends BaseEvent {
  type: 'agent_action';
  action: {
    tool: string;
    toolInput: any;
    log: string;
    messageLog?: any[];
  };
}

export interface AgentEndEvent extends BaseEvent {
  type: 'agent_end';
  output: any;
  reasoning?: string[];
  agentActions?: Array<{
    tool: string;
    toolInput: any;
    log: string;
    messageLog?: any[];
  }>;
}

export interface RetrieverStartEvent extends BaseEvent {
  type: 'retriever_start';
  query: string;
}

export interface RetrieverEndEvent extends BaseEvent {
  type: 'retriever_end';
  documents: Array<{
    pageContent: string;
    metadata: any;
  }>;
}

export type TraceEvent = 
  | LLMStartEvent 
  | LLMEndEvent 
  | ToolStartEvent 
  | ToolEndEvent 
  | ChainStartEvent 
  | ChainEndEvent 
  | ErrorEvent
  | TextEvent
  | AgentActionEvent
  | AgentEndEvent
  | RetrieverStartEvent
  | RetrieverEndEvent;

export interface RunData {
  runId: string;
  parentRunId?: string;
  nodeType: NodeType;
  startTime: number;
  endTime?: number;
  status: NodeStatus;
  data: any;
}