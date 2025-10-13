import { Node, Edge } from "reactflow";
import { toPng, toJpeg, toSvg } from "html-to-image";

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

interface ExportOptions {
  includeMetadata?: boolean;
  format?: "json" | "csv";
  pretty?: boolean;
}

/**
 * Export trace data as JSON
 */
export const exportToJSON = (
  nodes: Node[],
  edges: Edge[],
  options: ExportOptions = {}
): string => {
  const { includeMetadata = true, pretty = true } = options;

  const data: any = {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data?.type,
      label: n.data?.label,
      cost: n.data?.cost,
      latency: n.data?.latency,
      tokens: n.data?.tokens,
      status: n.data?.status,
      timestamp: n.data?.timestamp,
      ...(n.data?.prompt && { prompt: n.data.prompt }),
      ...(n.data?.response && { response: n.data.response }),
      ...(n.data?.toolParams && { toolParams: n.data.toolParams }),
      ...(n.data?.toolResult && { toolResult: n.data.toolResult })
    })),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target
    }))
  };

  if (includeMetadata) {
    data.metadata = {
      totalCost: nodes.reduce((sum, n) => sum + (n.data?.cost || 0), 0),
      totalNodes: nodes.length,
      totalEdges: edges.length,
      exportedAt: new Date().toISOString(),
      duration:
        Math.max(...nodes.map((n) => n.data?.timestamp || 0)) -
        Math.min(...nodes.map((n) => n.data?.timestamp || 0))
    };
  }

  return JSON.stringify(data, null, pretty ? 2 : 0);
};

/**
 * Export trace data as CSV
 */
