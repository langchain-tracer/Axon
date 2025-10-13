import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

// ============================================================================
// LAYOUT TYPES
// ============================================================================

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

// ============================================================================
// DAGRE LAYOUT (Hierarchical)
// ============================================================================

export const getDagreLayout = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
) => {
  const {
    direction = 'TB',
    nodeWidth = 100,
    nodeHeight = 100,
    rankSep = 150,
    nodeSep = 100,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
  });

  // Add nodes to dagre
  nodes.forEach((node) => {
    // Calculate actual node size based on cost if available
    const size = node.data?.cost 
      ? Math.max(60, Math.min(120, 60 + node.data.cost * 50))
      : nodeWidth;
    
    dagreGraph.setNode(node.id, { width: size, height: size });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Map back to ReactFlow nodes
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    };
  });
};

// ============================================================================
// TIMELINE LAYOUT (Chronological)
// ============================================================================

export const getTimelineLayout = (nodes: Node[]) => {
  // Sort by timestamp
  const sorted = [...nodes].sort((a, b) => 
    (a.data?.timestamp || 0) - (b.data?.timestamp || 0)
  );

  // Calculate positions
  return sorted.map((node, index) => ({
    ...node,
    position: {
      x: index * 250, // Horizontal spacing
      y: 100,        // Same y-level for timeline
    },
  }));
};

// ============================================================================
// VERTICAL TIMELINE LAYOUT
// ============================================================================

export const getVerticalTimelineLayout = (nodes: Node[]) => {
  const sorted = [...nodes].sort((a, b) => 
    (a.data?.timestamp || 0) - (b.data?.timestamp || 0)
  );

  return sorted.map((node, index) => ({
    ...node,
    position: {
      x: 200,        // Same x-position
      y: index * 150, // Vertical spacing
    },
  }));
};

// ============================================================================
// COST-BASED LAYOUT (Group by expense)
// ============================================================================

export const getCostLayout = (nodes: Node[]) => {
  // Sort by cost (highest first)
  const sorted = [...nodes].sort((a, b) => 
    (b.data?.cost || 0) - (a.data?.cost || 0)
  );

  const nodesPerRow = 5;

  return sorted.map((node, index) => ({
    ...node,
    position: {
      x: (index % nodesPerRow) * 250,
      y: Math.floor(index / nodesPerRow) * 200,
    },
  }));
};

// ============================================================================
// TYPE-GROUPED LAYOUT (Group by node type)
// ============================================================================

export const getTypeGroupedLayout = (nodes: Node[]) => {
  const groups: Record<string, Node[]> = {};
  
  // Group nodes by type
  nodes.forEach(node => {
    const type = node.data?.type || 'unknown';
    if (!groups[type]) groups[type] = [];
    groups[type].push(node);
  });

  const typeOrder = ['llm', 'tool', 'decision'];
  let layoutedNodes: Node[] = [];
  let yOffset = 0;

  // Layout each group
  typeOrder.forEach(type => {
    if (!groups[type]) return;
    
    const groupNodes = groups[type].map((node, index) => ({
      ...node,
      position: {
        x: (index % 4) * 200,
        y: yOffset + Math.floor(index / 4) * 150,
      },
    }));

    layoutedNodes = [...layoutedNodes, ...groupNodes];
    yOffset += Math.ceil(groups[type].length / 4) * 150 + 100; // Add gap between groups
  });

  return layoutedNodes;
};

// ============================================================================
// DEPENDENCY GRAPH LAYOUT (Emphasize causality)
// ============================================================================

