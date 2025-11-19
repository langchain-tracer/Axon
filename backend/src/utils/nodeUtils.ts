/**
 * Shared utility functions for node processing
 */

/**
 * Generate human-readable label for a node
 */
export function generateNodeLabel(node: any, index: number): string {
  const stepNumber = index + 1;
  
  switch (node.type) {
    case "llm_start":
      return "LLM Processing";
    case "llm_end":
      return "LLM Response";
    case "tool_start":
      if (node.toolName) {
        return `${node.toolName} Call`;
      }
      return "Tool Execution";
    case "tool_end":
      if (node.toolName) {
        return `${node.toolName} Result`;
      }
      return "Tool Complete";
    case "chain_start":
      return "Process Start";
    case "chain_end":
      return "Process Complete";
    case "llm":
      return node.metadata?.model || node.data?.model || `LLM Call ${stepNumber}`;
    case "tool":
      return node.toolName || node.data?.toolName || `Tool Call ${stepNumber}`;
    case "chain":
      return node.metadata?.chainName || node.data?.chainName || `Chain ${stepNumber}`;
    default:
      return `Step ${stepNumber}`;
  }
}

/**
 * Calculate cost for a node based on tokens and model
 */
export function calculateCost(node: any): number {
  if (node.cost) return node.cost;
  
  // Use tokens if available
  const tokens = node.tokens || node.data?.tokens;
  if (tokens) {
    const inputCostPer1k = 0.0015;
    const outputCostPer1k = 0.002;
    const inputCost = (tokens.input || 0) / 1000 * inputCostPer1k;
    const outputCost = (tokens.output || 0) / 1000 * outputCostPer1k;
    return inputCost + outputCost;
  }
  
  // Estimate from content if no token data
  return estimateCostFromContent(node);
}

/**
 * Estimate cost from content length (fallback)
 */
function estimateCostFromContent(node: any): number {
  let inputTokens = 0;
  let outputTokens = 0;
  
  if (node.prompt) inputTokens = Math.ceil(node.prompt.length / 4);
  if (node.response) outputTokens = Math.ceil(node.response.length / 4);
  if (node.toolInput) inputTokens += Math.ceil(node.toolInput.length / 4);
  if (node.toolOutput) outputTokens += Math.ceil(node.toolOutput.length / 4);
  
  if (inputTokens === 0 && outputTokens === 0) return 0;
  
  const inputCostPer1k = 0.0015;
  const outputCostPer1k = 0.002;
  const inputCost = inputTokens / 1000 * inputCostPer1k;
  const outputCost = outputTokens / 1000 * outputCostPer1k;
  
  return inputCost + outputCost;
}

/**
 * Calculate node position for graph layout
 */
export function calculateNodePosition(index: number): { x: number; y: number } {
  const nodesPerRow = 3;
  const xSpacing = 250;
  const ySpacing = 200;
  const startX = 200;
  const startY = 100;
  
  const row = Math.floor(index / nodesPerRow);
  const col = index % nodesPerRow;
  
  return {
    x: startX + col * xSpacing,
    y: startY + row * ySpacing
  };
}

