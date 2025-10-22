/**
 * OpenAI Function Call Flow Component
 * Specialized flow visualization for OpenAI function calling patterns
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
  ReactFlowProvider,
} from 'reactflow';
import {
  Function,
  MessageSquare,
  Settings,
  Zap,
  ArrowRight,
  Clock,
  DollarSign,
  Brain,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface OpenAIFunctionFlowProps {
  nodes: Node[];
  edges: Edge[];
  onNodeSelect?: (node: Node) => void;
}

// Custom node components for OpenAI function calling
const FunctionCallNode = ({ data }: any) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'border-green-500 bg-green-500/10';
      case 'running': return 'border-blue-500 bg-blue-500/10';
      case 'error': return 'border-red-500 bg-red-500/10';
      default: return 'border-slate-500 bg-slate-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'running': return <Clock className="w-4 h-4 text-blue-400" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    }
  };

  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[220px] ${getStatusColor(data.status)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Function className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white text-sm">{data.functionName || 'Function Call'}</span>
        </div>
        {getStatusIcon(data.status)}
      </div>
      
      <div className="space-y-1 text-xs text-slate-300">
        {data.model && (
          <div className="flex justify-between">
            <span>Model:</span>
            <span className="text-white">{data.model}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Cost:</span>
          <span className="text-white">${data.cost?.toFixed(6) || '0.000000'}</span>
        </div>
        <div className="flex justify-between">
          <span>Latency:</span>
          <span className="text-white">{data.latency || 0}ms</span>
        </div>
        {data.tokens && (
          <div className="flex justify-between">
            <span>Tokens:</span>
            <span className="text-white">{data.tokens.total}</span>
          </div>
        )}
      </div>

      {data.arguments && (
        <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs">
          <div className="text-slate-400 mb-1">Arguments:</div>
          <div className="text-slate-300 truncate">{data.arguments}</div>
        </div>
      )}
    </div>
  );
};

const ToolSelectionNode = ({ data }: any) => {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-purple-500 bg-purple-500/10 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-4 h-4 text-purple-400" />
        <span className="font-semibold text-white text-sm">Tool Selection</span>
      </div>
      
      <div className="space-y-1 text-xs text-slate-300">
        <div className="flex justify-between">
          <span>Selected:</span>
          <span className="text-white">{data.selectedTool?.name || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Confidence:</span>
          <span className="text-white">{(data.confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Available:</span>
          <span className="text-white">{data.availableTools?.length || 0} tools</span>
        </div>
      </div>

      {data.reasoning && (
        <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs">
          <div className="text-slate-400 mb-1">Reasoning:</div>
          <div className="text-slate-300">{data.reasoning}</div>
        </div>
      )}
    </div>
  );
};

const ConversationNode = ({ data }: any) => {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 min-w-[250px]">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-4 h-4 text-cyan-400" />
        <span className="font-semibold text-white text-sm">Conversation Turn</span>
      </div>
      
      <div className="space-y-1 text-xs text-slate-300">
        <div className="flex justify-between">
          <span>Model:</span>
          <span className="text-white">{data.model}</span>
        </div>
        <div className="flex justify-between">
          <span>Turn:</span>
          <span className="text-white">#{data.turnNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Cost:</span>
          <span className="text-white">${data.cost?.toFixed(6) || '0.000000'}</span>
        </div>
        {data.tokens && (
          <div className="flex justify-between">
            <span>Tokens:</span>
            <span className="text-white">{data.tokens.total}</span>
          </div>
        )}
      </div>

      {data.userMessage && (
        <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs">
          <div className="text-slate-400 mb-1">User Message:</div>
          <div className="text-slate-300 truncate">{data.userMessage}</div>
        </div>
      )}
    </div>
  );
};

const OpenAIFunctionFlow: React.FC<OpenAIFunctionFlowProps> = ({
  nodes,
  edges,
  onNodeSelect,
}) => {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);

  // Custom node types for OpenAI function calling
  const nodeTypes: NodeTypes = {
    functionCall: FunctionCallNode,
    toolSelection: ToolSelectionNode,
    conversation: ConversationNode,
  };

  // Transform nodes to OpenAI-specific types
  const transformedNodes = useMemo(() => {
    return flowNodes.map(node => {
      let type = 'default';
      
      if (node.data?.type?.includes('function')) {
        type = 'functionCall';
      } else if (node.data?.type === 'tool_selection') {
        type = 'toolSelection';
      } else if (node.data?.type === 'conversation_turn') {
        type = 'conversation';
      }

      return {
        ...node,
        type,
        position: node.position || { x: Math.random() * 400, y: Math.random() * 400 },
      };
    });
  }, [flowNodes]);

  // Transform edges with OpenAI-specific styling
  const transformedEdges = useMemo(() => {
    return flowEdges.map(edge => {
      const sourceNode = transformedNodes.find(n => n.id === edge.source);
      const targetNode = transformedNodes.find(n => n.id === edge.target);
      
      let edgeType = 'default';
      let animated = false;
      let color = '#6b7280';
      
      if (sourceNode?.type === 'functionCall' && targetNode?.type === 'toolSelection') {
        edgeType = 'smoothstep';
        animated = true;
        color = '#8b5cf6'; // Purple
      } else if (sourceNode?.type === 'toolSelection' && targetNode?.type === 'functionCall') {
        edgeType = 'smoothstep';
        animated = true;
        color = '#06b6d4'; // Cyan
      } else if (sourceNode?.type === 'conversation' && targetNode?.type === 'functionCall') {
        edgeType = 'smoothstep';
        animated = true;
        color = '#3b82f6'; // Blue
      }

      return {
        ...edge,
        type: edgeType,
        animated,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: {
          type: 'arrowclosed',
          color: color,
        },
      };
    });
  }, [flowEdges, transformedNodes]);

  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  // Calculate flow statistics
  const flowStats = useMemo(() => {
    const functionCalls = transformedNodes.filter(n => n.type === 'functionCall');
    const toolSelections = transformedNodes.filter(n => n.type === 'toolSelection');
    const conversations = transformedNodes.filter(n => n.type === 'conversation');
    
    const totalCost = transformedNodes.reduce((sum, node) => sum + (node.data?.cost || 0), 0);
    const totalLatency = transformedNodes.reduce((sum, node) => sum + (node.data?.latency || 0), 0);
    
    return {
      functionCalls: functionCalls.length,
      toolSelections: toolSelections.length,
      conversations: conversations.length,
      totalCost,
      totalLatency,
      averageCost: functionCalls.length > 0 ? totalCost / functionCalls.length : 0,
      averageLatency: functionCalls.length > 0 ? totalLatency / functionCalls.length : 0,
    };
  }, [transformedNodes]);

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header with Statistics */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">OpenAI Function Call Flow</h2>
        </div>
        
        {/* Flow Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Function className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-slate-300">Function Calls</span>
            </div>
            <div className="text-lg font-bold text-white">{flowStats.functionCalls}</div>
          </div>
          
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-slate-300">Tool Selections</span>
            </div>
            <div className="text-lg font-bold text-white">{flowStats.toolSelections}</div>
          </div>
          
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-medium text-slate-300">Conversations</span>
            </div>
            <div className="text-lg font-bold text-white">{flowStats.conversations}</div>
          </div>
          
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-slate-300">Total Cost</span>
            </div>
            <div className="text-lg font-bold text-white">${flowStats.totalCost.toFixed(6)}</div>
          </div>
          
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-medium text-slate-300">Total Latency</span>
            </div>
            <div className="text-lg font-bold text-white">{flowStats.totalLatency.toFixed(0)}ms</div>
          </div>
          
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-slate-300">Avg Latency</span>
            </div>
            <div className="text-lg font-bold text-white">{flowStats.averageLatency.toFixed(0)}ms</div>
          </div>
        </div>
      </div>

      {/* Flow Visualization */}
      <div className="flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={transformedNodes}
            edges={transformedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-slate-900"
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          >
            <Background color="#374151" gap={16} />
            <Controls 
              className="bg-slate-800 border-slate-700 [&_button]:bg-slate-700 [&_button]:border-slate-600 [&_button]:text-white hover:[&_button]:bg-slate-600" 
            />
            <MiniMap
              className="bg-slate-800 border-slate-700"
              nodeColor={(node) => {
                switch (node.type) {
                  case 'functionCall': return '#3b82f6';
                  case 'toolSelection': return '#8b5cf6';
                  case 'conversation': return '#06b6d4';
                  default: return '#6b7280';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.8)"
            />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-500/10"></div>
            <span className="text-slate-300">Function Calls</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-purple-500 bg-purple-500/10"></div>
            <span className="text-slate-300">Tool Selections</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-cyan-500 bg-cyan-500/10"></div>
            <span className="text-slate-300">Conversations</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300">Flow Direction</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenAIFunctionFlow;