export const getDependencyLayout = (
  nodes: Node[],
  edges: Edge[]
) => {
  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  });

  // Find root nodes (no incoming edges)
  const hasIncoming = new Set(edges.map(e => e.target));
  const roots = nodes.filter(n => !hasIncoming.has(n.id));

  // BFS to assign levels
  const levels = new Map<string, number>();
  const queue: Array<{ id: string; level: number }> = roots.map(n => ({ id: n.id, level: 0 }));
  
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (levels.has(id)) continue;
    
    levels.set(id, level);
    const children = adjacency.get(id) || [];
    children.forEach(childId => queue.push({ id: childId, level: level + 1 }));
  }

  // Count nodes per level
  const nodesPerLevel = new Map<number, number>();
  levels.forEach(level => {
    nodesPerLevel.set(level, (nodesPerLevel.get(level) || 0) + 1);
  });

  // Track position within each level
  const levelCounters = new Map<number, number>();

  // Position nodes
  return nodes.map(node => {
    const level = levels.get(node.id) || 0;
    const nodesInLevel = nodesPerLevel.get(level) || 1;
    const position = levelCounters.get(level) || 0;
    levelCounters.set(level, position + 1);

    // Center nodes within level
    const totalWidth = nodesInLevel * 200;
    const startX = -totalWidth / 2;
    
    return {
      ...node,
      position: {
        x: startX + position * 200 + 100,
        y: level * 200,
      },
    };
  });
};

// ============================================================================
// CIRCULAR LAYOUT
// ============================================================================

export const getCircularLayout = (nodes: Node[]) => {
  const centerX = 400;
  const centerY = 300;
  const radius = 250;

  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    
    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
    };
  });
};

// ============================================================================
// FORCE-DIRECTED LAYOUT (D3-style)
// ============================================================================

export const getForceLayout = (
  nodes: Node[],
  edges: Edge[],
  iterations = 100
) => {
  // Simple force-directed layout simulation
  const positions = new Map<string, { x: number; y: number }>();
  
  // Initialize with random positions
  nodes.forEach(node => {
    positions.set(node.id, {
      x: Math.random() * 800,
      y: Math.random() * 600,
    });
  });

  // Build adjacency
  const adjacency = new Map<string, Set<string>>();
  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  });

  // Simulate
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    
    // Initialize forces
    nodes.forEach(node => forces.set(node.id, { x: 0, y: 0 }));

    // Repulsive force between all nodes
    nodes.forEach((node1, i) => {
      const pos1 = positions.get(node1.id)!;
      
      nodes.slice(i + 1).forEach(node2 => {
        const pos2 = positions.get(node2.id)!;
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 5000 / (distance * distance);
        
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        const f1 = forces.get(node1.id)!;
        const f2 = forces.get(node2.id)!;
        f1.x -= fx;
        f1.y -= fy;
        f2.x += fx;
        f2.y += fy;
      });
    });

    // Attractive force along edges
    edges.forEach(edge => {
      const pos1 = positions.get(edge.source)!;
      const pos2 = positions.get(edge.target)!;
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = distance * 0.01;
      
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      
      const f1 = forces.get(edge.source)!;
      const f2 = forces.get(edge.target)!;
      f1.x += fx;
      f1.y += fy;
      f2.x -= fx;
      f2.y -= fy;
    });

    // Apply forces
    nodes.forEach(node => {
      const pos = positions.get(node.id)!;
      const force = forces.get(node.id)!;
      pos.x += force.x;
      pos.y += force.y;
    });
  }

  // Map to ReactFlow nodes
  return nodes.map(node => ({
    ...node,
    position: positions.get(node.id)!,
  }));
};

// ============================================================================
// LAYOUT MANAGER
// ============================================================================

export type LayoutType = 
  | 'dagre'
  | 'timeline'
  | 'vertical-timeline'
  | 'cost'
  | 'type-grouped'
  | 'dependency'
  | 'circular'
  | 'force';

export const applyLayout = (
  type: LayoutType,
  nodes: Node[],
  edges: Edge[],
  options?: LayoutOptions
): Node[] => {
  switch (type) {
    case 'dagre':
      return getDagreLayout(nodes, edges, options);
    case 'timeline':
      return getTimelineLayout(nodes);
    case 'vertical-timeline':
      return getVerticalTimelineLayout(nodes);
    case 'cost':
      return getCostLayout(nodes);
    case 'type-grouped':
      return getTypeGroupedLayout(nodes);
    case 'dependency':
      return getDependencyLayout(nodes, edges);
    case 'circular':
      return getCircularLayout(nodes);
    case 'force':
      return getForceLayout(nodes, edges);
    default:
      return nodes;
  }
};

export default {
  getDagreLayout,
  getTimelineLayout,
  getVerticalTimelineLayout,
  getCostLayout,
  getTypeGroupedLayout,
  getDependencyLayout,
  getCircularLayout,
  getForceLayout,
  applyLayout,
};