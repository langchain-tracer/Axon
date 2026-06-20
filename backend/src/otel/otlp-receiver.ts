/**
 * OTLP /v1/traces HTTP receiver.
 *
 * Accepts POST /v1/traces with:
 *   Content-Type: application/json  OR  application/x-protobuf
 *   Content-Encoding: gzip  (optional)
 *
 * Exposes:
 *   decodeOtlpTraceRequest — parse raw body bytes → IExportTraceServiceRequest
 *   createOtlpTraceHandler — Express handler factory; inject onIngest callback
 *                            so server.ts can emit Socket.IO events after store.
 *
 * Protobuf decoding is implemented without protobufjs by driving the package's
 * internal ProtobufReader directly.  The field map mirrors the OTLP trace proto
 * (opentelemetry-proto/collector/trace/v1 + trace/v1 + common/v1).
 *
 * This module has NO imports from server.ts and NO Socket.IO imports.
 * Mounting (app.post + express.raw) is done in server.ts (Task #6).
 */

import { gunzipSync } from "node:zlib";
import type { Request, Response } from "express";
import type {
  IExportTraceServiceRequest,
  IResourceSpans,
  IScopeSpans,
  ISpan,
  IStatus,
  IEvent,
  ILink,
  ESpanKind,
} from "@opentelemetry/otlp-transformer/build/src/trace/internal-types";
import type {
  Resource,
  IInstrumentationScope,
  IKeyValue,
  IAnyValue,
  LongBits,
} from "@opentelemetry/otlp-transformer/build/src/common/internal-types";
// ── Fragility notice ────────────────────────────────────────────────────────
// @opentelemetry/otlp-transformer@0.219.0 is pinned in package.json (no ^).
//
// This receiver decodes OTLP/proto requests using the package's internal
// ProtobufReader class.  Two things will break if the package is upgraded
// without review:
//   1. The internal path  build/src/common/protobuf/protobuf-reader
//      (no exports map — any file could move or be renamed in a patch).
//   2. The _buf private field accessed via (reader as any)._buf (lines ~70+).
//      TypeScript enforces privacy at compile time only; at JS runtime it is
//      a plain property — but the name could change.
//
// @opentelemetry/otlp-transformer does NOT expose a server-side
// deserializeRequest (only client-side serializeRequest / deserializeResponse).
// protobufjs is not a dependency of this repo, so the hand-rolled decoder is
// the least-bad option at this package version.
//
// Before bumping the package: run the protobuf smoke test in Task #11 and
// verify ProtobufReader._buf still exists at the same path.
// ────────────────────────────────────────────────────────────────────────────
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ProtobufReader: new (buf: Uint8Array) => any =
  _require("@opentelemetry/otlp-transformer/build/src/common/protobuf/protobuf-reader").ProtobufReader;
import { transformAndStore, type IngestResult } from "./span-transformer.js";
import { logger } from "../utils/logger.js";

// ── OTLP success response payloads ─────────────────────────────────────────
// Protobuf: empty ExportTraceServiceResponse (no partial_success = all spans
// accepted).  Per OTLP spec, omitting partial_success signals full acceptance.
const PROTO_SUCCESS: Buffer = Buffer.alloc(0);
// JSON success response
const JSON_SUCCESS = { partialSuccess: {} };

// Max body size enforced by this handler (express.raw should reject before us,
// but this acts as a belt-and-suspenders guard).
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Protobuf internal helpers ──────────────────────────────────────────────

/**
 * Read an 8-byte little-endian fixed64 field from reader's current position.
 * ProtobufReader._buf is a TypeScript private but a plain JS property — we
 * access it here rather than subclassing to keep this module self-contained.
 */
function readFixed64(reader: InstanceType<typeof ProtobufReader>): LongBits {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = (reader as any)._buf as Uint8Array;
  const pos = reader.pos;
  if (pos + 8 > buf.length) throw new Error("Buffer too short for fixed64");
  const low =
    ((buf[pos] |
      (buf[pos + 1] << 8) |
      (buf[pos + 2] << 16) |
      (buf[pos + 3] << 24)) >>>
    0) as number;
  const high =
    ((buf[pos + 4] |
      (buf[pos + 5] << 8) |
      (buf[pos + 6] << 16) |
      (buf[pos + 7] << 24)) >>>
    0) as number;
  reader.pos += 8;
  return { low, high };
}

