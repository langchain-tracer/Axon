import React from 'react';
import { BarChart3, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

interface ToolsViewProps {
  nodes: any[];
  onNodeSelect: (node: any) => void;
}

interface ToolGroup {
  name: string;
  nodes: any[];
  totalCost: number;
  totalLatency: number;
  successCount: number;
  errorCount: number;
}

const ToolsView: React.FC<ToolsViewProps> = ({ nodes, onNodeSelect }) => {
  // Group nodes by tool type
  const toolGroups = nodes.reduce((groups, node) => {
    if (node.type?.includes('tool') || node.toolName) {
      const toolName = node.toolName || 'Unknown Tool';
      if (!groups[toolName]) {
        groups[toolName] = {
          name: toolName,
          nodes: [],
          totalCost: 0,
          totalLatency: 0,
          successCount: 0,
          errorCount: 0
        };
      }
      groups[toolName].nodes.push(node);
      groups[toolName].totalCost += node.cost || 0;
      groups[toolName].totalLatency += node.latency || 0;
      
      if (node.status === 'complete') {
        groups[toolName].successCount++;
      } else if (node.status === 'error') {
        groups[toolName].errorCount++;
      }
    }
    return groups;
  }, {} as Record<string, ToolGroup>);

  // Group LLM operations
  const llmNodes = nodes.filter(node => node.type?.includes('llm'));
  const llmGroup = {
    name: 'LLM Operations',
    nodes: llmNodes,
    totalCost: llmNodes.reduce((sum, node) => sum + (node.cost || 0), 0),
    totalLatency: llmNodes.reduce((sum, node) => sum + (node.latency || 0), 0),
    successCount: llmNodes.filter(node => node.status === 'complete').length,
    errorCount: llmNodes.filter(node => node.status === 'error').length
  };

  const allGroups: ToolGroup[] = [llmGroup, ...Object.values(toolGroups)];

  // Calculate statistics
  const totalCost = allGroups.reduce((sum, group) => sum + group.totalCost, 0);
  const totalLatency = allGroups.reduce((sum, group) => sum + group.totalLatency, 0);
  const totalSuccess = allGroups.reduce((sum, group) => sum + group.successCount, 0);
  const totalErrors = allGroups.reduce((sum, group) => sum + group.errorCount, 0);

  const getSuccessRate = (group: ToolGroup) => {
    const total = group.successCount + group.errorCount;
    return total > 0 ? (group.successCount / total) * 100 : 0;
  };

  const getCostPercentage = (group: ToolGroup) => {
    return totalCost > 0 ? (group.totalCost / totalCost) * 100 : 0;
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Tool Usage Analysis
          </h2>
          <p className="text-slate-400">
            Analyze tool usage patterns, success rates, and performance metrics
          </p>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-green-400">${totalCost.toFixed(6)}</div>
            <div className="text-sm text-slate-400">Total Cost</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-blue-400">{(totalLatency / 1000).toFixed(2)}s</div>
            <div className="text-sm text-slate-400">Total Latency</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-green-400">{totalSuccess}</div>
            <div className="text-sm text-slate-400">Successful Operations</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-red-400">{totalErrors}</div>
            <div className="text-sm text-slate-400">Failed Operations</div>
          </div>
        </div>

        {/* Tool Groups */}
        <div className="space-y-6">
          {allGroups.map((group: ToolGroup, index: number) => (
            <div key={index} className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  {group.name}
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">{group.successCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">{group.errorCount}</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-slate-400 mb-1">
                  <span>Success Rate</span>
                  <span>{getSuccessRate(group).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getSuccessRate(group)}%` }}
                  />
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">${group.totalCost.toFixed(6)}</div>
                  <div className="text-xs text-slate-400">Total Cost</div>
                  <div className="text-xs text-slate-500">({getCostPercentage(group).toFixed(1)}% of total)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">{(group.totalLatency / 1000).toFixed(2)}s</div>
                  <div className="text-xs text-slate-400">Total Latency</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">{group.nodes.length}</div>
                  <div className="text-xs text-slate-400">Operations</div>
                </div>
              </div>

              {/* Individual Operations */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Recent Operations</h4>
                {group.nodes.slice(0, 5).map((node: any, nodeIndex: number) => (
                  <div
                    key={nodeIndex}
                    className="flex items-center justify-between p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors"
                    onClick={() => onNodeSelect(node)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        node.status === 'complete' ? 'bg-green-400' : 
                        node.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-white">{node.label}</div>
                        <div className="text-xs text-slate-400">
                          {node.toolInput ? `Input: ${node.toolInput}` : node.prompt ? `Prompt: ${node.prompt.substring(0, 50)}...` : 'No input data'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-400">${(node.cost || 0).toFixed(6)}</div>
                      <div className="text-xs text-slate-400">{(node.latency || 0) / 1000}s</div>
                    </div>
                  </div>
                ))}
                {group.nodes.length > 5 && (
                  <div className="text-center text-sm text-slate-400 py-2">
                    ... and {group.nodes.length - 5} more operations
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ToolsView;
