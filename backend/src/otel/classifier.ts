import { getStringAttr, type AttrValue } from "./attributes.js";

/**
 * Axon's normalized node-type discriminator.
 *
 * "embedding" is absent from this union because backend/src/types/index.ts
 * NodeType has no separate embedding bucket. Embedding spans are folded into
 * "llm" since both use the same LLM infrastructure in Axon's data model.
 *
 * "retriever" and "agent" are new values not in the legacy NodeType union but
 * are safe to write to the DB (the nodes.type column is free-text TEXT).
 */
export type AxonNodeType =
  | "llm"
  | "tool"
  | "chain"
  | "retriever"
  | "agent"
  | "custom";

// ============================================================================
// Semantic-convention key constants
//
// Exported so the transformer can import the same strings for value extraction
// instead of repeating magic strings. Grouped by instrumentation convention.
// ============================================================================

/**
 * Span-kind / type indicator keys.
 * These are the primary classification signals (Rule 1 & 2).
 */
export const SPAN_KIND_KEYS = {
  /** OpenInference: LLM | CHAIN | TOOL | RETRIEVER | AGENT | EMBEDDING | RERANKER | GUARDRAIL | EVALUATOR */
  OPENINFERENCE: "openinference.span.kind",
  /** OpenLLMetry / Traceloop: workflow | task | agent | tool */
  TRACELOOP: "traceloop.span.kind",
} as const;

/**
 * Operation-name keys (gen_ai semantic conventions, Rule 2b).
 * Values: chat | text_completion | generate_content | embeddings | embedding
 */
export const OPERATION_KEYS = {
  /** gen_ai: what the LLM is being called to do */
  GEN_AI: "gen_ai.operation.name",
} as const;

/**
 * Tool-name keys — presence of any of these signals a tool-call span (Rule 2c).
 * Also used by the transformer to extract the tool's name for display.
 */
export const TOOL_NAME_KEYS = {
  /** gen_ai conventions (OpenAI function-calling / tool-use) */
  GEN_AI_TOOL: "gen_ai.tool.name",
  /** Generic / OpenInference tool name */
  TOOL: "tool.name",
} as const;

/**
 * Model-name keys.
 * Used by Rule 3 detection (any gen_ai.x / llm.x attr → llm) and by the
 * transformer for extracting the model name string.
 */
export const MODEL_KEYS = {
  /** gen_ai: model identifier the client requested */
  GEN_AI_REQUEST: "gen_ai.request.model",
  /** gen_ai: model identifier that actually responded */
  GEN_AI_RESPONSE: "gen_ai.response.model",
  /** OpenLLMetry / LangChain: model name */
  LLM_MODEL_NAME: "llm.model_name",
  /** OpenInference: model name */
  LLM_MODEL: "llm.model",
} as const;

/**
 * Token-count keys (transformer extraction only — not used for classification).
 */
export const TOKEN_KEYS = {
  /** gen_ai (current spec): prompt-side token count */
  GEN_AI_INPUT: "gen_ai.usage.input_tokens",
  /** gen_ai (older alias) */
  GEN_AI_PROMPT: "gen_ai.usage.prompt_tokens",
  /** gen_ai (current spec): completion-side token count */
  GEN_AI_OUTPUT: "gen_ai.usage.output_tokens",
  /** gen_ai (older alias) */
  GEN_AI_COMPLETION_TOKENS: "gen_ai.usage.completion_tokens",
  /** OpenLLMetry / LangChain */
  LLM_PROMPT: "llm.token_count.prompt",
  LLM_COMPLETION: "llm.token_count.completion",
  LLM_TOTAL: "llm.token_count.total",
} as const;

/**
 * Prompt / message content keys (transformer extraction only).
 */
export const PROMPT_KEYS = {
  /** gen_ai: serialized input messages (JSON array of chat turns) */
  GEN_AI_PROMPT: "gen_ai.prompt",
  /** gen_ai: completion text */
  GEN_AI_COMPLETION: "gen_ai.completion",
  /** OpenInference: raw input value */
  INPUT_VALUE: "input.value",
  /** OpenInference: raw output value */
  OUTPUT_VALUE: "output.value",
  /** OpenLLMetry / LangChain: array of prompt strings */
  LLM_PROMPTS: "llm.prompts",
} as const;

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Rule 1 — OpenInference span.kind mapping (case-insensitive, uppercased before switch).
 *
 * EMBEDDING  → "llm"       (no separate embedding bucket in NodeType)
 * RERANKER   → "retriever" (a retrieval post-processor)
 * GUARDRAIL, EVALUATOR, unknown → "chain" (pipeline wrappers)
 */
