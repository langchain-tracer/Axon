import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { ProtobufTraceSerializer } from "@opentelemetry/otlp-transformer";
import { decodeOtlpTraceRequest } from "./otlp-receiver.js";
import { attributesToMap } from "./attributes.js";

// A minimal OTLP-JSON request (what the dashboard/clients send over HTTP+JSON).
function sampleJsonRequest(): any {
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: "svc" } }] },
        scopeSpans: [
          {
            scope: { name: "test", version: "1.0" },
            spans: [
              {
                traceId: "0af7651916cd43dd8448eb211c80319c",
                spanId: "b7ad6b7169203331",
                name: "chat",
                kind: 3,
                startTimeUnixNano: "1700000000000000000",
                endTimeUnixNano: "1700000002000000000",
                attributes: [{ key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } }],
                status: { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };
}

// A minimal SDK ReadableSpan — the shape ProtobufTraceSerializer.serializeRequest expects.
function sampleReadableSpans(): any[] {
  const resource = { attributes: { "service.name": "svc" } };
  return [
    {
      name: "chat",
      kind: 3,
      spanContext: () => ({
        traceId: "0af7651916cd43dd8448eb211c80319c",
        spanId: "b7ad6b7169203331",
        traceFlags: 1,
      }),
      parentSpanContext: undefined,
      startTime: [1_700_000_000, 0],
      endTime: [1_700_000_002, 0],
      duration: [2, 0],
      status: { code: 0 },
      attributes: { "gen_ai.request.model": "gpt-4o" },
      links: [],
      events: [],
      ended: true,
      resource,
      instrumentationScope: { name: "test", version: "1.0" },
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    },
  ];
}

describe("decodeOtlpTraceRequest", () => {
  it("decodes JSON (and gzipped JSON)", () => {
    const body = Buffer.from(JSON.stringify(sampleJsonRequest()));
    const decoded = decodeOtlpTraceRequest(body, "application/json");
    expect(decoded.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]?.name).toBe("chat");

    const gz = gzipSync(body);
    const decodedGz = decodeOtlpTraceRequest(Buffer.from(gz), "application/json", "gzip");
    expect(decodedGz.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]?.name).toBe("chat");
  });

  it("round-trips protobuf through the hand-rolled decoder", () => {
    const bytes = ProtobufTraceSerializer.serializeRequest(sampleReadableSpans() as any)!;
    const decoded = decodeOtlpTraceRequest(Buffer.from(bytes), "application/x-protobuf");

    const span = decoded.resourceSpans![0].scopeSpans![0].spans![0];
    expect(span.name).toBe("chat");
    const attrs = attributesToMap(span.attributes);
    expect(attrs["gen_ai.request.model"]).toBe("gpt-4o");
    const resAttrs = attributesToMap(decoded.resourceSpans![0].resource!.attributes);
    expect(resAttrs["service.name"]).toBe("svc");
  });

  it("rejects an unsupported content-type with status 415", () => {
    expect(() => decodeOtlpTraceRequest(Buffer.from("x"), "text/plain")).toThrowError(/Unsupported/);
  });
});
