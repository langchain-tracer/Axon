// Pure span-tree builder. Consumed by Transcript, SpanTree and Waterfall.
// No React, no DOM — unit-testable in isolation.

export interface TreeNode<T> {
  node: T;
  children: TreeNode<T>[];
  depth: number;
}

interface HasId {
  id: string;
  startTime: number;
}

interface ParentEdge {
  source: string; // parent node id
  target: string; // child node id
}

/**
 * Build a forest from a flat node list + parent→child edges.
 *
 * - Roots are nodes with no incoming edge (no parent in the set).
 * - Children are sorted by startTime.
 * - Cycles and dangling edges are handled safely (a node is attached at most
 *   once; a visited-set prevents infinite recursion).
 *
 * O(n + e).
 */
export function buildTree<T extends HasId>(nodes: T[], edges: ParentEdge[]): TreeNode<T>[] {
  const byId = new Map<string, T>();
  for (const n of nodes) byId.set(n.id, n);

  const childIds = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue; // drop dangling
    if (hasParent.has(e.target)) continue; // keep first parent only
    hasParent.add(e.target);
    const list = childIds.get(e.source);
    if (list) list.push(e.target);
    else childIds.set(e.source, [e.target]);
  }

  const visited = new Set<string>();

  const build = (id: string, depth: number): TreeNode<T> | null => {
    if (visited.has(id)) return null; // cycle guard
    visited.add(id);
    const node = byId.get(id)!;
    const children = (childIds.get(id) ?? [])
      .map((cid) => build(cid, depth + 1))
      .filter((c): c is TreeNode<T> => c !== null)
      .sort((a, b) => a.node.startTime - b.node.startTime);
    return { node, children, depth };
  };

  const sorted = [...nodes].sort((a, b) => a.startTime - b.startTime);

  const roots: TreeNode<T>[] = [];
  for (const n of sorted) {
    if (!hasParent.has(n.id)) {
      const t = build(n.id, 0);
      if (t) roots.push(t);
    }
  }
  // Orphan recovery: any node not reached (e.g. caught in a parent cycle) is
  // surfaced as its own root so nothing silently disappears.
  for (const n of sorted) {
    if (!visited.has(n.id)) {
      const t = build(n.id, 0);
      if (t) roots.push(t);
    }
  }
  return roots;
}

/** Flatten a forest depth-first (pre-order) into a list, preserving depth. */
export function flattenTree<T>(roots: TreeNode<T>[]): TreeNode<T>[] {
  const out: TreeNode<T>[] = [];
  const walk = (n: TreeNode<T>) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}
