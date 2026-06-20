import { describe, it, expect } from "vitest";
import { estimateCost, isModelPriced } from "./pricing.js";

const M = { input: 1_000_000, output: 1_000_000 };

describe("estimateCost", () => {
  it("prices known models from the table (per 1M tokens)", () => {
    expect(estimateCost("gpt-4o", M)).toBeCloseTo(12.5);
    expect(estimateCost("gpt-4o-mini", M)).toBeCloseTo(0.75);
    expect(estimateCost("claude-3-5-sonnet-20241022", M)).toBeCloseTo(18);
  });

  it("returns 0 when there are no tokens to price", () => {
    expect(estimateCost("gpt-4o", { input: 0, output: 0 })).toBe(0);
    expect(estimateCost("gpt-4o", undefined)).toBe(0);
  });

  it("falls back to a default rate for unknown models", () => {
    expect(estimateCost("some-future-model", { input: 1_000_000, output: 0 })).toBeCloseTo(0.5);
    expect(isModelPriced("some-future-model")).toBe(false);
    expect(isModelPriced("gpt-4o")).toBe(true);
  });
});