/**
 * Read a little-endian IEEE 754 double (wire type 1, 8 bytes).
 */
function readDouble(reader: InstanceType<typeof ProtobufReader>): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = (reader as any)._buf as Uint8Array;
  const dv = new DataView(buf.buffer, buf.byteOffset + reader.pos, 8);
  reader.pos += 8;
  return dv.getFloat64(0, true);
}

// ── AnyValue decoder ────────────────────────────────────────────────────────
// Field map (common/v1/common.proto, AnyValue):
//   1 string_value  string  (length-delimited)
//   2 bool_value    bool    (varint)
//   3 int_value     int64   (varint)
//   4 double_value  double  (64-bit fixed, wire type 1)
//   5 array_value   ArrayValue  (length-delimited)
//   6 kvlist_value  KeyValueList (length-delimited)
//   7 bytes_value   bytes   (length-delimited)

function decodeAnyValue(data: Uint8Array): IAnyValue {
  const reader = new ProtobufReader(data);
  const result: IAnyValue = {};
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1: result.stringValue = reader.readString(); break;
      case 2: result.boolValue   = reader.readVarint() !== 0; break;
      case 3: result.intValue    = reader.readVarint(); break;
      case 4: result.doubleValue = readDouble(reader); break;
      case 5: result.arrayValue  = decodeArrayValue(reader.readBytes()); break;
      case 6: result.kvlistValue = decodeKvListValue(reader.readBytes()); break;
      case 7: result.bytesValue  = reader.readBytes(); break;
      default: reader.skip(wireType); break;
    }
  }
  return result;
}

function decodeArrayValue(data: Uint8Array): { values: IAnyValue[] } {
  const reader = new ProtobufReader(data);
  const values: IAnyValue[] = [];
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    if (fieldNumber === 1 && wireType === 2) {
      values.push(decodeAnyValue(reader.readBytes()));
    } else {
      reader.skip(wireType);
    }
  }
  return { values };
}

function decodeKvListValue(data: Uint8Array): { values: IKeyValue[] } {
  const reader = new ProtobufReader(data);
  const values: IKeyValue[] = [];
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    if (fieldNumber === 1 && wireType === 2) {
      values.push(decodeKeyValue(reader.readBytes()));
    } else {
      reader.skip(wireType);
    }
  }
  return { values };
}

// ── KeyValue decoder ────────────────────────────────────────────────────────
// Field map (common/v1/common.proto, KeyValue):
//   1 key    string   (length-delimited)
//   2 value  AnyValue (length-delimited)

function decodeKeyValue(data: Uint8Array): IKeyValue {
  const reader = new ProtobufReader(data);
  let key = "";
  let value: IAnyValue = {};
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1: key   = reader.readString(); break;
      case 2: value = decodeAnyValue(reader.readBytes()); break;
      default: reader.skip(wireType); break;
    }
  }
  return { key, value };
}

// ── Resource decoder ────────────────────────────────────────────────────────
// Field map (resource/v1/resource.proto, Resource):
//   1 attributes                repeated KeyValue  (length-delimited)
//   2 dropped_attributes_count  uint32             (varint)

function decodeResource(data: Uint8Array): Resource {
  const reader = new ProtobufReader(data);
  const attributes: IKeyValue[] = [];
  let droppedAttributesCount = 0;
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1: attributes.push(decodeKeyValue(reader.readBytes())); break;
      case 2: droppedAttributesCount = reader.readVarint(); break;
      default: reader.skip(wireType); break;
    }
  }
  return { attributes, droppedAttributesCount };
}

// ── InstrumentationScope decoder ─────────────────────────────────────────────
// Field map (common/v1/common.proto, InstrumentationScope):
//   1 name                      string  (length-delimited)
//   2 version                   string  (length-delimited)
//   3 attributes                repeated KeyValue (length-delimited)
//   4 dropped_attributes_count  uint32  (varint)

function decodeScope(data: Uint8Array): IInstrumentationScope {
  const reader = new ProtobufReader(data);
  let name = "";
  let version: string | undefined;
  const attributes: IKeyValue[] = [];
  let droppedAttributesCount = 0;
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1: name    = reader.readString(); break;
      case 2: version = reader.readString(); break;
      case 3: attributes.push(decodeKeyValue(reader.readBytes())); break;
      case 4: droppedAttributesCount = reader.readVarint(); break;
      default: reader.skip(wireType); break;
    }
  }
  return { name, version, attributes, droppedAttributesCount };
}

