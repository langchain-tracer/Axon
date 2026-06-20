/**
 * Read-time derivation of display fields from a stored raw OTEL span.
 *
 * The DB stores the verbatim span once under `nodes.data.raw` (see RawSpan).
 * Everything the dashboard shows (prompts, response, tool I/O, chain name) is
 * DERIVED from that single source of truth here — no duplicated storage.
 */

import { getStringAttr, type AttrValue } from "./attributes.js";
import { PROMPT_KEYS, TOOL_NAME_KEYS, type AxonNodeType } from "./classifier.js";

/**
 * The verbatim OTEL span we persist (coerced to plain JSON-safe values).
 * `attributes`/`resourceAttributes` are the coerced key→value maps; timestamps
 * are kept as strings (int64 nanos are not JSON-safe as numbers/bigint).
 */
export interface RawSpan {
  name: string;
  kind: number;
  statusCode: number;
  statusMessage?: string;
  attributes: Record<string, AttrValue>;
  resourceAttributes: Record<string, AttrValue>;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  events?: Array<{
    name: string;
    timeUnixNano: string;
    attributes: Record<string, AttrValue>;
  }>;
}

export interface DisplayFields {
  prompts: string[];
  response: string;
  reasoning: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  chainName?: string;
  inputs?: string;
  outputs?: string;
  agentActions?: unknown[];
}

/**
 * Extract input prompts from gen_ai indexed attrs (gen_ai.prompt.N.content)
 * or fall back to flat gen_ai.prompt / input.value / llm.prompts.
 */
export function extractPrompts(attrs: Record<string, AttrValue>): string[] {
  const indexed: string[] = [];
  for (let i = 0; ; i++) {
    const v = attrs[`gen_ai.prompt.${i}.content`];
    if (v === undefined) break;
    indexed.push(String(v));
  }
  if (indexed.length > 0) return indexed;

  const flat = getStringAttr(
    attrs,
    PROMPT_KEYS.GEN_AI_PROMPT,
    PROMPT_KEYS.INPUT_VALUE,
    PROMPT_KEYS.LLM_PROMPTS,
  );
  return flat ? [flat] : [];
}

/**
 * Extract the response / completion text from gen_ai indexed attrs or
 * fall back to gen_ai.completion / output.value.
 */
export function extractResponse(attrs: Record<string, AttrValue>): string | undefined {
  const indexed = attrs["gen_ai.completion.0.content"];
  if (indexed !== undefined) return String(indexed);
  return getStringAttr(attrs, PROMPT_KEYS.GEN_AI_COMPLETION, PROMPT_KEYS.OUTPUT_VALUE);
}

/**
 * Derive the dashboard-facing display fields for a node from its raw span.
 * Pure — depends only on the raw attributes + classified node type.
 */
export function deriveDisplay(raw: RawSpan, type: AxonNodeType): DisplayFields {
  const attrs = raw.attributes ?? {};
  const spanName = raw.name;
  const prompts = extractPrompts(attrs);
  const response = extractResponse(attrs);
  const toolName = getStringAttr(attrs, TOOL_NAME_KEYS.GEN_AI_TOOL, TOOL_NAME_KEYS.TOOL);

  switch (type) {
    case "llm":
      return { prompts, response: response ?? "", reasoning: "" };

    case "tool": {
      const toolInput =
        getStringAttr(attrs, "gen_ai.tool.parameters", "tool.input") ?? prompts[0] ?? "";
      const toolOutput =
        getStringAttr(attrs, "gen_ai.tool.result", "tool.output") ?? response ?? "";
      return {
        prompts: [`Tool: ${toolName ?? spanName}\nInput: ${toolInput}`],
        response: toolOutput,
        reasoning: "",
        toolName: toolName ?? spanName,
        toolInput,
        toolOutput,
      };
    }

    case "chain":
      return {
        prompts,
        response: response ?? "",
        reasoning: "",
        chainName: getStringAttr(attrs, "workflow.name", "chain.name") ?? spanName,
        inputs: prompts.length > 0 ? prompts.join("\n") : undefined,
        outputs: response,
      };

    case "retriever":
      return {
        prompts,
        response: response ?? getStringAttr(attrs, "retrieval.documents") ?? "",
        reasoning: "",
        chainName: spanName,
      };

    case "agent":
      return {
        prompts,
        response: response ?? "",
        reasoning: "",
        chainName: spanName,
        agentActions: [],
      };

    default:
      return { prompts, response: response ?? "", reasoning: "" };
  }
}
