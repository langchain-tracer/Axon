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

    // If we have actual token counts, use them
    if (tokens.prompt > 0 || tokens.completion > 0) {
      return (
        (tokens.prompt / 1000) * rates.input +
        (tokens.completion / 1000) * rates.output
      );
    }

    // If no token data, return a minimal cost to indicate the operation happened
    return 0.0001; // $0.0001 as a base cost for any LLM operation
  }

  /**
   * Calculate cost for tool operations
   */
  static calculateToolCost(toolName: string, latency: number): number {
    // Tools typically have minimal costs, but we can estimate based on complexity
    const toolCosts: Record<string, number> = {
      "search": 0.00005,      // Search operations
      "calculator": 0.00001,  // Simple calculations
      "weather": 0.00002,     // API calls
      "web_search": 0.00005,  // Web search
      "file_read": 0.00001,   // File operations
      "database": 0.00003     // Database queries
    };

    const baseCost = toolCosts[toolName] || 0.00002; // Default cost for unknown tools
    
    // Add a small latency-based cost (longer operations cost slightly more)
    const latencyCost = Math.min(latency / 1000000, 0.00001); // Max $0.00001 for latency
    
    return baseCost + latencyCost;
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