// ── Status decoder ──────────────────────────────────────────────────────────
// Field map (trace/v1/trace.proto, Status):
//   1 (reserved — not used in proto3)
//   2 message  string     (length-delimited)
//   3 code     StatusCode (varint)

function decodeStatus(data: Uint8Array): IStatus {
  const reader = new ProtobufReader(data);
  let message: string | undefined;
  let code = 0;
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 2: message = reader.readString(); break;
      case 3: code    = reader.readVarint(); break;
      default: reader.skip(wireType); break;
    }
  }
  // Cast code as EStatusCode — const enum inlined by tsc, just a number at runtime
  return { message, code } as IStatus;
}

// ── Event decoder ─────────────────────────────────────────────────────────────
// Field map (trace/v1/trace.proto, Span.Event):
//   1 time_unix_nano           fixed64           (64-bit, wire type 1)
//   2 name                     string            (length-delimited)
//   3 attributes               repeated KeyValue (length-delimited)
//   4 dropped_attributes_count uint32            (varint)

function decodeEvent(data: Uint8Array): IEvent {
  const reader = new ProtobufReader(data);
  let timeUnixNano: LongBits = { low: 0, high: 0 };
  let name = "";
  const attributes: IKeyValue[] = [];
  let droppedAttributesCount = 0;
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1: timeUnixNano = readFixed64(reader); break;
      case 2: name         = reader.readString(); break;
      case 3: attributes.push(decodeKeyValue(reader.readBytes())); break;
      case 4: droppedAttributesCount = reader.readVarint(); break;
      default: reader.skip(wireType); break;
    }
  }
  return { timeUnixNano, name, attributes, droppedAttributesCount };
}

// ── Link decoder ──────────────────────────────────────────────────────────────
// Field map (trace/v1/trace.proto, Span.Link):
//   1 trace_id                 bytes             (length-delimited)
//   2 span_id                  bytes             (length-delimited)
//   3 trace_state              string            (length-delimited)
//   4 attributes               repeated KeyValue (length-delimited)
//   5 dropped_attributes_count uint32            (varint)
//   6 flags                    fixed32           (32-bit, wire type 5)

function decodeLink(data: Uint8Array): ILink {
  const reader = new ProtobufReader(data);
  let traceId: Uint8Array = new Uint8Array(0);
  let spanId: Uint8Array  = new Uint8Array(0);
  let traceState: string | undefined;
  const attributes: IKeyValue[] = [];
  let droppedAttributesCount = 0;
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1: traceId    = reader.readBytes(); break;
      case 2: spanId     = reader.readBytes(); break;
      case 3: traceState = reader.readString(); break;
      case 4: attributes.push(decodeKeyValue(reader.readBytes())); break;
      case 5: droppedAttributesCount = reader.readVarint(); break;
      default: reader.skip(wireType); break; // includes flags (field 6, fixed32)
    }
  }
  return { traceId, spanId, traceState, attributes, droppedAttributesCount };
}

// ── Span decoder ──────────────────────────────────────────────────────────────
// Field map (trace/v1/trace.proto, Span):
//   1  trace_id                 bytes              (length-delimited)
//   2  span_id                  bytes              (length-delimited)
//   3  trace_state              string             (length-delimited)
//   4  parent_span_id           bytes              (length-delimited)
//   5  name                     string             (length-delimited)
//   6  kind                     SpanKind           (varint)
//   7  start_time_unix_nano     fixed64            (64-bit, wire type 1)
//   8  end_time_unix_nano       fixed64            (64-bit, wire type 1)
//   9  attributes               repeated KeyValue  (length-delimited)
//  10  dropped_attributes_count uint32             (varint)
//  11  events                   repeated Event     (length-delimited)
//  12  dropped_events_count     uint32             (varint)
//  13  links                    repeated Link      (length-delimited)
//  14  dropped_links_count      uint32             (varint)
//  15  status                   Status             (length-delimited)
//  16  flags                    fixed32            (32-bit, wire type 5)