function mapOpenInferenceKind(kind: string): AxonNodeType {
  switch (kind.toUpperCase()) {
    case "LLM":       return "llm";
    case "CHAIN":     return "chain";
    case "TOOL":      return "tool";
    case "RETRIEVER": return "retriever";
    case "AGENT":     return "agent";
    case "EMBEDDING": return "llm";
    case "RERANKER":  return "retriever";
    case "GUARDRAIL":
    case "EVALUATOR":
    default:          return "chain";
  }
}

/**
 * Rule 2a — OpenLLMetry / Traceloop span.kind mapping (lowercased before switch).
 * Returns undefined for unrecognized values so the caller can fall through.
 */
function mapTraceloopKind(kind: string): AxonNodeType | undefined {
  switch (kind.toLowerCase()) {
    case "workflow": return "chain";
    case "task":     return "chain";
    case "agent":    return "agent";
    case "tool":     return "tool";
    default:         return undefined;
  }
}

/**
 * Rule 2b — gen_ai.operation.name mapping.
 * "embeddings" / "embedding" → "llm" (folded).
 * Returns undefined for unrecognized values so the caller can fall through.
 */
function mapGenAiOperation(op: string): AxonNodeType | undefined {
  switch (op.toLowerCase()) {
    case "chat":
    case "text_completion":
    case "generate_content":
      return "llm";
    case "embeddings":
    case "embedding":
      return "llm"; // folded — no separate embedding bucket
    default:
      return undefined;
  }
}

/** Rule 3 — true if any attribute key starts with "gen_ai." or "llm.". */
function hasGenAiOrLlmAttr(attrs: Record<string, AttrValue>): boolean {
  return Object.keys(attrs).some(
    (k) => k.startsWith("gen_ai.") || k.startsWith("llm.")
  );
}

// ============================================================================
// Classifier
// ============================================================================

/**
 * Classify a decoded OTLP span into an Axon node type.
 *
 * Accept the span name and a pre-resolved attribute map (from attributesToMap)
 * rather than the raw ISpan, keeping this function pure and trivially testable.
 *
 * Priority order — first match wins:
 *   1. OpenInference  openinference.span.kind  (most explicit)
 *   2. OpenLLMetry    traceloop.span.kind
 *                     gen_ai.operation.name
 *                     presence of gen_ai.tool.name / tool.name
 *   3. Generic signal any gen_ai.* or llm.* attribute
 *   4. Name heuristic case-insensitive substring on span.name
 *   5. Fallback       "custom"
 */
export function classifySpan(
  name: string,
  attrs: Record<string, AttrValue>
): AxonNodeType {
  // ── Rule 1: OpenInference ─────────────────────────────────────────────────
  const oiKind = getStringAttr(attrs, SPAN_KIND_KEYS.OPENINFERENCE);
  if (oiKind) return mapOpenInferenceKind(oiKind);

  // ── Rule 2a: OpenLLMetry / Traceloop explicit kind ────────────────────────
  const tlKind = getStringAttr(attrs, SPAN_KIND_KEYS.TRACELOOP);
  if (tlKind !== undefined) {
    const mapped = mapTraceloopKind(tlKind);
    if (mapped !== undefined) return mapped;
  }

  // ── Rule 2b: gen_ai.operation.name ────────────────────────────────────────
  const opName = getStringAttr(attrs, OPERATION_KEYS.GEN_AI);
  if (opName !== undefined) {
    const mapped = mapGenAiOperation(opName);
    if (mapped !== undefined) return mapped;
  }

  // ── Rule 2c: tool-name attribute presence ─────────────────────────────────
  if (getStringAttr(attrs, TOOL_NAME_KEYS.GEN_AI_TOOL, TOOL_NAME_KEYS.TOOL)) {
    return "tool";
  }

  // ── Rule 3: Generic gen_ai / llm signal ───────────────────────────────────
  if (hasGenAiOrLlmAttr(attrs)) return "llm";

  // ── Rule 4: Span-name heuristics (last resort) ────────────────────────────
  const lower = name.toLowerCase();
  if (/retriev|vector/.test(lower))       return "retriever";
  if (/embed/.test(lower))                return "llm"; // folded
  if (/tool/.test(lower))                 return "tool";
  if (/agent/.test(lower))               return "agent";
  if (/chain|workflow|task/.test(lower))  return "chain";
  if (/\bllm\b|chat|completion/.test(lower)) return "llm";

  // ── Rule 5: Unknown span ──────────────────────────────────────────────────
  return "custom";
}
