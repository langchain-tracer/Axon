/**
 * OTLP span transformer: convert a decoded IExportTraceServiceRequest into
 * Axon SQLite trace/node/edge rows using the existing DB models.
 *
 * This module is the core data-mapping layer. It is intentionally kept
 * DB-ignorant at the leaf level (spanToNode is pure) so unit tests can
 * assert the mapping without a database.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  IExportTraceServiceRequest,
  ISpan,
} from "@opentelemetry/otlp-transformer/build/src/trace/internal-types";
import type {
  Fixed64,
  LongBits,
} from "@opentelemetry/otlp-transformer/build/src/common/internal-types";
import {
  attributesToMap,
  getStringAttr,
  getNumberAttr,
  unixNanoToMs,
  type AttrValue,
} from "./attributes.js";
import {
  classifySpan,
  MODEL_KEYS,
  TOKEN_KEYS,
} from "./classifier.js";
import type { RawSpan } from "./derive.js";
import { TraceModel, NodeModel, EdgeModel } from "../database/models.js";
import { estimateCost } from "./pricing.js";
import { logger } from "../utils/logger.js";
import type { Node } from "../types/index.js";

// ============================================================================
// ID + timestamp normalization
// ============================================================================

/**
 * Normalize an OTLP trace/span ID to a lowercase hex string.
 * JSON OTLP sends hex strings; protobuf OTLP sends Uint8Array bytes.
 */
