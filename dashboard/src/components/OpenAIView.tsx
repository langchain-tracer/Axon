/**
 * OpenAI Function Calling View
 * Specialized view for OpenAI function calling traces
 */

import React, { useState, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
} from 'reactflow';
import {
  Play,
  Zap,
  Brain,
  Settings,
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  Function,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import CustomNode from './CustomNode';
import { TraceNodeData } from '../types';

interface OpenAIViewProps {
  nodes: Node[];
  edges: Edge[];
  onNodeSelect?: (node: Node) => void;
}

const OpenAIView: React.FC<OpenAIViewProps> = ({
  nodes,
  edges,
  onNodeSelect,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'cost' | 'latency' | 'tokens' | 'success'>('cost');
  const [viewMode, setViewMode] = useState<'flow' | 'timeline' | 'function-calls' | 'performance'>('flow');

  // Custom node types for OpenAI
  const nodeTypes: NodeTypes = {
    openaiFunctionCall: (props: any) => (
      <div className={`px-4 py-3 rounded-lg border-2 min-w-[200px] ${
        props.data.type === 'function_call_start' 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-green-500 bg-green-500/10'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <Function className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white">{props.data.functionName || 'Function Call'}</span>
        </div>
        <div className="text-sm text-slate-300">
          <div>Model: {props.data.model || 'N/A'}</div>
          <div>Cost: ${props.data.cost?.toFixed(6) || '0.000000'}</div>
          <div>Latency: {props.data.latency || 0}ms</div>
          {props.data.tokens && (
            <div>Tokens: {props.data.tokens.total}</div>
          )}
        </div>
        {props.data.status === 'complete' && (
          <CheckCircle className="w-4 h-4 text-green-400 mt-2" />
        )}
      </div>
    ),
    openaiToolSelection: (props: any) => (
      <div className="px-4 py-3 rounded-lg border-2 border-purple-500 bg-purple-500/10 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-white">Tool Selection</span>
        </div>
        <div className="text-sm text-slate-300">
          <div>Selected: {props.data.selectedTool?.name || 'N/A'}</div>
          <div>Confidence: {(props.data.confidence * 100).toFixed(1)}%</div>
          <div>Available: {props.data.availableTools?.length || 0} tools</div>
        </div>
      </div>
    ),
    openaiConversation: (props: any) => (
      <div className="px-4 py-3 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 min-w-[250px]">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-white">Conversation Turn</span>
        </div>
        <div className="text-sm text-slate-300">
          <div>Model: {props.data.model}</div>
          <div>Turn: #{props.data.turnNumber}</div>
          <div>Cost: ${props.data.cost?.toFixed(6) || '0.000000'}</div>
          {props.data.tokens && (
            <div>Tokens: {props.data.tokens.total}</div>
          )}
        </div>
      </div>
    ),
  };

  // Calculate OpenAI-specific metrics
  const metrics = useMemo(() => {
    const functionCalls = nodes.filter(n => n.data?.type?.includes('function'));
    const toolSelections = nodes.filter(n => n.data?.type === 'tool_selection');
    const conversations = nodes.filter(n => n.data?.type === 'conversation_turn');
    
    const totalCost = nodes.reduce((sum, node) => sum + (node.data?.cost || 0), 0);
    const totalLatency = nodes.reduce((sum, node) => sum + (node.data?.latency || 0), 0);
    const totalTokens = nodes.reduce((sum, node) => {
      return sum + (node.data?.tokens?.total || 0);
    }, 0);
    
    const successRate = nodes.filter(n => n.data?.status === 'complete').length / nodes.length * 100;
    
    return {
      functionCalls: functionCalls.length,
      toolSelections: toolSelections.length,
      conversations: conversations.length,
      totalCost,
      totalLatency,
      totalTokens,
      successRate,
      averageCost: functionCalls.length > 0 ? totalCost / functionCalls.length : 0,
      averageLatency: functionCalls.length > 0 ? totalLatency / functionCalls.length : 0,
    };
  }, [nodes]);

  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  const renderMetrics = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Function className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">Function Calls</span>
        </div>
        <div className="text-2xl font-bold text-white">{metrics.functionCalls}</div>
        <div className="text-xs text-slate-400">Total API calls</div>
      </div>
      
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-medium text-slate-300">Tool Selections</span>
        </div>
        <div className="text-2xl font-bold text-white">{metrics.toolSelections}</div>
        <div className="text-xs text-slate-400">Tools chosen</div>
      </div>
      
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-medium text-slate-300">Conversations</span>
        </div>
        <div className="text-2xl font-bold text-white">{metrics.conversations}</div>
        <div className="text-xs text-slate-400">Chat turns</div>
      </div>
      
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-sm font-medium text-slate-300">Success Rate</span>
        </div>
        <div className="text-2xl font-bold text-white">{metrics.successRate.toFixed(1)}%</div>
        <div className="text-xs text-slate-400">Completion rate</div>
      </div>
    </div>
  );

  const renderPerformanceMetrics = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          <span className="text-sm font-medium text-slate-300">Total Cost</span>
        </div>
        <div className="text-2xl font-bold text-white">${metrics.totalCost.toFixed(6)}</div>
        <div className="text-xs text-slate-400">Avg: ${metrics.averageCost.toFixed(6)}</div>
      </div>
      
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-orange-400" />
          <span className="text-sm font-medium text-slate-300">Total Latency</span>
        </div>
        <div className="text-2xl font-bold text-white">{metrics.totalLatency.toFixed(0)}ms</div>
        <div className="text-xs text-slate-400">Avg: {metrics.averageLatency.toFixed(0)}ms</div>
      </div>
      
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-medium text-slate-300">Total Tokens</span>
        </div>
        <div className="text-2xl font-bold text-white">{metrics.totalTokens.toLocaleString()}</div>
        <div className="text-xs text-slate-400">Token usage</div>
      </div>
      
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">Efficiency</span>
        </div>
        <div className="text-2xl font-bold text-white">
          {metrics.functionCalls > 0 ? (metrics.totalTokens / metrics.functionCalls).toFixed(0) : 0}
        </div>
        <div className="text-xs text-slate-400">Tokens/call</div>
      </div>
    </div>
  );

  const renderFunctionCallTimeline = () => {
    const functionCalls = nodes
      .filter(n => n.data?.type?.includes('function'))
      .sort((a, b) => (a.data?.timestamp || 0) - (b.data?.timestamp || 0));

    return (
      <div className="space-y-4">
        {functionCalls.map((node, index) => (
          <div key={node.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-400">#{index + 1}</span>
                <Function className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-white">{node.data?.functionName}</span>
              </div>
              <div className="text-sm text-slate-400">
                {new Date(node.data?.timestamp || 0).toLocaleTimeString()}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Model:</span>
                <div className="text-white">{node.data?.model || 'N/A'}</div>
              </div>
              <div>
                <span className="text-slate-400">Cost:</span>
                <div className="text-white">${node.data?.cost?.toFixed(6) || '0.000000'}</div>
              </div>
              <div>
                <span className="text-slate-400">Latency:</span>
                <div className="text-white">{node.data?.latency || 0}ms</div>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>
                <div className={`flex items-center gap-1 ${
                  node.data?.status === 'complete' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {node.data?.status === 'complete' ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  {node.data?.status || 'unknown'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">OpenAI Function Calling Analysis</h2>
        </div>
        
        {/* View Mode Selector */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'flow', label: 'Flow View', icon: Play },
            { id: 'timeline', label: 'Timeline', icon: Clock },
            { id: 'function-calls', label: 'Function Calls', icon: Function },
            { id: 'performance', label: 'Performance', icon: BarChart3 },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === mode.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <mode.icon className="w-4 h-4" />
              {mode.label}
            </button>
          ))}
        </div>

        {/* Metrics */}
        {viewMode === 'performance' ? renderPerformanceMetrics() : renderMetrics()}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'flow' && (
          <ReactFlowProvider>
            <div className="h-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-900"
              >
                <Background color="#374151" gap={16} />
                <Controls className="bg-slate-800 border-slate-700" />
                <MiniMap
                  className="bg-slate-800 border-slate-700"
                  nodeColor="#1e40af"
                  maskColor="rgba(0, 0, 0, 0.8)"
                />
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        )}

        {viewMode === 'timeline' && (
          <div className="h-full overflow-auto p-4">
            <div className="space-y-4">
              {nodes
                .sort((a, b) => (a.data?.timestamp || 0) - (b.data?.timestamp || 0))
                .map((node, index) => (
                  <div key={node.id} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {node.data?.type?.includes('function') && <Function className="w-4 h-4 text-blue-400" />}
                        {node.data?.type === 'tool_selection' && <Settings className="w-4 h-4 text-purple-400" />}
                        {node.data?.type === 'conversation_turn' && <MessageSquare className="w-4 h-4 text-cyan-400" />}
                        <span className="font-semibold text-white">
                          {node.data?.functionName || node.data?.selectedTool?.name || 'Conversation Turn'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300">
                        {node.data?.model && `Model: ${node.data.model}`}
                        {node.data?.cost && ` • Cost: $${node.data.cost.toFixed(6)}`}
                        {node.data?.latency && ` • Latency: ${node.data.latency}ms`}
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">
                      {new Date(node.data?.timestamp || 0).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {viewMode === 'function-calls' && (
          <div className="h-full overflow-auto p-4">
            {renderFunctionCallTimeline()}
          </div>
        )}

        {viewMode === 'performance' && (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Analysis */}
              <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Cost Analysis
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Total Cost:</span>
                    <span className="text-white font-medium">${metrics.totalCost.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Average per Call:</span>
                    <span className="text-white font-medium">${metrics.averageCost.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Cost per Token:</span>
                    <span className="text-white font-medium">
                      ${metrics.totalTokens > 0 ? (metrics.totalCost / metrics.totalTokens).toFixed(8) : '0.00000000'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance Analysis */}
              <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-400" />
                  Performance Analysis
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Total Latency:</span>
                    <span className="text-white font-medium">{metrics.totalLatency.toFixed(0)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Average Latency:</span>
                    <span className="text-white font-medium">{metrics.averageLatency.toFixed(0)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Throughput:</span>
                    <span className="text-white font-medium">
                      {metrics.totalLatency > 0 ? (metrics.functionCalls / (metrics.totalLatency / 1000)).toFixed(2) : 0} calls/sec
                    </span>
                  </div>
                </div>
              </div>

              {/* Token Analysis */}
              <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Token Analysis
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Total Tokens:</span>
                    <span className="text-white font-medium">{metrics.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Tokens per Call:</span>
                    <span className="text-white font-medium">
                      {metrics.functionCalls > 0 ? Math.round(metrics.totalTokens / metrics.functionCalls) : 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Efficiency:</span>
                    <span className="text-white font-medium">
                      {metrics.totalCost > 0 ? (metrics.totalTokens / metrics.totalCost).toFixed(0) : 0} tokens/$
                    </span>
                  </div>
                </div>
              </div>

              {/* Success Analysis */}
              <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Success Analysis
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Success Rate:</span>
                    <span className="text-white font-medium">{metrics.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Total Calls:</span>
                    <span className="text-white font-medium">{metrics.functionCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Successful:</span>
                    <span className="text-white font-medium">
                      {Math.round((metrics.successRate / 100) * metrics.functionCalls)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenAIView;
