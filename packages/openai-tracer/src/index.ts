/**
 * OpenAI Tracer Package Entry Point
 *
 * @deprecated `@axon-ai/openai-tracer` is deprecated. Axon now ingests standard
 * OpenTelemetry (OTLP) spans, so use off-the-shelf instrumentation such as
 * OpenLLMetry (@traceloop/node-server-sdk) or OpenInference pointed at
 * http://localhost:4000 instead. This package will be removed in a future major.
 */

console.warn(
  "[axon] @axon-ai/openai-tracer is deprecated — Axon is now OTLP-native. " +
    "Use OpenLLMetry/OpenInference pointed at http://localhost:4000. " +
    "See https://github.com/langchain-tracer/Axon",
);

export {
  OpenAITracer,
  TracedOpenAI,
  createOpenAITracer,
  type OpenAIFunctionCall,
  type OpenAIToolCall,
  type OpenAIMessage,
  type OpenAITool,
  type OpenAITraceEvent,
  type OpenAITraceConfig
} from './OpenAITracer';

export { OpenAITracer as default } from './OpenAITracer';