function idToHex(id: string | Uint8Array | undefined | null): string {
  if (!id) return "";
  if (typeof id === "string") return id.toLowerCase();
  return Array.from(id as Uint8Array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalize a Fixed64 timestamp (LongBits | string | number) to something
 * unixNanoToMs() accepts.  LongBits are two unsigned 32-bit halves of a
 * 64-bit value; combine them with BigInt to preserve precision.
 */
function fixedToNano(
  v: Fixed64 | undefined | null,
): string | number | bigint | undefined {
  if (v == null) return undefined;
  if (typeof v === "string" || typeof v === "number") return v;
  const lb = v as LongBits;
  return (BigInt(lb.high >>> 0) << 32n) | BigInt(lb.low >>> 0);
}

// ============================================================================
// Raw span builder — the single stored source of truth (nodes.data.raw)
// ============================================================================

/** Normalize a Fixed64 timestamp to a JSON-safe decimal string of nanoseconds. */
function nanoToString(v: Parameters<typeof fixedToNano>[0]): string {
  const n = fixedToNano(v);
  return n === undefined ? "" : String(n);
}

/**
 * Build the verbatim RawSpan we persist under nodes.data.raw. Attributes and
 * resource attributes are coerced to readable key→value maps; timestamps are
 * strings (int64 nanos aren't JSON-safe). Everything the dashboard shows is
 * derived from this at read time via deriveDisplay() — stored exactly once.
 */
function buildRawSpan(
  span: ISpan,
  attrs: Record<string, AttrValue>,
  resourceAttrs: Record<string, AttrValue>,
): RawSpan {
  return {
    name: span.name,
    kind: (span.kind as unknown as number) ?? 0,
    statusCode: span.status?.code ?? 0,
    statusMessage: span.status?.message,
    attributes: attrs,
    resourceAttributes: resourceAttrs,
    startTimeUnixNano: nanoToString(span.startTimeUnixNano),
    endTimeUnixNano: nanoToString(span.endTimeUnixNano),
    events: (span.events ?? []).map((e) => ({
      name: e.name,
      timeUnixNano: nanoToString(e.timeUnixNano),
      attributes: attributesToMap(e.attributes),
    })),
  };
}

// ============================================================================
// Pure span → node mapper (exported for unit tests)
// ============================================================================

/**
 * Map a single decoded OTLP span + its resource attributes to an Axon Node
 * row.  Pure — no DB access.  The caller is responsible for DB insertion.
 *
 * @returns node       — fully-formed Node ready for NodeModel.create()
 * @returns parentHex  — hex span ID of the parent, or "" for root spans
 */
export function spanToNode(
  span: ISpan,
  resourceAttrs: Record<string, AttrValue>,
): { node: Node; parentHex: string } {
  const traceHex  = idToHex(span.traceId);
  const spanHex   = idToHex(span.spanId);
  const parentHex = idToHex(span.parentSpanId);

  const attrs = attributesToMap(span.attributes);
  const type  = classifySpan(span.name, attrs);

  const startMs   = unixNanoToMs(fixedToNano(span.startTimeUnixNano)) ?? Date.now();
  const endMs     = unixNanoToMs(fixedToNano(span.endTimeUnixNano))   ?? startMs;
  const latencyMs = endMs - startMs;

  const model = getStringAttr(
    attrs,
    MODEL_KEYS.GEN_AI_REQUEST,
    MODEL_KEYS.GEN_AI_RESPONSE,
    MODEL_KEYS.LLM_MODEL_NAME,
    MODEL_KEYS.LLM_MODEL,
  );

  // Token counts — stored as { input, output, total } (dashboard reads these fields)
  const inputTokens  = getNumberAttr(attrs,
    TOKEN_KEYS.GEN_AI_INPUT,
    TOKEN_KEYS.LLM_PROMPT,
    TOKEN_KEYS.GEN_AI_PROMPT,
  );
  const outputTokens = getNumberAttr(attrs,
    TOKEN_KEYS.GEN_AI_OUTPUT,
    TOKEN_KEYS.LLM_COMPLETION,
    TOKEN_KEYS.GEN_AI_COMPLETION_TOKENS,
  );
  const totalFromAttr = getNumberAttr(attrs, TOKEN_KEYS.LLM_TOTAL);
  const total =
    totalFromAttr ??
    (inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined);

  const tokens =
    inputTokens !== undefined || outputTokens !== undefined || total !== undefined
      ? { input: inputTokens ?? 0, output: outputTokens ?? 0, total: total ?? 0 }
      : undefined;

  // Cost: prefer an explicit cost attribute; else estimate from tokens × per-model pricing.
  const costFromAttr = getNumberAttr(attrs, "gen_ai.usage.cost", "llm.cost");
  const cost = costFromAttr ?? estimateCost(model, tokens);

  // OTLP STATUS_CODE_ERROR = 2; everything else treated as success
  const otlpStatus = span.status?.code ?? 0;
  const status     = otlpStatus === 2 ? "error" : "complete";
  const error      = otlpStatus === 2 ? (span.status?.message ?? "span status: error") : undefined;

  // Store the verbatim span ONCE; display fields are derived at read time.
  const data = { raw: buildRawSpan(span, attrs, resourceAttrs) };

  const node: Node = {
    id:          uuidv4(),
    traceId:     traceHex,
    runId:       spanHex,
    parentRunId: parentHex || undefined,
    // AxonNodeType includes "retriever"/"agent" not in legacy NodeType; DB accepts any string
    type:        type as any,
    status:      status as any,
    startTime:   startMs,
    endTime:     endMs,
    data,
    model,
    cost,
    // Node type declares {prompt,completion,total} but dashboard reads {input,output,total}
    tokens:      tokens as any,
    latency:     latencyMs,
    error,
    createdAt:   new Date(),
  };

  return { node, parentHex };
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Transform a decoded OTLP ExportTraceServiceRequest and persist it to
 * Axon's SQLite database.
 *
 * - Groups spans by trace ID; handles multi-trace batches.
 * - Upserts the trace row (uses first span's resource for service.name).
 * - Inserts nodes idempotently (skips duplicate run_ids).
 * - Creates parent→child edges AFTER all nodes in the batch are inserted
 *   so FK constraints are satisfied for same-batch spans.
 * - Recomputes trace stats (totalNodes, totalCost, status, endTime) after
 *   each group, mirroring trace-processor.updateTraceStats.
 *
 * @returns created   — hex IDs of traces seen for the first time in this call
 *          updated   — hex IDs of pre-existing traces that got new spans
 *          nodeCount — number of new node rows written in this call
 */
export interface IngestResult {
  created: string[];
  updated: string[];
  nodeCount: number;
}

export function transformAndStore(
  request: IExportTraceServiceRequest,
): IngestResult {
  if (!request.resourceSpans?.length) return { created: [], updated: [], nodeCount: 0 };

  interface SpanEntry {
    span: ISpan;
    resourceAttrs: Record<string, AttrValue>;
  }

  // ── Group spans by trace ID ───────────────────────────────────────────────
  const traceGroups = new Map<string, SpanEntry[]>();

  for (const rs of request.resourceSpans) {
    const resourceAttrs = attributesToMap(rs.resource?.attributes);
    for (const scopeSpan of rs.scopeSpans ?? []) {
      for (const span of scopeSpan.spans ?? []) {
        const traceHex = idToHex(span.traceId);
        if (!traceHex) {
          logger.warn("[span-transformer] Span missing traceId — skipped");
          continue;
        }
        if (!traceGroups.has(traceHex)) traceGroups.set(traceHex, []);
        traceGroups.get(traceHex)!.push({ span, resourceAttrs });
      }
    }
  }

  let nodeCount = 0;
  const created: string[] = [];
  const updated: string[] = [];

  for (const [traceId, entries] of traceGroups) {
    // Use the first resource's attrs for the trace-level fields
    const resourceAttrs = entries[0].resourceAttrs;
    const projectName =
      getStringAttr(resourceAttrs, "service.name", "lumina.feature") ?? "default";

    // ── Upsert trace row ──────────────────────────────────────────────────
    const isNewTrace = !TraceModel.findById(traceId);
    (isNewTrace ? created : updated).push(traceId);
    if (isNewTrace) {
      const minStart = entries.reduce((min, { span }) => {
        const ms = unixNanoToMs(fixedToNano(span.startTimeUnixNano)) ?? Date.now();
        return Math.min(min, ms);
      }, Infinity);

      TraceModel.create({
        id: traceId,
        projectName,
        startTime: isFinite(minStart) ? minStart : Date.now(),
        metadata: resourceAttrs as unknown as Record<string, any>,
      });
    }

    // ── Map spans → nodes, collect pending edges ─────────────────────────
    const pendingEdges: Array<{ spanHex: string; parentHex: string }> = [];

    for (const { span, resourceAttrs: rAttrs } of entries) {
      const { node, parentHex } = spanToNode(span, rAttrs);

      // Idempotency: skip if this span was already stored
      if (NodeModel.getByRunId(node.runId)) continue;

      try {
        NodeModel.create(node);
        nodeCount++;
        if (parentHex) pendingEdges.push({ spanHex: node.runId, parentHex });
      } catch (err) {
        logger.warn("[span-transformer] Failed to insert node", {
          runId: node.runId,
          err,
        });
      }
    }

    // ── Create edges after all nodes are in the DB ────────────────────────
    // Inserting nodes first satisfies FK constraints for same-batch spans.
    // Edges to spans from previous batches may fail if the parent hasn't
    // arrived yet; those failures are non-fatal (dashboard drops dangling edges).
    for (const { spanHex, parentHex } of pendingEdges) {
      try {
        EdgeModel.create({
          id: uuidv4(),
          traceId,
          fromNode: parentHex,
          toNode: spanHex,
        });
      } catch {
        // Parent span not yet in DB — edge will be missing but not fatal
      }
    }

    // ── Recompute trace stats ─────────────────────────────────────────────
    const nodes    = NodeModel.findByTraceId(traceId);
    const totalCost = nodes.reduce((sum, n) => sum + (n.cost ?? 0), 0);
    const hasError  = nodes.some((n) => n.status === "error");
    const endTime   = nodes.reduce(
      (max, n) => Math.max(max, n.endTime ?? n.startTime),
      0,
    );

    TraceModel.update(traceId, {
      totalNodes: nodes.length,
      totalCost,
      status: hasError ? "error" : "complete",
      endTime: endTime > 0 ? endTime : undefined,
    });
  }

  return { created, updated, nodeCount };
}
