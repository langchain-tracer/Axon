/**
 * Pure helpers for shaping stored trace data into the frontend-facing format.
 * No DB access, no Express — trivially unit-testable.
 */

/**
 * Estimate token counts from node content when exact token data is unavailable.
 * Rough heuristic: ~4 characters per token.
 */
export function estimateTokensFromContent(
  node: any
): { input: number; output: number; total: number } | undefined {
  let inputTokens = 0;
  let outputTokens = 0;

  if (node.prompt) inputTokens = Math.ceil(node.prompt.length / 4);
  if (node.response) outputTokens = Math.ceil(node.response.length / 4);
  if (node.toolInput) inputTokens += Math.ceil(node.toolInput.length / 4);
  if (node.toolOutput) outputTokens += Math.ceil(node.toolOutput.length / 4);

  if (inputTokens > 0 || outputTokens > 0) {
    return { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens };
  }
  return undefined;
}

/**
 * Generate a short human-readable description for a trace, preferring the first
 * LLM prompt and falling back to a status-based summary.
 */
export function generateTraceDescription(trace: any, nodes: any[]): string {
  const status = trace.status || "running";
  const nodeCount = nodes.length;

  const firstLLMNode = nodes.find((n) => n.type === "llm");
  if (firstLLMNode?.data?.prompts?.[0]) {
    const prompt = firstLLMNode.data.prompts[0];
    return prompt.length > 100 ? prompt.substring(0, 100) + "..." : prompt;
  }

  if (status === "complete") return `Completed with ${nodeCount} steps`;
  if (status === "error") return `Failed at step ${nodeCount}`;
  return `Processing (${nodeCount} steps so far)`;
}

/** Total trace latency in ms; uses now() as the end when the trace is still running. */
export function calculateTraceLatency(trace: any): number {
  if (trace.endTime && trace.startTime) return trace.endTime - trace.startTime;
  return Date.now() - trace.startTime;
}
