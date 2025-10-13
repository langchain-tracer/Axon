import { Node } from "reactflow";

// ============================================================================
// TYPES
// ============================================================================

export interface Anomaly {
  id: string;
  nodeId: string;
  type:
    | "loop"
    | "cost-spike"
    | "contradiction"
    | "timeout-risk"
    | "token-spike"
    | "slow-operation";
  severity: "high" | "medium" | "low";
  message: string;
  suggestion: string;
  cost?: number;
  metadata?: Record<string, any>;
}

interface TraceNodeData {
  label: string;
  type: "llm" | "tool" | "decision";
  cost: number;
  tokens?: { input: number; output: number };
  latency: number;
  status: "complete" | "running" | "error" | "pending";
  prompt?: string;
  response?: string;
  toolParams?: Record<string, any>;
  toolResult?: any;
  timestamp: number;
}

interface DetectionConfig {
  loopThreshold?: number;
  costSpikeMultiplier?: number;
  latencySpikeMultiplier?: number;
  tokenSpikeMultiplier?: number;
  similarityThreshold?: number;
}

// ============================================================================
// LOOP DETECTION
// ============================================================================

export const detectLoops = (
  nodes: Node<TraceNodeData>[],
  config: DetectionConfig = {}
): Anomaly[] => {
  const { loopThreshold = 3, similarityThreshold = 0.9 } = config;
  const anomalies: Anomaly[] = [];

  // Group by tool name
  const toolCalls = nodes.filter((n) => n.data.type === "tool");
  const callGroups = new Map<string, Node<TraceNodeData>[]>();

  toolCalls.forEach((node) => {
    const key = node.data.label;
    if (!callGroups.has(key)) callGroups.set(key, []);
    callGroups.get(key)!.push(node);
  });

  // Check each group for loops
  callGroups.forEach((calls, toolName) => {
    if (calls.length <= loopThreshold) return;

    // Check for identical or similar parameters
    const paramGroups = new Map<string, Node<TraceNodeData>[]>();

    calls.forEach((call) => {
      const paramStr = JSON.stringify(call.data.toolParams || {});
      if (!paramGroups.has(paramStr)) paramGroups.set(paramStr, []);
      paramGroups.get(paramStr)!.push(call);
    });

    paramGroups.forEach((group, paramStr) => {
      if (group.length > loopThreshold) {
        const totalCost = group.reduce((sum, n) => sum + n.data.cost, 0);
        const wastedCost = (totalCost * (group.length - 1)) / group.length;

        anomalies.push({
          id: `loop_${toolName}_${Date.now()}`,
          nodeId: group[0].id,
          type: "loop",
          severity: "high",
          message: `${toolName} called ${group.length} times with identical parameters`,
          suggestion: `Add circuit breaker: after ${loopThreshold} identical calls, cache results or raise error. Consider adding a retry counter with exponential backoff.`,
          cost: wastedCost,
          metadata: {
            callCount: group.length,
            params: paramStr,
            nodeIds: group.map((n) => n.id)
          }
        });
      }
    });

    // Check for near-identical parameters (fuzzy matching)
    if (calls.length > loopThreshold) {
      const groups = fuzzyGroupByParams(calls, similarityThreshold);
      groups.forEach((group, signature) => {
        if (group.length > loopThreshold) {
          const totalCost = group.reduce((sum, n) => sum + n.data.cost, 0);

          anomalies.push({
            id: `fuzzy_loop_${toolName}_${Date.now()}`,
            nodeId: group[0].id,
            type: "loop",
            severity: "medium",
            message: `${toolName} called ${group.length} times with nearly identical parameters`,
            suggestion: `Parameters vary slightly but may indicate a loop. Consider normalizing inputs or adding fuzzy caching.`,
            cost: totalCost,
            metadata: {
              callCount: group.length,
              signature,
              nodeIds: group.map((n) => n.id)
            }
          });
        }
      });
    }
  });

  return anomalies;
};

