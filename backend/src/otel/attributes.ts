import type { IKeyValue, IAnyValue } from "@opentelemetry/otlp-transformer/build/src/common/internal-types";

/**
 * Coerced JS value from an OTLP AnyValue.
 *
 * Design notes:
 * - intValue: OTLP JSON wire format encodes int64 as a string to avoid float
 *   precision loss. The IAnyValue type declares `number | null`, but at runtime
 *   a raw JSON payload may deliver a string. Values that exceed
 *   Number.MAX_SAFE_INTEGER are returned as strings to preserve precision.
 * - bytesValue: left as-is (Uint8Array from protobuf, base64 string from JSON).
 *   Callers that need bytes know which encoding they expect.
 */
export type AttrValue =
  | string
  | number
  | boolean
  | Uint8Array
  | AttrValue[]
  | { [key: string]: AttrValue };

function coerceAnyValue(v: IAnyValue): AttrValue {
  if (v.stringValue !== undefined && v.stringValue !== null) return v.stringValue;
  if (v.boolValue !== undefined && v.boolValue !== null) return v.boolValue;
  if (v.doubleValue !== undefined && v.doubleValue !== null) return v.doubleValue;

  if (v.intValue !== undefined && v.intValue !== null) {
    // JSON OTLP sends int64 as a string; protobuf decoding yields a number.
    const raw = v.intValue as unknown as string | number;
    if (typeof raw === "string") {
      const n = Number(raw);
      return Math.abs(n) > Number.MAX_SAFE_INTEGER ? raw : n;
    }
    return raw;
  }

  if (v.arrayValue) {
    return v.arrayValue.values.map(coerceAnyValue);
  }

  if (v.kvlistValue) {
    const out: Record<string, AttrValue> = {};
    for (const kv of v.kvlistValue.values) {
      out[kv.key] = coerceAnyValue(kv.value);
    }
    return out;
  }

  if (v.bytesValue !== undefined) return v.bytesValue as Uint8Array | string;

  return "";
}

/**
 * Convert the OTLP KeyValue[] array (not an object!) into a flat Record keyed
 * by attribute name. Returns {} for undefined/empty input.
 */
export function attributesToMap(attrs?: IKeyValue[]): Record<string, AttrValue> {
  if (!attrs || attrs.length === 0) return {};
  const out: Record<string, AttrValue> = {};
  for (const { key, value } of attrs) {
    out[key] = coerceAnyValue(value);
  }
  return out;
}

/**
 * Fallback-chain lookup: return the value for the first key that is present
 * (and non-null/undefined) in map. Returns undefined if none match.
 *
 * Core primitive for reading semantic conventions that have multiple naming
 * schemes, e.g.:
 *   getAttr(m, "gen_ai.request.model", "gen_ai.response.model", "llm.model_name")
 */
export function getAttr(
  map: Record<string, AttrValue>,
  ...keys: string[]
): AttrValue | undefined {
  for (const key of keys) {
    const v = map[key];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/** First matching attribute coerced to string, or undefined if absent/wrong type. */
export function getStringAttr(
  map: Record<string, AttrValue>,
  ...keys: string[]
): string | undefined {
  const v = getAttr(map, ...keys);
  return typeof v === "string" ? v : undefined;
}

/**
 * First matching attribute as a number, or undefined if absent/wrong type.
 * Numeric strings are coerced (e.g. token-count attributes sent as strings).
 */
export function getNumberAttr(
  map: Record<string, AttrValue>,
  ...keys: string[]
): number | undefined {
  const v = getAttr(map, ...keys);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

/** First matching attribute as a boolean, or undefined if absent/wrong type. */
export function getBoolAttr(
  map: Record<string, AttrValue>,
  ...keys: string[]
): boolean | undefined {
  const v = getAttr(map, ...keys);
  return typeof v === "boolean" ? v : undefined;
}

/**
 * Convert an OTLP nanosecond timestamp to integer milliseconds.
 *
 * OTLP delivers startTimeUnixNano / endTimeUnixNano as:
 *   - string  — JSON encoding (to avoid float precision loss on int64)
 *   - number  — small values or protobuf after decoding with useLongBits:false
 *   - bigint  — when callers convert ahead of time
 *
 * Note: Fixed64 from protobuf decoding may also arrive as LongBits
 * { low, high }; callers should reconstruct a BigInt from the two 32-bit halves
 * before passing here.
 *
 * Treats 0 as "not set" and returns undefined (epoch-zero is not a meaningful
 * span timestamp in practice).
 */
export function unixNanoToMs(
  nano: string | number | bigint | undefined
): number | undefined {
  if (nano === undefined || nano === null || nano === "" || nano === 0 || nano === 0n) {
    return undefined;
  }
  const big = BigInt(nano as string | number | bigint);
  if (big === 0n) return undefined;
  return Number(big / 1_000_000n);
}
