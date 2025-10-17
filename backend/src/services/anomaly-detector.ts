/**
 * Detect anomalies in agent execution
 * SQLite version - Type-safe
 */

import { NodeModel, AnomalyModel } from "../database/models.js";
import { Node, Anomaly, CreateAnomalyInput } from "../types/index.js";
import { logger } from "../utils/logger.js";

export class AnomalyDetector {
  /**
   * Check for anomalies after node completion
   */
  async checkNode(traceId: string, node: Node): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      if (node.status !== "complete") {
        return anomalies;
      }

      // Check for loops
      if (node.type === "tool") {
        const loopAnomaly = await this.detectLoop(traceId, node);
        if (loopAnomaly) {
          const created = AnomalyModel.create(loopAnomaly);
          anomalies.push(created);
        }
      }

      // Check for cost spikes
      if (node.cost && node.cost > 0) {
        const costAnomaly = await this.detectCostSpike(traceId, node);
        if (costAnomaly) {
          const created = AnomalyModel.create(costAnomaly);
          anomalies.push(created);
        }
      }

      return anomalies;
    } catch (error) {
      logger.error("Error detecting anomalies:", { traceId, node, error });
      return anomalies;
    }
  }

  /**
   * Detect loop: same tool called multiple times with identical params
   */
  private async detectLoop(
    traceId: string,
    node: Node
  ): Promise<CreateAnomalyInput | null> {
    const allNodes = NodeModel.findByTraceId(traceId);

    const similarCalls = allNodes.filter(
      (n) =>
        n.type === "tool" &&
        n.data?.toolName === node.data?.toolName &&
        n.runId !== node.runId
    );

    if (similarCalls.length < 2) {
      return null;
    }

    const lastTwo = similarCalls
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 2);

    const currentInput = this.normalizeInput(node.data?.input);
    const areIdentical = lastTwo.every(
      (call) => this.normalizeInput(call.data?.input) === currentInput
    );

    if (!areIdentical) {
      return null;
    }

    const loopNodes = [...lastTwo, node];
    const loopCost = loopNodes.reduce((sum, n) => sum + (n.cost || 0), 0);

    return {
      traceId,
      type: "loop",
      severity: loopNodes.length >= 5 ? "critical" : "high",
      message: `Loop detected: ${node.data?.toolName} called ${
        loopNodes.length
      } times with identical parameters. Cost wasted: $${loopCost.toFixed(4)}`,
      nodes: loopNodes.map((n) => n.runId),
      suggestion: `Add circuit breaker to prevent infinite loops`,
      metadata: {
        toolName: node.data?.toolName,
        callCount: loopNodes.length,
        costWasted: loopCost
      }
    };
  }

  /**
   * Detect cost spike: node costs significantly more than average
   */
  private async detectCostSpike(
    traceId: string,
    node: Node
  ): Promise<CreateAnomalyInput | null> {
    const allNodes = NodeModel.findByTraceId(traceId);

    const similarNodes = allNodes.filter(
      (n) =>
        n.type === node.type &&
        n.runId !== node.runId &&
        n.cost !== null &&
        n.cost !== undefined
    );

    if (similarNodes.length < 2) {
      return null;
    }

    const avgCost =
      similarNodes.reduce((sum, n) => sum + (n.cost || 0), 0) /
      similarNodes.length;

    if (node.cost! < avgCost * 3) {
      return null;
    }

    const costDiff = node.cost! - avgCost;
    const pctIncrease = ((node.cost! / avgCost - 1) * 100).toFixed(0);

    let suggestion = "";
    if (node.type === "llm") {
      suggestion = `This LLM call used ${node.tokens?.total} tokens (${pctIncrease}% more than average). Consider:\n`;
      suggestion += `1. Use a cheaper model (e.g., GPT-3.5 instead of GPT-4)\n`;
      suggestion += `2. Reduce prompt length\n`;
      suggestion += `3. Set max_tokens limit`;
    }

    return {
      traceId,
      type: "cost_spike",
      severity: node.cost! > avgCost * 5 ? "critical" : "high",
      message: `Cost spike detected: This ${
        node.type
      } call cost $${node.cost!.toFixed(
        4
      )} (${pctIncrease}% higher than average $${avgCost.toFixed(4)})`,
      nodes: [node.runId],
      suggestion,
      metadata: {
        nodeCost: node.cost,
        averageCost: avgCost,
        costDifference: costDiff,
        percentIncrease: parseFloat(pctIncrease)
      }
    };
  }

  /**
   * Normalize input for comparison
   */
  private normalizeInput(input: any): string {
    if (!input) return "";

    try {
      const str = typeof input === "string" ? input : JSON.stringify(input);
      return str.toLowerCase().replace(/\s/g, "");
    } catch {
      return String(input);
    }
  }
}