// ============================================================================
// COST SPIKE DETECTION
// ============================================================================

export const detectCostSpikes = (
  nodes: Node<TraceNodeData>[],
  historicalAvg?: number,
  config: DetectionConfig = {}
): Anomaly[] => {
  const { costSpikeMultiplier = 3 } = config;
  const anomalies: Anomaly[] = [];

  // Calculate average cost
  const costs = nodes.map((n) => n.data.cost);
  const avgCost = costs.reduce((sum, c) => sum + c, 0) / costs.length;
  const baseAvg = historicalAvg || avgCost;

  // Find spikes
  nodes.forEach((node) => {
    if (node.data.cost > baseAvg * costSpikeMultiplier) {
      const multiple = (node.data.cost / baseAvg).toFixed(1);

      let suggestion = `Cost is ${multiple}x higher than average. `;
      if (node.data.type === "llm") {
        suggestion += `Consider: 1) Reducing output tokens via max_tokens parameter, 2) Shortening system prompt, 3) Using a cheaper model, 4) Caching similar requests.`;
      } else if (node.data.type === "tool") {
        suggestion += `Consider: 1) Limiting result set size, 2) Adding pagination, 3) Caching frequently accessed data, 4) Using cheaper API tier.`;
      }

      anomalies.push({
        id: `cost_spike_${node.id}`,
        nodeId: node.id,
        type: "cost-spike",
        severity: node.data.cost > baseAvg * 5 ? "high" : "medium",
        message: `${
          node.data.label
        }: Cost ${multiple}x higher than average ($${baseAvg.toFixed(4)})`,
        suggestion,
        cost: node.data.cost - baseAvg,
        metadata: {
          actualCost: node.data.cost,
          avgCost: baseAvg,
          multiple: parseFloat(multiple)
        }
      });
    }
  });

  return anomalies;
};

// ============================================================================
// TOKEN SPIKE DETECTION
// ============================================================================

export const detectTokenSpikes = (
  nodes: Node<TraceNodeData>[],
  config: DetectionConfig = {}
): Anomaly[] => {
  const { tokenSpikeMultiplier = 3 } = config;
  const anomalies: Anomaly[] = [];

  const nodesWithTokens = nodes.filter((n) => n.data.tokens);
  if (nodesWithTokens.length === 0) return anomalies;

  // Calculate average tokens
  const avgTokens =
    nodesWithTokens.reduce(
      (sum, n) => sum + (n.data.tokens!.input + n.data.tokens!.output),
      0
    ) / nodesWithTokens.length;

  nodesWithTokens.forEach((node) => {
    const totalTokens = node.data.tokens!.input + node.data.tokens!.output;

    if (totalTokens > avgTokens * tokenSpikeMultiplier) {
      const multiple = (totalTokens / avgTokens).toFixed(1);

      anomalies.push({
        id: `token_spike_${node.id}`,
        nodeId: node.id,
        type: "token-spike",
        severity: totalTokens > avgTokens * 5 ? "high" : "medium",
        message: `${node.data.label}: Token usage ${multiple}x higher than average`,
        suggestion: `High token count detected. Consider: 1) Reducing max_tokens, 2) Summarizing context, 3) Using prompt compression, 4) Splitting into smaller operations.`,
        metadata: {
          tokens: totalTokens,
          avgTokens: Math.round(avgTokens),
          multiple: parseFloat(multiple),
          inputTokens: node.data.tokens!.input,
          outputTokens: node.data.tokens!.output
        }
      });
    }
  });

  return anomalies;
};

// ============================================================================
// SLOW OPERATION DETECTION
// ============================================================================

