/**
 * Public API exports
 */
import { TracingCallbackHandler } from "./callback";
import type { TraceConfig } from "./types";

// Export classes (so users can import them)
export { TracingCallbackHandler } from "./callback";
export { TraceClient } from "./client";
export { EventSerializer } from "./serializer";

// Export auto-detection utilities
export { 
  createAutoTracer,
  detectProjectConfig,
  detectProjectName,
  isAgentTraceConfigured,
  getConfigurationStatus
} from "./auto-detection";

export type {
  TraceConfig,
  TraceEvent,
  LLMStartEvent,
  LLMEndEvent,
  ToolStartEvent,
  ToolEndEvent,
  ChainStartEvent,
  ChainEndEvent,
  ErrorEvent,
  NodeType,
  NodeStatus,
  RunData
} from "./types";

/**
 * Convenience function to create a tracer
 */
export function createTracer(config?: Partial<TraceConfig>) {
  return new TracingCallbackHandler(config);
}