export const exportToCSV = (nodes: Node[]): string => {
  const headers = [
    "ID",
    "Type",
    "Label",
    "Cost",
    "Latency (ms)",
    "Input Tokens",
    "Output Tokens",
    "Status",
    "Timestamp"
  ];

  const rows = nodes.map((n) => [
    n.id,
    n.data?.type || "",
    n.data?.label || "",
    n.data?.cost || 0,
    n.data?.latency || 0,
    n.data?.tokens?.input || 0,
    n.data?.tokens?.output || 0,
    n.data?.status || "",
    n.data?.timestamp || 0
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
};

/**
 * Download data as file
 */
export const downloadFile = (
  content: string,
  filename: string,
  mimeType: string = "application/json"
) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export graph as image
 */
export const exportGraphAsImage = async (
  format: "png" | "jpeg" | "svg" = "png",
  filename?: string
): Promise<void> => {
  const element = document.querySelector(".react-flow") as HTMLElement;
  if (!element) throw new Error("ReactFlow element not found");

  let dataUrl: string;
  switch (format) {
    case "png":
      dataUrl = await toPng(element, { quality: 1.0 });
      break;
    case "jpeg":
      dataUrl = await toJpeg(element, { quality: 0.95 });
      break;
    case "svg":
      dataUrl = await toSvg(element);
      break;
  }

  const link = document.createElement("a");
  link.download = filename || `trace-${Date.now()}.${format}`;
  link.href = dataUrl;
  link.click();
};

// ============================================================================
// SEARCH & FILTER FUNCTIONS
// ============================================================================

interface SearchOptions {
  caseSensitive?: boolean;
  searchInPrompts?: boolean;
  searchInResponses?: boolean;
  searchInParams?: boolean;
}

/**
 * Search nodes by text
 */
export const searchNodes = (
  nodes: Node[],
  query: string,
  options: SearchOptions = {}
): Node[] => {
  const {
    caseSensitive = false,
    searchInPrompts = true,
    searchInResponses = true,
    searchInParams = true
  } = options;

  const normalizedQuery = caseSensitive ? query : query.toLowerCase();

  return nodes.filter((node) => {
    const label = caseSensitive
      ? node.data?.label
      : node.data?.label?.toLowerCase();
    if (label?.includes(normalizedQuery)) return true;

    if (searchInPrompts && node.data?.prompt) {
      const prompt = caseSensitive
        ? node.data.prompt
        : node.data.prompt.toLowerCase();
      if (prompt.includes(normalizedQuery)) return true;
    }

    if (searchInResponses && node.data?.response) {
      const response = caseSensitive
        ? node.data.response
        : node.data.response.toLowerCase();
      if (response.includes(normalizedQuery)) return true;
    }

    if (searchInParams && node.data?.toolParams) {
      const paramsStr = caseSensitive
        ? JSON.stringify(node.data.toolParams)
        : JSON.stringify(node.data.toolParams).toLowerCase();
      if (paramsStr.includes(normalizedQuery)) return true;
    }

    return false;
  });
};

/**
 * Filter nodes by criteria
 */
export interface FilterCriteria {
  types?: string[];
  minCost?: number;
  maxCost?: number;
  minLatency?: number;
  maxLatency?: number;
  statuses?: string[];
  dateRange?: { start: number; end: number };
  hasAnomaly?: boolean;
}

export const filterNodes = (
  nodes: Node[],
  criteria: FilterCriteria
): Node[] => {
  return nodes.filter((node) => {
    if (criteria.types && !criteria.types.includes(node.data?.type)) {
      return false;
    }

    if (
      criteria.minCost !== undefined &&
      (node.data?.cost || 0) < criteria.minCost
    ) {
      return false;
    }

    if (
      criteria.maxCost !== undefined &&
      (node.data?.cost || 0) > criteria.maxCost
    ) {
      return false;
    }

    if (
      criteria.minLatency !== undefined &&
      (node.data?.latency || 0) < criteria.minLatency
    ) {
      return false;
    }

    if (
      criteria.maxLatency !== undefined &&
      (node.data?.latency || 0) > criteria.maxLatency
    ) {
      return false;
    }

    if (criteria.statuses && !criteria.statuses.includes(node.data?.status)) {
      return false;
    }

    if (criteria.dateRange) {
      const timestamp = node.data?.timestamp || 0;
      if (
        timestamp < criteria.dateRange.start ||
        timestamp > criteria.dateRange.end
      ) {
        return false;
      }
    }

    if (
      criteria.hasAnomaly !== undefined &&
      node.data?.hasAnomaly !== criteria.hasAnomaly
    ) {
      return false;
    }

    return true;
  });
};

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

export interface TraceStatistics {
  totalCost: number;
  totalTokens: number;
  totalLatency: number;
  avgCost: number;
  avgLatency: number;
  avgTokensPerNode: number;
  nodeCount: number;
  llmCount: number;
  toolCount: number;
  decisionCount: number;
  errorCount: number;
  costByType: Record<string, number>;
  latencyByType: Record<string, number>;
  tokensByType: Record<string, number>;
  mostExpensiveNode: { id: string; label: string; cost: number } | null;
  slowestNode: { id: string; label: string; latency: number } | null;
}

export const calculateStatistics = (nodes: Node[]): TraceStatistics => {
  const stats: TraceStatistics = {
    totalCost: 0,
    totalTokens: 0,
    totalLatency: 0,
    avgCost: 0,
    avgLatency: 0,
    avgTokensPerNode: 0,
    nodeCount: nodes.length,
    llmCount: 0,
    toolCount: 0,
    decisionCount: 0,
    errorCount: 0,
    costByType: {},
    latencyByType: {},
    tokensByType: {},
    mostExpensiveNode: null,
    slowestNode: null
  };

  let maxCost = 0;
  let maxLatency = 0;

  nodes.forEach((node) => {
    const cost = node.data?.cost || 0;
    const latency = node.data?.latency || 0;
    const tokens =
      (node.data?.tokens?.input || 0) + (node.data?.tokens?.output || 0);
    const type = node.data?.type || "unknown";

    // Totals
    stats.totalCost += cost;
    stats.totalLatency += latency;
    stats.totalTokens += tokens;

    // By type
    if (!stats.costByType[type]) stats.costByType[type] = 0;
    if (!stats.latencyByType[type]) stats.latencyByType[type] = 0;
    if (!stats.tokensByType[type]) stats.tokensByType[type] = 0;

    stats.costByType[type] += cost;
    stats.latencyByType[type] += latency;
    stats.tokensByType[type] += tokens;

    // Counts
    if (type === "llm") stats.llmCount++;
    if (type === "tool") stats.toolCount++;
    if (type === "decision") stats.decisionCount++;
    if (node.data?.status === "error") stats.errorCount++;

    // Max tracking
    if (cost > maxCost) {
      maxCost = cost;
      stats.mostExpensiveNode = {
        id: node.id,
        label: node.data?.label || "Unknown",
        cost
      };
    }

    if (latency > maxLatency) {
      maxLatency = latency;
      stats.slowestNode = {
        id: node.id,
        label: node.data?.label || "Unknown",
        latency
      };
    }
  });

  // Averages
  if (nodes.length > 0) {
    stats.avgCost = stats.totalCost / nodes.length;
    stats.avgLatency = stats.totalLatency / nodes.length;
    stats.avgTokensPerNode = stats.totalTokens / nodes.length;
  }

  return stats;
};

// ============================================================================
// PATH FINDING
// ============================================================================

/**
 * Find path between two nodes
 */
export const findPath = (
  edges: Edge[],
  startNodeId: string,
  endNodeId: string
): string[] | null => {
  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  });

  // BFS
  const queue: Array<{ id: string; path: string[] }> = [
    { id: startNodeId, path: [startNodeId] }
  ];
  const visited = new Set<string>([startNodeId]);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    if (id === endNodeId) {
      return path;
    }

    const neighbors = adjacency.get(id) || [];
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, path: [...path, neighbor] });
      }
    });
  }

  return null;
};

/**
 * Find all paths from start to end
 */
export const findAllPaths = (
  edges: Edge[],
  startNodeId: string,
  endNodeId: string,
  maxPaths: number = 10
): string[][] => {
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  });

  const paths: string[][] = [];
  const visited = new Set<string>();

  const dfs = (nodeId: string, path: string[]) => {
    if (paths.length >= maxPaths) return;
    if (nodeId === endNodeId) {
      paths.push([...path]);
      return;
    }

    visited.add(nodeId);
    const neighbors = adjacency.get(nodeId) || [];

    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      }
    });

    visited.delete(nodeId);
  };

  dfs(startNodeId, [startNodeId]);
  return paths;
};

