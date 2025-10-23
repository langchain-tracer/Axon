import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Folder, 
  FolderOpen, 
  Minus,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';

interface SubtreeNode {
  id: string;
  label: string;
  type: string;
  level: number;
  children: SubtreeNode[];
  isExpanded: boolean;
  isVisible: boolean;
  parentId?: string;
  metadata?: {
    cost: number;
    latency: number;
    status: string;
    nodeCount: number;
  };
}

interface SubtreeExpansionProps {
  nodes: SubtreeNode[];
  onNodeToggle?: (nodeId: string, expanded: boolean) => void;
  onNodeVisibilityToggle?: (nodeId: string, visible: boolean) => void;
  onNodeClick?: (node: SubtreeNode) => void;
  selectedNode?: SubtreeNode | null;
  maxDepth?: number;
}

const SubtreeExpansion: React.FC<SubtreeExpansionProps> = ({
  nodes,
  onNodeToggle,
  onNodeVisibilityToggle,
  onNodeClick,
  selectedNode,
  maxDepth = 5
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set());

  // Build tree structure from flat nodes
  const treeStructure = useMemo(() => {
    const nodeMap = new Map<string, SubtreeNode>();
    const rootNodes: SubtreeNode[] = [];

    // Create node map
    nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // Build tree structure
    nodes.forEach(node => {
      const treeNode = nodeMap.get(node.id)!;
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children.push(treeNode);
        }
      } else {
        rootNodes.push(treeNode);
      }
    });

    return rootNodes;
  }, [nodes]);

  // Calculate node metrics
  const nodeMetrics = useMemo(() => {
    const metrics = new Map<string, { totalCost: number; totalLatency: number; nodeCount: number }>();
    
    const calculateMetrics = (node: SubtreeNode): { totalCost: number; totalLatency: number; nodeCount: number } => {
      let totalCost = node.metadata?.cost || 0;
      let totalLatency = node.metadata?.latency || 0;
      let nodeCount = 1;

      node.children.forEach(child => {
        const childMetrics = calculateMetrics(child);
        totalCost += childMetrics.totalCost;
        totalLatency += childMetrics.totalLatency;
        nodeCount += childMetrics.nodeCount;
      });

      metrics.set(node.id, { totalCost, totalLatency, nodeCount });
      return { totalCost, totalLatency, nodeCount };
    };

    treeStructure.forEach(root => calculateMetrics(root));
    return metrics;
  }, [treeStructure]);

  const handleToggleExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
    onNodeToggle?.(nodeId, newExpanded.has(nodeId));
  };

  const handleToggleVisibility = (nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newVisible = new Set(visibleNodes);
    if (newVisible.has(nodeId)) {
      newVisible.delete(nodeId);
    } else {
      newVisible.add(nodeId);
    }
    setVisibleNodes(newVisible);
    onNodeVisibilityToggle?.(nodeId, newVisible.has(nodeId));
  };

  const handleNodeClick = (node: SubtreeNode) => {
    onNodeClick?.(node);
  };

  const renderNode = (node: SubtreeNode, depth: number = 0): React.ReactNode => {
    if (depth > maxDepth) return null;
    
    const isExpanded = expandedNodes.has(node.id);
    const isVisible = visibleNodes.has(node.id) || visibleNodes.size === 0;
    const isSelected = selectedNode?.id === node.id;
    const metrics = nodeMetrics.get(node.id);
    const hasChildren = node.children.length > 0;

    const getNodeIcon = (type: string) => {
      switch (type) {
        case 'llm_call': return '🧠';
        case 'tool_invocation': return '🔧';
        case 'decision_point': return '🔀';
        case 'state_transition': return '⚡';
        case 'reasoning_step': return '💭';
        case 'error_handling': return '⚠️';
        case 'validation': return '✅';
        case 'optimization': return '⚡';
        case 'user_interaction': return '👤';
        default: return '📋';
      }
    };

    const getNodeColor = (type: string) => {
      const colors = {
        'llm_call': 'text-blue-400',
        'tool_invocation': 'text-green-400',
        'decision_point': 'text-amber-400',
        'state_transition': 'text-purple-400',
        'reasoning_step': 'text-red-400',
        'error_handling': 'text-red-500',
        'validation': 'text-cyan-400',
        'optimization': 'text-lime-400',
        'user_interaction': 'text-pink-400'
      };
      return colors[type as keyof typeof colors] || 'text-slate-400';
    };

    return (
      <div key={node.id} className="select-none">
        <div
          className={`
            flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all duration-200
            ${isSelected ? 'bg-blue-600/20 border border-blue-500' : 'hover:bg-slate-700/50'}
            ${!isVisible ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => handleNodeClick(node)}
        >
          {/* Expansion Toggle */}
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleExpansion(node.id);
                }}
                className="p-1 hover:bg-slate-600 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}
            
            {/* Visibility Toggle */}
            <button
              onClick={(e) => handleToggleVisibility(node.id, e)}
              className="p-1 hover:bg-slate-600 rounded transition-colors"
            >
              {isVisible ? (
                <Eye className="w-4 h-4 text-green-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>

          {/* Node Icon */}
          <div className={`text-lg ${getNodeColor(node.type)}`}>
            {getNodeIcon(node.type)}
          </div>

          {/* Node Label */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate">
              {node.label}
            </div>
            <div className="text-xs text-slate-400">
              {node.type.replace('_', ' ').toUpperCase()}
            </div>
          </div>

          {/* Node Metrics */}
          {metrics && (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="text-center">
                <div className="font-bold text-green-400">
                  ${metrics.totalCost.toFixed(6)}
                </div>
                <div>Cost</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-blue-400">
                  {(metrics.totalLatency / 1000).toFixed(2)}s
                </div>
                <div>Time</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-purple-400">
                  {metrics.nodeCount}
                </div>
                <div>Nodes</div>
              </div>
            </div>
          )}

          {/* Status Indicator */}
          {node.metadata?.status && (
            <div className={`
              px-2 py-1 rounded text-xs font-medium
              ${node.metadata.status === 'error' ? 'bg-red-500/20 text-red-400' : ''}
              ${node.metadata.status === 'complete' ? 'bg-green-500/20 text-green-400' : ''}
              ${node.metadata.status === 'running' ? 'bg-blue-500/20 text-blue-400' : ''}
            `}>
              {node.metadata.status.toUpperCase()}
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Subtree Navigation</h3>
            <p className="text-sm text-slate-400">Expand/collapse subtrees for complex multi-step agents</p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                const allNodeIds = nodes.map(n => n.id);
                setExpandedNodes(new Set(allNodeIds));
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Expand All
            </button>
            <button
              onClick={() => setExpandedNodes(new Set())}
              className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
            >
              <Minus className="w-4 h-4 inline mr-1" />
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Tree Structure */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {treeStructure.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            No tree structure available
          </div>
        ) : (
          <div className="space-y-1">
            {treeStructure.map(root => renderNode(root))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="p-4 border-t border-slate-700">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-bold text-white">{nodes.length}</div>
            <div className="text-slate-400">Total Nodes</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-white">{expandedNodes.size}</div>
            <div className="text-slate-400">Expanded</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-white">{visibleNodes.size || nodes.length}</div>
            <div className="text-slate-400">Visible</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubtreeExpansion;
