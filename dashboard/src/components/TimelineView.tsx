import React, { useMemo } from 'react';
import { Clock, DollarSign, Hash } from 'lucide-react';

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
  onNodeSelect?: (node: TimelineNode) => void;
  selectedNode?: TimelineNode | null;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  nodes,
  onNodeSelect,
  selectedNode
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
    const totalDuration = endTime - startTime + (sortedNodes[sortedNodes.length - 1].latency || 0);
    
    return {
      startTime,
      totalDuration
    };
  }, [sortedNodes]);

  // Get node type color
  const getNodeTypeColor = (type: string) => {
    if (type.includes('llm') || type === 'llm_call') {
      return 'bg-blue-500';
    }
    if (type.includes('tool') || type === 'tool_invocation') {
      return 'bg-green-500';
    }
    if (type.includes('chain') || type === 'chain') {
      return 'bg-purple-500';
    }
    return 'bg-slate-500';
  };

  // Get node type badge
  const getNodeTypeBadge = (type: string) => {
    if (type.includes('llm') || type === 'llm_call') {
      return 'LLM';
    }
    if (type.includes('tool') || type === 'tool_invocation') {
      return 'TOOL';
    }
    if (type.includes('chain') || type === 'chain') {
      return 'CHAIN';
    }
    return type.toUpperCase();
  };

  // Format elapsed time from start
  const formatElapsedTime = (timestamp: number) => {
    if (!timelineMetrics) return '0.0s';
    const elapsed = (timestamp - timelineMetrics.startTime) / 1000;
    return `${elapsed.toFixed(1)}s`;
  };

  if (!timelineMetrics || sortedNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 p-8">
        No timeline data available
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-950 border-b border-slate-800 p-6 flex items-center justify-between z-10">
        <h2 className="text-2xl font-bold text-white">Timeline View</h2>
        <div className="text-slate-400 text-sm">
          Total Duration: <span className="text-white font-medium">{(timelineMetrics.totalDuration / 1000).toFixed(1)}s</span>
        </div>
      </div>

      {/* Timeline Items */}
      <div className="p-6 space-y-3">
        {sortedNodes.map((node, index) => {
          const isSelected = selectedNode?.id === node.id;
          const nodeColor = getNodeTypeColor(node.type);
          const typeBadge = getNodeTypeBadge(node.type);
          const elapsedTime = formatElapsedTime(node.timestamp);
          
          return (
            <div
              key={node.id}
              onClick={() => onNodeSelect?.(node)}
              className={`
                flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer
                ${isSelected 
                  ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/20' 
                  : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }
              `}
            >
              {/* Left: Time + Dot */}
              <div className="flex items-center gap-3 min-w-[80px]">
                <span className="text-slate-400 text-sm font-mono">{elapsedTime}</span>
                <div className={`w-3 h-3 rounded-full ${nodeColor}`}></div>
              </div>

              {/* Middle: Node Name + Type Badge */}
              <div className="flex-1 flex items-center gap-3">
                <span className="text-white font-medium">{node.label}</span>
                <span className={`
                  px-2 py-0.5 rounded text-xs font-semibold uppercase
                  ${typeBadge === 'CHAIN' ? 'text-purple-400 bg-purple-500/10' : 
                    typeBadge === 'LLM' ? 'text-blue-400 bg-blue-500/10' : 
                    'text-green-400 bg-green-500/10'}
                `}>
                  {typeBadge}
                </span>
              </div>

              {/* Right: Metrics */}
              <div className="flex items-center gap-6 text-sm">
                {/* Duration */}
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>{(node.latency / 1000).toFixed(1)}s</span>
                </div>

                {/* Cost */}
                <div className="flex items-center gap-1.5 text-green-400">
                  {/* <DollarSign className="w-4 h-4" /> */}
                  <span>${node.cost.toFixed(4)}</span>
                </div>

                {/* Tokens */}
                <div className="flex items-center gap-1.5 text-slate-400 min-w-[80px]">
                  <Hash className="w-4 h-4" />
                  <span>{node.tokens?.total || 0} tokens</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineView;