export const detectSlowOperations = (
  nodes: Node<TraceNodeData>[],
  config: DetectionConfig = {}
): Anomaly[] => {
  const { latencySpikeMultiplier = 3 } = config;
  const anomalies: Anomaly[] = [];

  const avgLatency =
    nodes.reduce((sum, n) => sum + n.data.latency, 0) / nodes.length;

  nodes.forEach((node) => {
    if (node.data.latency > avgLatency * latencySpikeMultiplier) {
      const multiple = (node.data.latency / avgLatency).toFixed(1);

      anomalies.push({
        id: `slow_${node.id}`,
        nodeId: node.id,
        type: "slow-operation",
        severity: node.data.latency > avgLatency * 5 ? "high" : "medium",
        message: `${
          node.data.label
        }: Latency ${multiple}x higher than average (${(
          avgLatency / 1000
        ).toFixed(2)}s)`,
        suggestion: `Operation is unusually slow. Consider: 1) Adding timeout limits, 2) Implementing retries with shorter timeouts, 3) Caching results, 4) Using async/parallel execution.`,
        metadata: {
          latency: node.data.latency,
          avgLatency,
          multiple: parseFloat(multiple)
        }
      });
    }
  });

  return anomalies;
};

// ============================================================================
// TIMEOUT RISK PREDICTION
// ============================================================================

export const predictTimeoutRisk = (
  nodes: Node<TraceNodeData>[],
  maxBudget: { time?: number; cost?: number }
): Anomaly[] => {
  const anomalies: Anomaly[] = [];

  const completedNodes = nodes.filter((n) => n.data.status === "complete");
  const runningNodes = nodes.filter((n) => n.data.status === "running");
  const pendingNodes = nodes.filter((n) => n.data.status === "pending");

  if (runningNodes.length === 0 && pendingNodes.length === 0) return anomalies;

  // Calculate current stats
  const totalTime = completedNodes.reduce((sum, n) => sum + n.data.latency, 0);
  const totalCost = completedNodes.reduce((sum, n) => sum + n.data.cost, 0);
  const avgTimePerNode = totalTime / completedNodes.length;
  const avgCostPerNode = totalCost / completedNodes.length;

  // Project remaining
  const remainingNodes = runningNodes.length + pendingNodes.length;
  const projectedTime = totalTime + remainingNodes * avgTimePerNode;
  const projectedCost = totalCost + remainingNodes * avgCostPerNode;

  // Check time budget
  if (maxBudget.time && projectedTime > maxBudget.time) {
    anomalies.push({
      id: "timeout_risk",
      nodeId: "system",
      type: "timeout-risk",
      severity: "high",
      message: `Projected to exceed time budget: ${(
        projectedTime / 1000
      ).toFixed(1)}s / ${(maxBudget.time / 1000).toFixed(1)}s`,
      suggestion: `Consider: 1) Terminating early, 2) Skipping non-critical operations, 3) Implementing early stopping conditions.`,
      metadata: {
        currentTime: totalTime,
        projectedTime,
        budget: maxBudget.time,
        remainingNodes
      }
    });
  }

  // Check cost budget
  if (maxBudget.cost && projectedCost > maxBudget.cost) {
    anomalies.push({
      id: "cost_budget_risk",
      nodeId: "system",
      type: "timeout-risk",
      severity: "high",
      message: `Projected to exceed cost budget: $${projectedCost.toFixed(
        2
      )} / $${maxBudget.cost.toFixed(2)}`,
      suggestion: `Consider: 1) Using cheaper models, 2) Reducing token limits, 3) Caching more aggressively, 4) Terminating early.`,
      cost: projectedCost - maxBudget.cost,
      metadata: {
        currentCost: totalCost,
        projectedCost,
        budget: maxBudget.cost,
        remainingNodes
      }
    });
  }

  return anomalies;
};

// ============================================================================
// CONTRADICTION DETECTION
// ============================================================================

