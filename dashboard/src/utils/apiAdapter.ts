// utils/apiAdapter.ts

interface BackendTrace {
  id: string;
  projectName: string;
  startTime: number;
  endTime?: number;
  totalCost?: number;
  totalNodes?: number;
  status?: string;
  metadata?: any;
}

interface FrontendTrace {
  id: string;
  project: string;
  status: string;
  timestamp: number;
  nodeCount: number;
  cost: number;
  latency: number;
  description: string;
  events: any[];
}

export function transformTrace(backendTrace: BackendTrace): FrontendTrace {
  // Calculate latency
  const latency = backendTrace.endTime
    ? backendTrace.endTime - backendTrace.startTime
    : Date.now() - backendTrace.startTime;

  // Generate description
  const description = generateDescription(backendTrace);

  return {
    id: backendTrace.id,
    project: backendTrace.projectName || "default",
    status: backendTrace.status || "running",
    timestamp: backendTrace.startTime,
    nodeCount: backendTrace.totalNodes || 0,
    cost: backendTrace.totalCost || 0,
    latency: latency,
    description: description,
    events: [] // Will be populated from nodes
  };
}

function generateDescription(trace: BackendTrace): string {
  const status = trace.status || "running";
  const nodeCount = trace.totalNodes || 0;

  if (status === "complete") {
    return `Completed with ${nodeCount} steps`;
  } else if (status === "error") {
    return `Failed at step ${nodeCount}`;
  } else {
    return `Processing (${nodeCount} steps so far)`;
  }
}

export function transformNode(backendNode: any, index: number): any {
  // Generate label based on node type
  const label = generateNodeLabel(backendNode, index);

  // Calculate position (simple layout)
  const x = 200 + (index % 3) * 250;
  const y = 100 + Math.floor(index / 3) * 200;

  return {
    id: backendNode.runId,
    label: label,
    type: backendNode.type,
    cost: backendNode.cost || 0,
    tokens: backendNode.tokens
      ? {
          input: backendNode.tokens.input,
          output: backendNode.tokens.output
        }
      : undefined,
    latency: backendNode.latency || 0,
    status: backendNode.status,
    timestamp: backendNode.startTime,
    x: x,
    y: y,
    prompt: backendNode.data?.prompts?.[0],
    response: backendNode.data?.response,
    toolName: backendNode.data?.toolName,
    toolParams: backendNode.data?.input
  };
}

function generateNodeLabel(node: any, index: number): string {
  if (node.type === "llm") {
    return node.data?.model || `LLM Call ${index + 1}`;
  } else if (node.type === "tool") {
    return node.data?.toolName || `Tool Call ${index + 1}`;
  } else if (node.type === "chain") {
    return node.data?.chainName || `Chain ${index + 1}`;
  }
  return `Step ${index + 1}`;
}
