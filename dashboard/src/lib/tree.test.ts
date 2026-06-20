import { describe, it, expect } from 'vitest';
import { buildTree, flattenTree } from './tree';

const n = (id: string, startTime: number) => ({ id, startTime });

describe('buildTree', () => {
  it('builds a forest with depth and start-time ordering', () => {
    const nodes = [n('root', 0), n('b', 20), n('a', 10), n('a1', 15)];
    const edges = [
      { source: 'root', target: 'a' },
      { source: 'root', target: 'b' },
      { source: 'a', target: 'a1' },
    ];
    const tree = buildTree(nodes, edges);

    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe('root');
    expect(tree[0].depth).toBe(0);
    // children sorted by startTime: a (10) before b (20)
    expect(tree[0].children.map((c) => c.node.id)).toEqual(['a', 'b']);
    expect(tree[0].children[0].children[0].node.id).toBe('a1');
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it('treats nodes without a parent as roots', () => {
    const tree = buildTree([n('x', 5), n('y', 1)], []);
    expect(tree.map((t) => t.node.id)).toEqual(['y', 'x']);
  });

  it('drops dangling edges and survives cycles', () => {
    const nodes = [n('a', 0), n('b', 1)];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }, // cycle
      { source: 'ghost', target: 'a' }, // dangling source
    ];
    const tree = buildTree(nodes, edges);
    expect(flattenTree(tree).map((t) => t.node.id).sort()).toEqual(['a', 'b']);
  });
});
