import React from 'react';
import { GitBranch, ArrowRight, Circle, AlertTriangle } from 'lucide-react';

interface DependencyViewProps {
  nodes: any[];
  onNodeSelect: (node: any) => void;
}

const DependencyView: React.FC<DependencyViewProps> = ({ nodes, onNodeSelect }) => {
  // Build dependency graph
  const buildDependencyGraph = () => {
    const graph: Record<string, { node: any; dependencies: string[]; dependents: string[] }> = {};
    
    // Initialize nodes
    nodes.forEach(node => {
      graph[node.id] = {
        node,
        dependencies: [],
        dependents: []
      };
    });

    // Build dependencies based on parent-child relationships
    nodes.forEach(node => {
      if (node.parentRunId) {
        const parent = nodes.find(n => n.runId === node.parentRunId);
        if (parent) {
          graph[node.id].dependencies.push(parent.id);
          graph[parent.id].dependents.push(node.id);
        }
      }
    });

    return graph;
  };

  const dependencyGraph = buildDependencyGraph();

  // Find root nodes (no dependencies)
  const rootNodes = Object.values(dependencyGraph).filter(item => item.dependencies.length === 0);
  
  // Find leaf nodes (no dependents)
  const leafNodes = Object.values(dependencyGraph).filter(item => item.dependents.length === 0);

  // Find critical path (longest chain)
  const findCriticalPath = () => {
    const visited = new Set<string>();
    const path: string[] = [];
    let maxDepth = 0;
    let criticalPath: string[] = [];

    const dfs = (nodeId: string, currentPath: string[], depth: number) => {
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      currentPath.push(nodeId);
      
      if (depth > maxDepth) {
        maxDepth = depth;
        criticalPath = [...currentPath];
      }

      const node = dependencyGraph[nodeId];
      node.dependents.forEach(dependentId => {
        dfs(dependentId, currentPath, depth + 1);
      });

      currentPath.pop();
      visited.delete(nodeId);
    };

    rootNodes.forEach(root => {
      dfs(root.node.id, [], 0);
    });

    return criticalPath;
  };

  const criticalPath = findCriticalPath();

  // Calculate dependency metrics
  const totalDependencies = Object.values(dependencyGraph).reduce((sum, item) => sum + item.dependencies.length, 0);
  const avgDependencies = nodes.length > 0 ? totalDependencies / nodes.length : 0;
  const maxDependencies = Math.max(...Object.values(dependencyGraph).map(item => item.dependencies.length));

  const getNodeType = (node: any) => {
    if (node.type?.includes('llm')) return 'llm';
    if (node.type?.includes('tool')) return 'tool';
    if (node.type?.includes('chain')) return 'chain';
    return 'other';
  };

  const getNodeColor = (nodeType: string) => {
    switch (nodeType) {
      case 'llm': return 'bg-blue-500/20 border-blue-500 text-blue-400';
      case 'tool': return 'bg-green-500/20 border-green-500 text-green-400';
      case 'chain': return 'bg-purple-500/20 border-purple-500 text-purple-400';
      default: return 'bg-slate-500/20 border-slate-500 text-slate-400';
    }
  };

  const renderDependencyTree = (nodeId: string, level: number = 0) => {
    const item = dependencyGraph[nodeId];
    if (!item) return null;

    const nodeType = getNodeType(item.node);
    const isCritical = criticalPath.includes(nodeId);

    return (
      <div key={nodeId} className="ml-4">
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-105 mb-2 ${
            isCritical ? 'ring-2 ring-yellow-400 bg-yellow-500/10' : getNodeColor(nodeType)
          }`}
          onClick={() => onNodeSelect(item.node)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Circle className="w-3 h-3" />
              <span className="font-medium">{item.node.label}</span>
              {isCritical && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
            </div>
            <div className="text-xs opacity-75">
              {item.dependencies.length} deps, {item.dependents.length} dependents
            </div>
          </div>
          <div className="text-xs mt-1 opacity-75">
            {nodeType.toUpperCase()} • ${(item.node.cost || 0).toFixed(6)}
          </div>
        </div>
        
        {/* Render dependents */}
        {item.dependents.map(dependentId => (
          <div key={dependentId} className="relative">
            <div className="absolute left-0 top-0 w-px h-full bg-slate-600" />
            <div className="absolute left-0 top-6 w-4 h-px bg-slate-600" />
            {renderDependencyTree(dependentId, level + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <GitBranch className="w-6 h-6 text-purple-400" />
            Dependency Analysis
          </h2>
          <p className="text-slate-400">
            Visualize execution dependencies and identify critical paths
          </p>
        </div>

        {/* Dependency Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-blue-400">{rootNodes.length}</div>
            <div className="text-sm text-slate-400">Root Nodes</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-green-400">{leafNodes.length}</div>
            <div className="text-sm text-slate-400">Leaf Nodes</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-purple-400">{avgDependencies.toFixed(1)}</div>
            <div className="text-sm text-slate-400">Avg Dependencies</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-yellow-400">{criticalPath.length}</div>
            <div className="text-sm text-slate-400">Critical Path Length</div>
          </div>
        </div>

        {/* Critical Path Warning */}
        {criticalPath.length > 5 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-yellow-400">Long Critical Path Detected</h3>
            </div>
            <div className="text-slate-300 text-sm">
              The critical path has {criticalPath.length} steps, which may indicate potential bottlenecks or complex dependencies.
            </div>
          </div>
        )}

        {/* Dependency Tree */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tree View */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-purple-400" />
              Execution Tree
            </h3>
            <div className="max-h-96 overflow-y-auto">
              {rootNodes.map(root => renderDependencyTree(root.node.id))}
            </div>
            <div className="mt-4 text-xs text-slate-400">
              Yellow highlighted nodes are part of the critical path
            </div>
          </div>

          {/* Dependency Matrix */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Dependency Overview</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.values(dependencyGraph).map((item, index) => {
                const nodeType = getNodeType(item.node);
                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-700 ${getNodeColor(nodeType)}`}
                    onClick={() => onNodeSelect(item.node)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{item.node.label}</div>
                        <div className="text-xs opacity-75">{nodeType.toUpperCase()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          <span className="text-blue-400">{item.dependencies.length}</span>
                          <ArrowRight className="w-3 h-3 inline mx-1" />
                          <span className="text-green-400">{item.dependents.length}</span>
                        </div>
                        <div className="text-xs opacity-75">
                          {criticalPath.includes(item.node.id) && 'Critical Path'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DependencyView;
