/**
 * Per-model token pricing (approximate public list prices, USD per 1M tokens).
 *
 * Cost priority elsewhere: an explicit cost attribute on the span wins; only
 * when absent do we estimate from token usage × these rates. Unknown models
 * fall back to a conservative DEFAULT so cost is never silently 0 when tokens
 * are present. Update the table as prices change.
 */

interface Price {
  input: number; // USD per 1M input tokens
  output: number; // USD per 1M output tokens
}

// First matching pattern wins — order specific → general (mini before base).
const TABLE: Array<{ match: RegExp; price: Price }> = [
  // OpenAI
  { match: /gpt-4o-mini/, price: { input: 0.15, output: 0.6 } },
  { match: /gpt-4o/, price: { input: 2.5, output: 10 } },
  { match: /gpt-4\.1-mini/, price: { input: 0.4, output: 1.6 } },
  { match: /gpt-4\.1/, price: { input: 2, output: 8 } },
  { match: /gpt-4-turbo/, price: { input: 10, output: 30 } },
  { match: /gpt-4/, price: { input: 30, output: 60 } },
  { match: /gpt-3\.5/, price: { input: 0.5, output: 1.5 } },
  { match: /o1-mini|o3-mini|o4-mini/, price: { input: 1.1, output: 4.4 } },
  { match: /\bo1\b|\bo3\b/, price: { input: 15, output: 60 } },
  // Anthropic
  { match: /claude.*3[.-]5[.-]?haiku|claude.*haiku/, price: { input: 0.8, output: 4 } },
  { match: /claude.*3[.-]?opus|claude.*opus/, price: { input: 15, output: 75 } },
  { match: /claude.*sonnet|claude.*3[.-]7|claude.*3[.-]5/, price: { input: 3, output: 15 } },
  { match: /claude.*3[.-]?haiku/, price: { input: 0.25, output: 1.25 } },
  // Google Gemini
  { match: /gemini.*flash/, price: { input: 0.075, output: 0.3 } },
  { match: /gemini.*pro|gemini/, price: { input: 1.25, output: 5 } },
];

const DEFAULT: Price = { input: 0.5, output: 1.5 };

function lookup(model?: string): Price {
  if (!model) return DEFAULT;
  const m = model.toLowerCase();
  for (const e of TABLE) if (e.match.test(m)) return e.price;
  return DEFAULT;
}

/** True if the model is in the pricing table (vs. using DEFAULT). */
export function isModelPriced(model?: string): boolean {
  if (!model) return false;
  const m = model.toLowerCase();
  return TABLE.some((e) => e.match.test(m));
}

/**
 * Estimate cost (USD) from token usage × per-model pricing.
 * Returns 0 when there are no tokens to price.
 */
export function estimateCost(
  model: string | undefined,
  tokens?: { input?: number; output?: number },
): number {
  const input = tokens?.input ?? 0;
  const output = tokens?.output ?? 0;
  if (!input && !output) return 0;
  const price = lookup(model);
  return (input / 1_000_000) * price.input + (output / 1_000_000) * price.output;
}