export const detectContradictions = (
  nodes: Node<TraceNodeData>[]
): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  const decisions = nodes.filter(
    (n) => n.data.type === "decision" || n.data.type === "llm"
  );

  // Simple contradiction detection based on response content
  // In production, use semantic similarity or LLM-based analysis
  const keywords = {
    positive: ["yes", "accept", "approve", "recommend", "good", "best"],
    negative: ["no", "reject", "deny", "not recommend", "bad", "worst"]
  };

  for (let i = 0; i < decisions.length - 1; i++) {
    const node1 = decisions[i];
    const node2 = decisions[i + 1];

    const text1 = (node1.data.response || "").toLowerCase();
    const text2 = (node2.data.response || "").toLowerCase();

    const node1Positive = keywords.positive.some((k) => text1.includes(k));
    const node1Negative = keywords.negative.some((k) => text1.includes(k));
    const node2Positive = keywords.positive.some((k) => text2.includes(k));
    const node2Negative = keywords.negative.some((k) => text2.includes(k));

    // Check for contradictions
    if ((node1Positive && node2Negative) || (node1Negative && node2Positive)) {
      anomalies.push({
        id: `contradiction_${node1.id}_${node2.id}`,
        nodeId: node1.id,
        type: "contradiction",
        severity: "medium",
        message: `Potential contradiction between "${node1.data.label}" and "${node2.data.label}"`,
        suggestion: `Review decision logic. Decisions may be conflicting. Consider: 1) Adding consistency checks, 2) Maintaining decision history, 3) Implementing validation rules.`,
        metadata: {
          node1: { id: node1.id, label: node1.data.label },
          node2: { id: node2.id, label: node2.data.label }
        }
      });
    }
  }

  return anomalies;
};

// ============================================================================
// COMPREHENSIVE ANOMALY DETECTION
// ============================================================================

export const detectAllAnomalies = (
  nodes: Node<TraceNodeData>[],
  options: {
    config?: DetectionConfig;
    historicalAvg?: number;
    budgets?: { time?: number; cost?: number };
  } = {}
): Anomaly[] => {
  const { config = {}, historicalAvg, budgets } = options;

  const anomalies: Anomaly[] = [
    ...detectLoops(nodes, config),
    ...detectCostSpikes(nodes, historicalAvg, config),
    ...detectTokenSpikes(nodes, config),
    ...detectSlowOperations(nodes, config),
    ...detectContradictions(nodes)
  ];

  if (budgets) {
    anomalies.push(...predictTimeoutRisk(nodes, budgets));
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  anomalies.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return anomalies;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function fuzzyGroupByParams(
  nodes: Node<TraceNodeData>[],
  threshold: number
): Map<string, Node<TraceNodeData>[]> {
  const groups = new Map<string, Node<TraceNodeData>[]>();

  nodes.forEach((node) => {
    const params = node.data.toolParams || {};
    const signature = createFuzzySignature(params);

    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature)!.push(node);
  });

  return groups;
}

function createFuzzySignature(params: Record<string, any>): string {
  // Create a signature that ignores minor variations
  const normalized: Record<string, any> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") {
      // Normalize strings
      normalized[key] = value.toLowerCase().trim();
    } else if (typeof value === "number") {
      // Round numbers to reduce sensitivity
      normalized[key] = Math.round(value * 100) / 100;
    } else {
      normalized[key] = value;
    }
  });

  return JSON.stringify(normalized);
}

// Calculate similarity between two parameter sets
export function calculateParameterSimilarity(
  params1: Record<string, any>,
  params2: Record<string, any>
): number {
  const keys = new Set([...Object.keys(params1), ...Object.keys(params2)]);
  let matches = 0;

  keys.forEach((key) => {
    if (params1[key] === params2[key]) {
      matches++;
    } else if (
      typeof params1[key] === "string" &&
      typeof params2[key] === "string"
    ) {
      // Use Levenshtein distance for strings
      const similarity = stringSimilarity(params1[key], params2[key]);
      if (similarity > 0.8) matches += similarity;
    }
  });

  return matches / keys.size;
}

function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export default {
  detectLoops,
  detectCostSpikes,
  detectTokenSpikes,
  detectSlowOperations,
  predictTimeoutRisk,
  detectContradictions,
  detectAllAnomalies,
  calculateParameterSimilarity
};
