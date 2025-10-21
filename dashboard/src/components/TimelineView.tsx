import React, { useMemo } from 'react';
import { Clock, DollarSign, Hash, Zap, AlertCircle } from 'lucide-react';

interface TimelineNode {
  id: string;
  type: string;
  label: string;
  timestamp: number;
  cost: number;
  latency: number;
  tokens?: { input: number; output: number; total: number };
  status: string;
  reasoning?: string;
  decisionContext?: any;
}

interface TimelineViewProps {
  nodes: TimelineNode[];
  onNodeClick?: (node: TimelineNode) => void;
  selectedNode?: TimelineNode | null;
  width?: number;
  height?: number;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  nodes,
  onNodeClick,
  selectedNode,
  width = 800,
  height = 400
}) => {
  // Sort nodes by timestamp for chronological display
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => a.timestamp - b.timestamp);
  }, [nodes]);

  // Calculate timeline metrics
  const timelineMetrics = useMemo(() => {
    if (sortedNodes.length === 0) return null;
    
    const startTime = sortedNodes[0].timestamp;
    const endTime = sortedNodes[sortedNodes.length - 1].timestamp;
    const totalDuration = endTime - startTime;
    const totalCost = sortedNodes.reduce((sum, node) => sum + node.cost, 0);
    const totalTokens = sortedNodes.reduce((sum, node) => sum + (node.tokens?.total || 0), 0);
    
    return {
      startTime,
      endTime,
      totalDuration,
      totalCost,
      totalTokens,
      nodeCount: sortedNodes.length
    };
  }, [sortedNodes]);

  // Get node type color
  const getNodeTypeColor = (type: string) => {
    const colors = {
      'llm_call': 'bg-blue-500',
      'tool_invocation': 'bg-green-500',
      'decision_point': 'bg-amber-500',
      'state_transition': 'bg-purple-500',
      'reasoning_step': 'bg-red-500',
      'error_handling': 'bg-red-600',
      'validation': 'bg-cyan-500',
      'optimization': 'bg-lime-500',
      'user_interaction': 'bg-pink-500'
    };
    return colors[type as keyof typeof colors] || 'bg-slate-500';
  };

  // Get node type icon
  const getNodeTypeIcon = (type: string) => {
    const icons = {
      'llm_call': '🧠',
      'tool_invocation': '🔧',
      'decision_point': '🔀',
      'state_transition': '⚡',
      'reasoning_step': '💭',
      'error_handling': '⚠️',
      'validation': '✅',
      'optimization': '⚡',
      'user_interaction': '👤'
    };
    return icons[type as keyof typeof icons] || '📋';
  };

  if (!timelineMetrics) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        No timeline data available
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg p-4">
      {/* Timeline Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Execution Timeline</h3>
        <div className="flex gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>Duration: {(timelineMetrics.totalDuration / 1000).toFixed(2)}s</span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span>Cost: ${timelineMetrics.totalCost.toFixed(6)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Hash className="w-4 h-4" />
            <span>Tokens: {timelineMetrics.totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            <span>Steps: {timelineMetrics.nodeCount}</span>
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative" style={{ height: height - 100 }}>
        {/* Timeline Line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-600 transform -translate-y-1/2"></div>
        
        {/* Timeline Nodes */}
        <div className="relative h-full">
          {sortedNodes.map((node, index) => {
            const position = ((node.timestamp - timelineMetrics.startTime) / timelineMetrics.totalDuration) * 100;
            const isSelected = selectedNode?.id === node.id;
            
            return (
              <div
                key={node.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${position}%`,
                  top: '50%'
                }}
              >
                {/* Node Circle */}
                <div
                  className={`
                    w-8 h-8 rounded-full border-2 border-white flex items-center justify-center cursor-pointer
                    transition-all duration-200 hover:scale-110
                    ${getNodeTypeColor(node.type)}
                    ${isSelected ? 'ring-4 ring-blue-400 scale-110' : ''}
                    ${node.status === 'error' ? 'ring-2 ring-red-500' : ''}
                  `}
                  onClick={() => onNodeClick?.(node)}
                  title={`${node.label} - ${new Date(node.timestamp).toLocaleTimeString()}`}
                >
                  <span className="text-white text-xs">
                    {getNodeTypeIcon(node.type)}
                  </span>
                </div>
                
                {/* Node Label */}
                <div className="absolute top-10 left-1/2 transform -translate-x-1/2 text-xs text-slate-300 text-center whitespace-nowrap">
                  {node.label.length > 15 ? `${node.label.substring(0, 15)}...` : node.label}
                </div>
                
                {/* Node Details Popup */}
                {isSelected && (
                  <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg z-10 min-w-64">
                    <div className="text-sm font-semibold text-white mb-2">{node.label}</div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="text-slate-300">{node.type.replace('_', ' ').toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Time:</span>
                        <span className="text-slate-300">{new Date(node.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cost:</span>
                        <span className="text-green-400">${node.cost.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Latency:</span>
                        <span className="text-slate-300">{(node.latency / 1000).toFixed(2)}s</span>
                      </div>
                      {node.tokens && (
                        <div className="flex justify-between">
                          <span>Tokens:</span>
                          <span className="text-blue-400">{node.tokens.total.toLocaleString()}</span>
                        </div>
                      )}
                      {node.reasoning && (
                        <div className="mt-2 pt-2 border-t border-slate-600">
                          <div className="text-slate-500 text-xs">Reasoning:</div>
                          <div className="text-slate-300 text-xs">
                            {node.reasoning.length > 100 ? `${node.reasoning.substring(0, 100)}...` : node.reasoning}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Timeline Scale */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-500">
          <span>{new Date(timelineMetrics.startTime).toLocaleTimeString()}</span>
          <span>{new Date(timelineMetrics.endTime).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