/**
 * Find critical path (longest path by latency)
 */
export const findCriticalPath = (
  nodes: Node[],
  edges: Edge[]
): { path: string[]; totalLatency: number } | null => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Build graph
  nodes.forEach((n) => {
    adjacency.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  edges.forEach((edge) => {
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Find start nodes (no incoming edges)
  const startNodes = Array.from(inDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([id, _]) => id);

  if (startNodes.length === 0) return null;

  // Calculate longest path using topological sort
  const distances = new Map<string, number>();
  const predecessors = new Map<string, string>();
  const queue = [...startNodes];

  startNodes.forEach((id) =>
    distances.set(id, nodeMap.get(id)?.data?.latency || 0)
  );

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const nodeLatency = nodeMap.get(nodeId)?.data?.latency || 0;
    const currentDist = distances.get(nodeId) || 0;

    const neighbors = adjacency.get(nodeId) || [];
    neighbors.forEach((neighbor) => {
      const neighborLatency = nodeMap.get(neighbor)?.data?.latency || 0;
      const newDist = currentDist + neighborLatency;

      if (!distances.has(neighbor) || newDist > distances.get(neighbor)!) {
        distances.set(neighbor, newDist);
        predecessors.set(neighbor, nodeId);
      }

      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Find node with maximum distance
  let maxDist = 0;
  let endNode = startNodes[0];

  distances.forEach((dist, nodeId) => {
    if (dist > maxDist) {
      maxDist = dist;
      endNode = nodeId;
    }
  });

  // Reconstruct path
  const path: string[] = [endNode];
  let current = endNode;

  while (predecessors.has(current)) {
    current = predecessors.get(current)!;
    path.unshift(current);
  }

  return { path, totalLatency: maxDist };
};

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Compare two traces
 */
export interface TraceComparison {
  costDiff: number;
  costDiffPercent: number;
  latencyDiff: number;
  latencyDiffPercent: number;
  nodeCountDiff: number;
  addedNodes: string[];
  removedNodes: string[];
  modifiedNodes: string[];
}

export const compareTraces = (
  trace1: Node[],
  trace2: Node[]
): TraceComparison => {
  const stats1 = calculateStatistics(trace1);
  const stats2 = calculateStatistics(trace2);

  const ids1 = new Set(trace1.map((n) => n.id));
  const ids2 = new Set(trace2.map((n) => n.id));

  const addedNodes = trace2.filter((n) => !ids1.has(n.id)).map((n) => n.id);
  const removedNodes = trace1.filter((n) => !ids2.has(n.id)).map((n) => n.id);
  const modifiedNodes: string[] = [];

  // Check for modified nodes
  trace1.forEach((n1) => {
    const n2 = trace2.find((n) => n.id === n1.id);
    if (
      n2 &&
      (n1.data?.cost !== n2.data?.cost || n1.data?.latency !== n2.data?.latency)
    ) {
      modifiedNodes.push(n1.id);
    }
  });

  return {
    costDiff: stats2.totalCost - stats1.totalCost,
    costDiffPercent:
      ((stats2.totalCost - stats1.totalCost) / stats1.totalCost) * 100,
    latencyDiff: stats2.totalLatency - stats1.totalLatency,
    latencyDiffPercent:
      ((stats2.totalLatency - stats1.totalLatency) / stats1.totalLatency) * 100,
    nodeCountDiff: trace2.length - trace1.length,
    addedNodes,
    removedNodes,
    modifiedNodes
  };
};

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

export const setupKeyboardShortcuts = (handlers: {
  onSearch?: () => void;
  onExport?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onToggleFilters?: () => void;
}) => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ctrl/Cmd + F: Search
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      handlers.onSearch?.();
    }

    // Ctrl/Cmd + E: Export
    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
      e.preventDefault();
      handlers.onExport?.();
    }

    // Ctrl/Cmd + +: Zoom in
    if ((e.ctrlKey || e.metaKey) && e.key === "=") {
      e.preventDefault();
      handlers.onZoomIn?.();
    }

    // Ctrl/Cmd + -: Zoom out
    if ((e.ctrlKey || e.metaKey) && e.key === "-") {
      e.preventDefault();
      handlers.onZoomOut?.();
    }

    // Ctrl/Cmd + 0: Fit view
    if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      handlers.onFitView?.();
    }

    // Ctrl/Cmd + K: Toggle filters
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      handlers.onToggleFilters?.();
    }
  };

  document.addEventListener("keydown", handleKeyPress);

  return () => document.removeEventListener("keydown", handleKeyPress);
};

export default {
  exportToJSON,
  exportToCSV,
  downloadFile,
  exportGraphAsImage,
  searchNodes,
  filterNodes,
  calculateStatistics,
  findPath,
  findAllPaths,
  findCriticalPath,
  compareTraces,
  setupKeyboardShortcuts
};
