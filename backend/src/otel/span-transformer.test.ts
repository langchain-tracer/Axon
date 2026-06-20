import { describe, it, expect } from "vitest";
import { spanToNode } from "./span-transformer.js";

const attr = (key: string, value: any) => ({ key, value });
const str = (stringValue: string) => ({ stringValue });
const int = (intValue: string) => ({ intValue });

function makeSpan(over: Record<string, any> = {}): any {
  return {
    traceId: "0af7651916cd43dd8448eb211c80319c",
    spanId: "b7ad6b7169203331",
    parentSpanId: "",
    name: "chat",
    kind: 3,
    startTimeUnixNano: "1700000000000000000",
    endTimeUnixNano: "1700000002000000000",
    attributes: [],
    status: { code: 1 },
    ...over,
  };
}

describe("spanToNode", () => {
  it("maps an LLM span: type, model, tokens, cost, and stores raw once", () => {
    const span = makeSpan({
      attributes: [
        attr("gen_ai.request.model", str("gpt-4o")),
        attr("gen_ai.usage.input_tokens", int("1000000")),
        attr("gen_ai.usage.output_tokens", int("1000000")),
        attr("gen_ai.prompt.0.content", str("hi")),
        attr("gen_ai.completion.0.content", str("hello")),
      ],
    });
    const { node, parentHex } = spanToNode(span, {});

    expect(node.type).toBe("llm");
    expect(node.model).toBe("gpt-4o");
    expect(node.tokens).toEqual({ input: 1_000_000, output: 1_000_000, total: 2_000_000 });
    expect(node.cost).toBeCloseTo(12.5); // per-model pricing
    expect(node.latency).toBe(2000);
    expect(node.status).toBe("complete");
    expect(parentHex).toBe("");

    // Verbatim span stored exactly once under data.raw (no duplicated metadata).
    const data = node.data as any;
    expect(Object.keys(data)).toEqual(["raw"]);
    expect(data.raw.name).toBe("chat");
    expect(data.raw.attributes["gen_ai.request.model"]).toBe("gpt-4o");
  });

  it("classifies a tool span and records its parent", () => {
    const span = makeSpan({
      name: "search",
      parentSpanId: "aaaa000000000001",
      attributes: [attr("tool.name", str("search"))],
    });
    const { node, parentHex } = spanToNode(span, {});
    expect(node.type).toBe("tool");
    expect(parentHex).toBe("aaaa000000000001");
    expect(node.parentRunId).toBe("aaaa000000000001");
  });

  it("marks error status from OTLP status code 2", () => {
    const { node } = spanToNode(makeSpan({ status: { code: 2, message: "boom" } }), {});
    expect(node.status).toBe("error");
    expect(node.error).toBe("boom");
  });

  it("prefers an explicit cost attribute over the pricing table", () => {
    const span = makeSpan({
      attributes: [
        attr("gen_ai.request.model", str("gpt-4o")),
        attr("gen_ai.usage.input_tokens", int("1000000")),
        attr("gen_ai.usage.cost", { doubleValue: 0.99 }),
      ],
    });
    const { node } = spanToNode(span, {});
    expect(node.cost).toBeCloseTo(0.99);
  });
});
