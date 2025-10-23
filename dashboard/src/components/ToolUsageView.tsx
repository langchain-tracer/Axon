import React, { useMemo, useState } from 'react';
import { 
  Wrench, 
  Database, 
  Globe, 
  Zap, 
  CheckCircle, 
  XCircle, 
  Clock,
  DollarSign,
  BarChart3,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface ToolUsageNode {
  id: string;
  toolName: string;
  toolType: string;
  success: boolean;
  cost: number;
  latency: number;
  timestamp: number;
  input?: string;
  output?: string;
  error?: string;
}

interface ToolUsageViewProps {
  nodes: ToolUsageNode[];
  onNodeClick?: (node: ToolUsageNode) => void;
  selectedNode?: ToolUsageNode | null;
  width?: number;
  height?: number;
}

const ToolUsageView: React.FC<ToolUsageViewProps> = ({
  nodes,
  onNodeClick,
  selectedNode,
  width = 800,
  height = 600
}) => {
  const [selectedToolType, setSelectedToolType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'usage' | 'success' | 'cost' | 'latency'>('usage');

  // Group nodes by tool type
  const toolGroups = useMemo(() => {
    const groups = nodes.reduce((acc, node) => {
      const toolType = node.toolType || 'unknown';
      if (!acc[toolType]) {
        acc[toolType] = [];
      }
      acc[toolType].push(node);
      return acc;
    }, {} as Record<string, ToolUsageNode[]>);

    // Calculate metrics for each group
    return Object.entries(groups).map(([toolType, toolNodes]) => {
      const totalUsage = toolNodes.length;
      const successfulUsage = toolNodes.filter(n => n.success).length;
      const successRate = totalUsage > 0 ? (successfulUsage / totalUsage) * 100 : 0;
      const totalCost = toolNodes.reduce((sum, n) => sum + n.cost, 0);
      const avgLatency = toolNodes.reduce((sum, n) => sum + n.latency, 0) / totalUsage;
      const avgCost = totalCost / totalUsage;

      return {
        toolType,
        nodes: toolNodes,
        metrics: {
          totalUsage,
          successfulUsage,
          successRate,
          totalCost,
          avgLatency,
          avgCost
        }
      };
    });
  }, [nodes]);

  // Sort groups by selected criteria
  const sortedGroups = useMemo(() => {
    return [...toolGroups].sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return b.metrics.totalUsage - a.metrics.totalUsage;
        case 'success':
          return b.metrics.successRate - a.metrics.successRate;
        case 'cost':
          return b.metrics.totalCost - a.metrics.totalCost;
        case 'latency':
          return b.metrics.avgLatency - a.metrics.avgLatency;
        default:
          return 0;
      }
    });
  }, [toolGroups, sortBy]);

  // Get tool type icon and color
  const getToolTypeInfo = (toolType: string) => {
    const types = {
      'web_search': { icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500' },
      'database': { icon: Database, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500' },
      'api_call': { icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500' },
      'file_operation': { icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500' },
      'computation': { icon: BarChart3, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500' }
    };
    return types[toolType as keyof typeof types] || { 
      icon: Wrench, 
      color: 'text-slate-400', 
      bg: 'bg-slate-500/10', 
      border: 'border-slate-500' 
    };
  };

  // Get success rate color
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400';
    if (rate >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Get trend indicator
  const getTrendIcon = (current: number, average: number) => {
    if (current > average * 1.1) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (current < average * 0.9) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <div className="w-4 h-4" />;
  };

  const filteredGroups = selectedToolType 
    ? sortedGroups.filter(g => g.toolType === selectedToolType)
    : sortedGroups;

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg p-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Tool Usage Analysis</h3>
            <p className="text-sm text-slate-400">Tool performance, success rates, and usage patterns</p>
          </div>
          
          {/* Controls */}
          <div className="flex gap-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-sm text-white"
            >
              <option value="usage">Sort by Usage</option>
              <option value="success">Sort by Success Rate</option>
              <option value="cost">Sort by Cost</option>
              <option value="latency">Sort by Latency</option>
            </select>
            
            <select
              value={selectedToolType || ''}
              onChange={(e) => setSelectedToolType(e.target.value || null)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-sm text-white"
            >
              <option value="">All Tool Types</option>
              {toolGroups.map(group => (
                <option key={group.toolType} value={group.toolType}>
                  {group.toolType.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Total Tools</span>
            </div>
            <div className="text-xl font-bold text-white">{toolGroups.length}</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-400">Avg Success</span>
            </div>
            <div className="text-xl font-bold text-white">
              {toolGroups.length > 0 
                ? (toolGroups.reduce((sum, g) => sum + g.metrics.successRate, 0) / toolGroups.length).toFixed(1)
                : 0}%
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-400">Total Cost</span>
            </div>
            <div className="text-xl font-bold text-white">
              ${toolGroups.reduce((sum, g) => sum + g.metrics.totalCost, 0).toFixed(6)}
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-slate-400">Avg Latency</span>
            </div>
            <div className="text-xl font-bold text-white">
              {toolGroups.length > 0 
                ? (toolGroups.reduce((sum, g) => sum + g.metrics.avgLatency, 0) / toolGroups.length / 1000).toFixed(2)
                : 0}s
            </div>
          </div>
        </div>
      </div>

      {/* Tool Groups */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {filteredGroups.map((group) => {
          const toolInfo = getToolTypeInfo(group.toolType);
          const IconComponent = toolInfo.icon;
          
          return (
            <div
              key={group.toolType}
              className={`border-2 ${toolInfo.border} ${toolInfo.bg} rounded-lg p-4`}
            >
              {/* Group Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <IconComponent className={`w-6 h-6 ${toolInfo.color}`} />
                  <div>
                    <h4 className="font-semibold text-white">
                      {group.toolType.replace('_', ' ').toUpperCase()}
                    </h4>
                    <p className="text-sm text-slate-400">
                      {group.metrics.totalUsage} total uses
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className={`font-bold ${getSuccessRateColor(group.metrics.successRate)}`}>
                      {group.metrics.successRate.toFixed(1)}%
                    </div>
                    <div className="text-slate-500">Success</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-green-400">
                      ${group.metrics.totalCost.toFixed(6)}
                    </div>
                    <div className="text-slate-500">Cost</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-blue-400">
                      {(group.metrics.avgLatency / 1000).toFixed(2)}s
                    </div>
                    <div className="text-slate-500">Avg Time</div>
                  </div>
                </div>
              </div>

              {/* Individual Tool Calls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {group.nodes.slice(0, 6).map((node) => (
                  <div
                    key={node.id}
                    className={`
                      bg-slate-800 rounded-lg p-3 cursor-pointer transition-all duration-200
                      hover:bg-slate-700 ${selectedNode?.id === node.id ? 'ring-2 ring-blue-400' : ''}
                    `}
                    onClick={() => onNodeClick?.(node)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {node.success ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-sm font-medium text-white">
                          {node.toolName}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(node.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Cost:</span>
                        <span className="text-green-400">${node.cost.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Time:</span>
                        <span className="text-blue-400">{(node.latency / 1000).toFixed(2)}s</span>
                      </div>
                      {node.error && (
                        <div className="text-red-400 text-xs truncate" title={node.error}>
                          Error: {node.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {group.nodes.length > 6 && (
                  <div className="bg-slate-700 rounded-lg p-3 flex items-center justify-center">
                    <span className="text-sm text-slate-400">
                      +{group.nodes.length - 6} more calls
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToolUsageView;
