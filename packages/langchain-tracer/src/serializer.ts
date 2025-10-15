/**
 * Serialize LangChain data for transmission
 */

import { LLMResult } from "@langchain/core/outputs";
import { Serialized } from "@langchain/core/load/serializable";

export class EventSerializer {
  /**
   * Serialize LLM result
   */
  static serializeLLMResult(result: LLMResult): {
    response: string;
    tokens: { prompt: number; completion: number; total: number };
  } {
    const generations = result.generations[0];
    const response = generations?.[0]?.text || "";

    const tokenUsage = result.llmOutput?.tokenUsage || {};
    const tokens = {
      prompt: tokenUsage.promptTokens || 0,
      completion: tokenUsage.completionTokens || 0,
      total: tokenUsage.totalTokens || 0
    };

    return { response, tokens };
  }

  /**
   * Serialize serialized object (model info, etc)
   */
  static serializeSerialized(serialized: Serialized): {
    type: string;
    name: string;
    params: Record<string, any>;
  } {
    console.log(serialized, "serialized");
    return {
      type: String(serialized.lc || "unknown"),
      name: serialized.id?.[serialized.id.length - 1] || "unknown",
      params: ("kwargs" in serialized ? serialized.kwargs : {}) || {}
    };
  }

  /**
   * Serialize tool input (can be string or object)
   */
  static serializeToolInput(
    input: string | Record<string, any>
  ): string | Record<string, any> {
    if (typeof input === "string") {
      return input;
    }

    try {
      // Remove non-serializable properties
      return JSON.parse(JSON.stringify(input));
    } catch (error) {
      return String(input);
    }
  }

  /**
   * Calculate cost based on tokens and model
   */
  static calculateCost(
    model: string,
    tokens: { prompt: number; completion: number; total: number }
  ): number {
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4": { input: 0.03, output: 0.06 },
      "gpt-4-turbo": { input: 0.01, output: 0.03 },
      "gpt-3.5-turbo": { input: 0.0015, output: 0.002 },
      "claude-3-opus": { input: 0.015, output: 0.075 },
      "claude-3-sonnet": { input: 0.003, output: 0.015 },
      "claude-3-haiku": { input: 0.00025, output: 0.00125 }
    };

    const rates = pricing[model] || pricing["gpt-3.5-turbo"];

    return (
      (tokens.prompt / 1000) * rates.input +
      (tokens.completion / 1000) * rates.output
    );
  }

  /**
   * Extract model name from serialized data
   */
  static extractModelName(serialized: Serialized): string {
    const params = ("kwargs" in serialized ? serialized.kwargs : {}) || {};
    return params.model_name || params.model || "unknown";
  }

  /**
   * Safely stringify error
   */
  static serializeError(error: Error): { message: string; stack?: string } {
    return {
      message: error.message,
      stack: error.stack
    };
  }
}