function decodeSpan(data: Uint8Array): ISpan {
  const reader = new ProtobufReader(data);
  let traceId: Uint8Array    = new Uint8Array(0);
  let spanId: Uint8Array     = new Uint8Array(0);
  let traceState: string | undefined;
  let parentSpanId: Uint8Array | undefined;
  let name = "";
  let kind = 0;
  let startTimeUnixNano: LongBits = { low: 0, high: 0 };
  let endTimeUnixNano: LongBits   = { low: 0, high: 0 };
  const attributes: IKeyValue[]   = [];
  let droppedAttributesCount = 0;
  const events: IEvent[] = [];
  let droppedEventsCount = 0;
  const links: ILink[] = [];
  let droppedLinksCount = 0;
  let status: IStatus = { code: 0 };

  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1:  traceId                = reader.readBytes(); break;
      case 2:  spanId                 = reader.readBytes(); break;
      case 3:  traceState             = reader.readString(); break;
      case 4:  parentSpanId           = reader.readBytes(); break;
      case 5:  name                   = reader.readString(); break;
      case 6:  kind                   = reader.readVarint(); break;
      case 7:  startTimeUnixNano      = readFixed64(reader); break;
      case 8:  endTimeUnixNano        = readFixed64(reader); break;
      case 9:  attributes.push(decodeKeyValue(reader.readBytes())); break;
      case 10: droppedAttributesCount = reader.readVarint(); break;
      case 11: events.push(decodeEvent(reader.readBytes())); break;
      case 12: droppedEventsCount     = reader.readVarint(); break;
      case 13: links.push(decodeLink(reader.readBytes())); break;
      case 14: droppedLinksCount      = reader.readVarint(); break;
      case 15: status                 = decodeStatus(reader.readBytes()); break;
      default: reader.skip(wireType); break; // includes flags (field 16, fixed32)
    }
  }

  return {
    traceId,
    spanId,
    traceState,
    parentSpanId,
    name,
    kind: kind as ESpanKind,
    startTimeUnixNano,
    endTimeUnixNano,
    attributes,
    droppedAttributesCount,
    events,
    droppedEventsCount,
    links,
    droppedLinksCount,
    status,
  };
}

// ── ScopeSpans decoder ────────────────────────────────────────────────────────
// Field map (trace/v1/trace.proto, ScopeSpans):
//   1 scope      InstrumentationScope (length-delimited)
//   2 spans      repeated Span        (length-delimited)
//   3 schema_url string               (length-delimited)

function decodeScopeSpans(data: Uint8Array): IScopeSpans {
  const reader = new ProtobufReader(data);
  let scope: IInstrumentationScope | undefined;
  const spans: ISpan[] = [];
  let schemaUrl: string | undefined;
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1: scope     = decodeScope(reader.readBytes()); break;
      case 2: spans.push(decodeSpan(reader.readBytes())); break;
      case 3: schemaUrl = reader.readString(); break;
      default: reader.skip(wireType); break;
    }
  }
  return { scope, spans, schemaUrl };
}

// ── ResourceSpans decoder ─────────────────────────────────────────────────────
// Field map (trace/v1/trace.proto, ResourceSpans):
//   1 resource    Resource              (length-delimited)
//   2 scope_spans repeated ScopeSpans  (length-delimited)
//   3 schema_url  string               (length-delimited)

function decodeResourceSpans(data: Uint8Array): IResourceSpans {
  const reader = new ProtobufReader(data);
  let resource: Resource | undefined;
  const scopeSpans: IScopeSpans[] = [];
  let schemaUrl: string | undefined;
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    switch (fieldNumber) {
      case 1: resource = decodeResource(reader.readBytes()); break;
      case 2: scopeSpans.push(decodeScopeSpans(reader.readBytes())); break;
      case 3: schemaUrl = reader.readString(); break;
      default: reader.skip(wireType); break;
    }
  }
  return { resource, scopeSpans, schemaUrl };
}

// ── ExportTraceServiceRequest decoder ────────────────────────────────────────
// Field map (collector/trace/v1/trace_service.proto, ExportTraceServiceRequest):
//   1 resource_spans repeated ResourceSpans (length-delimited)

