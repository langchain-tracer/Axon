import type { LLMCaller } from "./ReplayEngine";

export function createBackendLLMCaller(basePath = "/api/llm"): LLMCaller {
  return async ({ model, messages, temperature, maxTokens, signal }) => {
    const res = await fetch(basePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, maxTokens }),
      signal
    });
    if (!res.ok) throw new Error(`LLM proxy failed: ${res.status}`);
    const data = await res.json();
    return data.text ?? "";
  };
}