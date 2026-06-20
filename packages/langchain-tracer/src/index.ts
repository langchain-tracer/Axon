/**
 * Public API exports
 *
 * @deprecated `@axon-ai/langchain-tracer` is deprecated. Axon now ingests standard
 * OpenTelemetry (OTLP) spans, so use off-the-shelf instrumentation such as
 * OpenLLMetry (@traceloop/node-server-sdk) or OpenInference pointed at
 * http://localhost:4000 instead. This package will be removed in a future major.
 */
import { TracingCallbackHandler } from "./callback";
import type { TraceConfig } from "./types";

console.warn(
  "[axon] @axon-ai/langchain-tracer is deprecated — Axon is now OTLP-native. " +
    "Use OpenLLMetry/OpenInference pointed at http://localhost:4000. " +
    "See https://github.com/langchain-tracer/Axon",
);

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