function decodeProtobufRequest(data: Uint8Array): IExportTraceServiceRequest {
  const reader = new ProtobufReader(data);
  const resourceSpans: IResourceSpans[] = [];
  while (!reader.isAtEnd()) {
    const { fieldNumber, wireType } = reader.readTag();
    if (fieldNumber === 1 && wireType === 2) {
      resourceSpans.push(decodeResourceSpans(reader.readBytes()));
    } else {
      reader.skip(wireType);
    }
  }
  return { resourceSpans };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Decode a raw OTLP trace export request body into an in-memory object model.
 *
 * @param body            — raw request body (Buffer from express.raw middleware)
 * @param contentType     — request Content-Type header value
 * @param contentEncoding — request Content-Encoding header value (e.g. "gzip")
 *
 * Throws with `.status = 415` for unsupported Content-Type.
 * Throws with `.status = 400` for malformed JSON / truncated protobuf.
 */
export function decodeOtlpTraceRequest(
  body: Buffer,
  contentType: string,
  contentEncoding?: string,
): IExportTraceServiceRequest {
  let data: Buffer = body;

  if (contentEncoding && contentEncoding.includes("gzip")) {
    try {
      data = Buffer.from(gunzipSync(body));
    } catch (err) {
      const e = new Error("Failed to decompress gzip body") as Error & {
        status: number;
      };
      e.status = 400;
      throw e;
    }
  }

  const ct = contentType.split(";")[0].trim().toLowerCase();

  if (ct === "application/json") {
    try {
      return JSON.parse(data.toString("utf8")) as IExportTraceServiceRequest;
    } catch {
      const e = new Error("Invalid JSON body") as Error & { status: number };
      e.status = 400;
      throw e;
    }
  }

  if (ct === "application/x-protobuf") {
    try {
      return decodeProtobufRequest(data);
    } catch (err) {
      const e = new Error(
        `Failed to decode protobuf body: ${(err as Error).message}`,
      ) as Error & { status: number };
      e.status = 400;
      throw e;
    }
  }

  const e = new Error(
    `Unsupported Content-Type: "${contentType}". Use application/json or application/x-protobuf.`,
  ) as Error & { status: number };
  e.status = 415;
  throw e;
}

/**
 * Create an Express request handler for POST /v1/traces.
 *
 * Mount with `express.raw({ type: "*\/*", limit: "10mb" })` middleware scoped
 * to this route so `req.body` arrives as a Buffer without the global
 * `express.json()` corrupting protobuf payloads.
 *
 * @param opts.onIngest — callback invoked with the ingest result (created vs
 *                        updated trace IDs) after the spans have been stored;
 *                        use it to emit SSE events.
 */
export function createOtlpTraceHandler(opts?: {
  onIngest?: (result: IngestResult) => void;
}): (req: Request, res: Response) => void {
  return (req: Request, res: Response): void => {
    const contentType = (req.headers["content-type"] ?? "application/json") as string;
    const contentEncoding = req.headers["content-encoding"] as string | undefined;
    const isProto = contentType.includes("application/x-protobuf");

    const body = req.body as Buffer;

    // Belt-and-suspenders size check (express.raw limit handles the normal case)
    if (!Buffer.isBuffer(body)) {
      res.status(400).json({ error: "Request body must be raw bytes. Mount express.raw() on this route." });
      return;
    }

    if (body.length > MAX_BODY_BYTES) {
      res.status(413).json({ error: "Payload too large (max 10 MB)" });
      return;
    }

    // ── Decode ─────────────────────────────────────────────────────────────
    let request: IExportTraceServiceRequest;
    try {
      request = decodeOtlpTraceRequest(body, contentType, contentEncoding);
    } catch (err: unknown) {
      const typed = err as { status?: number; message?: string };
      if (typed.status === 415) {
        res.status(415).json({ error: typed.message });
        return;
      }
      logger.warn("[otlp-receiver] decode failed", { err });
      res.status(400).json({ error: typed.message ?? "Failed to decode OTLP request" });
      return;
    }

    // ── Transform + store ──────────────────────────────────────────────────
    let result: IngestResult;
    try {
      result = transformAndStore(request);
      logger.info("[otlp-receiver] ingested", {
        created: result.created.length,
        updated: result.updated.length,
        nodes: result.nodeCount,
      });
    } catch (err) {
      logger.error("[otlp-receiver] store failed", { err });
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    // ── Notify via callback (SSE) ──────────────────────────────────────────
    if ((result.created.length || result.updated.length) && opts?.onIngest) {
      try {
        opts.onIngest(result);
      } catch (err) {
        // onIngest failures are non-fatal — data is already committed
        logger.warn("[otlp-receiver] onIngest callback threw", { err });
      }
    }

    // ── Respond with OTLP success ──────────────────────────────────────────
    if (isProto) {
      res
        .status(200)
        .type("application/x-protobuf")
        .send(PROTO_SUCCESS);
    } else {
      res.status(200).json(JSON_SUCCESS);
    }
  };
}
