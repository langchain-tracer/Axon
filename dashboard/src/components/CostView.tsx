import React from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Target } from 'lucide-react';

interface CostViewProps {
  nodes: any[];
  onNodeSelect: (node: any) => void;
  onShowProjections?: () => void;
}

const CostView: React.FC<CostViewProps> = ({ nodes, onNodeSelect, onShowProjections }) => {
  // Calculate cost statistics
  const totalCost = nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
  const avgCost = nodes.length > 0 ? totalCost / nodes.length : 0;
  const maxCost = nodes.length > 0 ? Math.max(...nodes.map(node => node.cost || 0)) : 0;
  const expensiveNodes = nodes.filter(node => (node.cost || 0) > avgCost * 2);

  // Sort nodes by cost (highest first)
  const sortedNodes = [...nodes].sort((a, b) => (b.cost || 0) - (a.cost || 0));

  // Color coding for cost levels
  const getCostColor = (cost: number) => {
    if (cost > avgCost * 3) return 'text-red-400 bg-red-500/20 border-red-500';
    if (cost > avgCost * 2) return 'text-orange-400 bg-orange-500/20 border-orange-500';
    if (cost > avgCost) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
    return 'text-green-400 bg-green-500/20 border-green-500';
  };

  const getNodeSize = (cost: number) => {
    const maxSize = 120;
    const minSize = 60;
    if (maxCost === 0) return minSize; // Avoid division by zero
    const normalizedCost = Math.min(cost / maxCost, 1);
    return minSize + (normalizedCost * (maxSize - minSize));
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-green-400" />
                Cost Analysis View
              </h2>
              <p className="text-slate-400">
                Visualize costs by operation size and identify expensive steps
              </p>
            </div>
            {onShowProjections && (
              <button
                onClick={onShowProjections}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg border border-blue-500 transition-all"
              >
                <Target className="w-4 h-4" />
                View Projections
              </button>
            )}
          </div>
        </div>

        {/* Cost Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-green-400">${totalCost.toFixed(6)}</div>
            <div className="text-sm text-slate-400">Total Cost</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-blue-400">${avgCost.toFixed(6)}</div>
            <div className="text-sm text-slate-400">Average Cost</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-red-400">${maxCost.toFixed(6)}</div>
            <div className="text-sm text-slate-400">Highest Cost</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-orange-400">{expensiveNodes.length}</div>
            <div className="text-sm text-slate-400">Expensive Steps</div>
          </div>
        </div>

        {/* Cost Optimization Suggestions */}
        {expensiveNodes.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <h3 className="text-lg font-semibold text-orange-400">Cost Optimization Opportunities</h3>
            </div>
            <div className="text-slate-300 text-sm">
              {expensiveNodes.length} steps are significantly more expensive than average. 
              Consider optimizing these operations to reduce costs.
            </div>
          </div>
        )}

        {/* Cost Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bubble Chart */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Cost Distribution
            </h3>
            <div className="relative h-96 bg-slate-900 rounded-lg p-4 overflow-hidden">
              {sortedNodes.map((node, index) => {
                const size = getNodeSize(node.cost || 0);
                const x = 50 + (index % 4) * 80;
                const y = 50 + Math.floor(index / 4) * 100;
                
                return (
                  <div
                    key={node.id}
                    className={`absolute rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${getCostColor(node.cost || 0)}`}
                    style={{
                      width: size,
                      height: size,
                      left: x,
                      top: y,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: Math.max(10, size / 8)
                    }}
                    onClick={() => onNodeSelect(node)}
                    title={`${node.label}: $${(node.cost || 0).toFixed(6)}`}
                  >
                    {node.label?.substring(0, 3)}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-xs text-slate-400">
              Node size represents cost. Click nodes for details.
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sortedNodes.map((node, index) => (
                <div
                  key={node.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-700 ${getCostColor(node.cost || 0)}`}
                  onClick={() => onNodeSelect(node)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{node.label}</div>
                      <div className="text-xs opacity-75">{node.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${(node.cost || 0).toFixed(6)}</div>
                      <div className="text-xs opacity-75">
                        {node.tokens?.total ? `${node.tokens.total} tokens` : 'No token data'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostView;
