import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  DollarSign,
  Clock,
  Network,
  Activity,
  AlertCircle,
  Brain,
  Play,
  Zap,
  Unplug,
  BarChart3,
  GitBranch,
} from 'lucide-react';

import { TraceList } from './TraceList';
import { useRealtimeUpdates } from '../hooks';
import CustomNode from './CustomNode';
import CostView from './CostView';
import ToolsView from './ToolsView';
import DependencyView from './DependencyView';
import TimelineView from './TimelineView';
import CostProjections from './CostProjections';
import AnomalyDetectionView from './AnomalyDetectionView';
import IntelligentAnomalyView from './IntelligentAnomalyView';
import ReplayInterface from './ReplayInterface';
import ReplayResults from './ReplayResults';
import ReplaySidebar from './ReplaySidebar';

interface TraceData {
  trace: any;
  nodes: any[];
  edges: any[];
  anomalies: any[];
  stats: any;
}

type ViewMode =
  | 'flow'
  | 'timeline'
  | 'cost'
  | 'tools'
  | 'dependency'
  | 'projections'
  | 'anomalies'
  | 'intelligent-anomalies'
  | 'replay';

const IntegratedDashboardContent = () => {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('flow');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [showReplayInterface, setShowReplayInterface] = useState(false);
  const [replayResult, setReplayResult] = useState<any>(null);

  // NEW: explicit UI toggle instead of inferring from shape
  const [showReplayResults, setShowReplayResults] = useState(false);

  const [showReplaySidebar, setShowReplaySidebar] = useState(false);
  const [replayState, setReplayState] = useState({
    isPlaying: false,
    currentTime: 0,
    totalTime: 0,
    speed: 1,
  });

  const { setCenter } = useReactFlow();
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  const { connected, lastUpdate } = useRealtimeUpdates(selectedTraceId);

  // 🔔 Listen for replay results bubbled from the hook via DOM event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      console.log('🟢 [IntegratedDashboard] replay event detail:', detail);

      const hasReplay =
        !!detail &&
        (detail.success === true ||
          detail.ok === true ||
          typeof detail.text === 'string' ||
          (Array.isArray(detail.executedNodes) &&
            detail.executedNodes.length > 0));

      // Always merge packets; flip the explicit UI switch when we actually have something to show
      setReplayResult((prev: any) => ({ ...(prev || {}), ...detail }));
      if (hasReplay) {
        setShowReplayInterface(false);
        setShowReplayResults(true); // 👈 force overlay visible
      }
    };

    window.addEventListener('axon:replay_llm_result', handler as any);
    return () =>
      window.removeEventListener('axon:replay_llm_result', handler as any);
  }, []);

  useEffect(() => {
    if (selectedTraceId) {
      fetchTraceData(selectedTraceId);
    } else {
      setTraceData(null);
      setNodes([]);
      setEdges([]);
    }
  }, [selectedTraceId]);

  useEffect(() => {
    if (lastUpdate && lastUpdate.traceId === selectedTraceId) {
      if (selectedTraceId) {
        fetchTraceData(selectedTraceId);
      }
    }
  }, [lastUpdate, selectedTraceId]);

  useEffect(() => {
    const handleOpenReplay = (event: CustomEvent) => {
      const { nodeId } = event.detail;
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        setSelectedNodeId(node.id);
        setShowReplayInterface(true);
        setShowReplaySidebar(false);
      }
    };

    window.addEventListener('openReplay' as any, handleOpenReplay as any);
    return () => {
      window.removeEventListener('openReplay' as any, handleOpenReplay as any);
    };
  }, [nodes]);

  const fetchTraceData = async (traceId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/traces/${traceId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch trace: ${response.statusText}`);
      }

      const data = await response.json();
      setTraceData(data);

      const generateStepName = (node: any): string => {
        const stepNumber = node.label?.replace('Step ', '') || '1';
        switch (node.type) {
          case 'chain_start':
            return 'Initial Query';
          case 'chain_end':
            return 'Final Response';
          case 'llm_start':
            return 'LLM Processing';
          case 'llm_end':
            return 'LLM Response';
          case 'tool_start':
            if (node.toolName === 'DynamicTool') {
              if (
                node.toolInput?.includes('weather') ||
                node.toolInput?.includes('London')
              ) {
                return 'Weather API Call';
              } else if (
                node.toolInput?.includes('*') ||
                node.toolInput?.includes('+') ||
                node.toolInput?.includes('-')
              ) {
                return 'Calculator Tool';
              } else if (node.toolInput?.includes('search')) {
                return 'Search Tool';
              }
              return 'Tool Execution';
            }
            return `${node.toolName || 'Tool'} Call`;
          case 'tool_end':
            if (node.toolName === 'DynamicTool') {
              if (
                node.toolOutput?.includes('weather') ||
                node.toolOutput?.includes('°F')
              ) {
                return 'Weather Response';
              } else if (
                node.toolOutput?.includes('result') ||
                node.toolOutput?.includes('=')
              ) {
                return 'Calculation Result';
              }
              return 'Tool Response';
            }
            return `${node.toolName || 'Tool'} Response`;
          default:
            return node.label || `Step ${stepNumber}`;
        }
      };

      const getStepType = (node: any): string => {
        switch (node.type) {
          case 'llm':
          case 'llm_start':
          case 'llm_end':
          case 'llm_call':
            return 'LLM';
          case 'tool':
          case 'tool_start':
          case 'tool_end':
          case 'tool_invocation':
            return 'TOOL';
          case 'chain':
          case 'chain_start':
          case 'chain_end':
            return 'DECISION';
          default:
            return 'STEP';
        }
      };

      const flowNodes: Node[] = data.nodes.map((node: any, index: number) => ({
        id: node.id,
        type: 'custom',
        position: {
          x: node.x || 200 + (index % 3) * 250,
          y: node.y || 100 + Math.floor(index / 3) * 200,
        },
        data: {
          ...node,
          label: generateStepName(node),
          type: node.type,
          stepType: getStepType(node),
          cost: node.cost ?? 0,
          latency: node.latency || 0,
          status: node.status || 'complete',
          timestamp: node.timestamp || node.startTime,
          prompt: node.prompt,
          response: node.response,
          toolParams: node.toolParams,
          toolResponse: node.toolResponse,
          model: node.model,
          toolName: node.toolName,
          toolInput: node.toolInput,
          toolOutput: node.toolOutput,
          chainName: node.chainName,
          hasLoop: node.hasLoop || false,
          tokens: node.tokens || { input: 0, output: 0 },
        },
      }));

      const flowEdges: Edge[] = data.edges.map((edge: any, index: number) => ({
        id: `e${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: '#64748b',
          strokeWidth: 2,
        },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch trace data'
      );
      console.error('Error fetching trace data:', err);
    } finally {
      setLoading(false);
    }
  };

  // When nodes refresh, re-find the currently selected node by id
  useEffect(() => {
    if (!selectedNodeId) return;
    const refreshed = nodes.find((n) => n.id === selectedNodeId) || null;
    setSelectedNode(refreshed);
  }, [nodes, selectedNodeId]);

  const stats = useMemo(() => {
    if (!traceData) {
      return {
        totalCost: 0,
        totalNodes: 0,
        llmCount: 0,
        toolCount: 0,
        avgLatency: 0,
      };
    }

    const totalCost = traceData.stats?.totalCost || 0;
    const totalNodes = traceData.stats?.totalNodes || 0;
    const totalLatency = traceData.stats?.totalLatency || 0;

    return {
      totalCost,
      totalNodes,
      llmCount: traceData.stats?.llmCount || 0,
      toolCount: traceData.stats?.toolCount || 0,
      avgLatency: totalNodes > 0 ? totalLatency / totalNodes : 0, // ← average
    };
  }, [traceData]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedNodeId(node.id);
    setShowReplaySidebar(true);
  }, []);

  const handleReplayNode = useCallback((node: Node) => {
    setSelectedNode(node);
    setSelectedNodeId(node.id);
    setShowReplayInterface(true);
    setReplayResult(null);
    setShowReplayResults(false); // reset results UI
  }, []);

  const handleReplayComplete = useCallback((result: any) => {
    console.log('🟢 [IntegratedDashboard] onReplayComplete:', result);
    setReplayResult(result);
    setShowReplayInterface(false);
    setShowReplayResults(true);
  }, []);

  const handleCloseReplay = useCallback(() => {
    setShowReplayInterface(false);
    setReplayResult(null);
    setShowReplayResults(false);
    setSelectedNode(null); // keep selectedNodeId
  }, []);

  const getConnectionStatus = () => {
    if (connected) {
      return (
        <div className='flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-md'>
          <Zap className='text-sm font-medium text-green-400' />
        </div>
      );
    }
    return (
      <div className='flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-md'>
        <Unplug className='text-sm font-medium text-red-400' />
      </div>
    );
  };

  // Normalized trace for ReplayInterface
  const normalizedTraceForReplay = useMemo(() => {
    const t = traceData;
    const id = t?.trace?.id ?? (t as any)?.id;
    const nodesArr = Array.isArray(t?.nodes)
      ? t!.nodes
      : Array.isArray((t as any)?.trace?.nodes)
      ? (t as any).trace.nodes
      : [];
    const edgesArr = Array.isArray(t?.edges)
      ? t!.edges
      : Array.isArray((t as any)?.trace?.edges)
      ? (t as any).trace.edges
      : [];
    return { id, nodes: nodesArr, edges: edgesArr };
  }, [traceData]);

  // Safe selectedNode for ReplayInterface
  const selectedNodeForReplay = useMemo(() => {
    if (!selectedNode?.data) return null;
    return {
      id: selectedNode.data.id ?? selectedNode.id,
      ...selectedNode.data,
    };
  }, [selectedNode]);

  return (
    <div className='w-full h-screen bg-slate-950 text-white flex font-sans'>
      {/* Debug badge so we can SEE the flag flip */}
      {showReplayResults && (
        <div className='fixed top-3 right-3 z-[1001] bg-emerald-600/90 text-white text-xs px-2 py-1 rounded-md border border-emerald-400/60'>
          Results ready
        </div>
      )}

      {/* Trace List Sidebar */}
      <TraceList
        onTraceSelect={setSelectedTraceId}
        selectedTraceId={selectedTraceId || undefined}
      />

      {/* Main Content */}
      <div className='flex-1 flex flex-col'>
        {/* Header */}
        <div className='bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <img
              src='/Axon-Web-Favicon.svg'
              alt='AXON'
              className='h-[50px] w-[50px] flex-shrink-0'
            />
            <img
              src='/AXON.svg'
              alt='AXON-TITLE'
              className='h-[80px] w-[80px] flex-shrink-0'
            />
          </div>
          <div className='flex items-center gap-4'>
            <div className='flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1'>
              <button
                onClick={() => setViewMode('flow')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'flow'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Network className='w-4 h-4 inline mr-1' />
                Flow
              </button>
              <button
                onClick={() => setViewMode('cost')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'cost'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <DollarSign className='w-4 h-4 inline mr-1' />
                Cost
              </button>
              <button
                onClick={() => setViewMode('tools')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'tools'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <BarChart3 className='w-4 h-4 inline mr-1' />
                Tools
              </button>
              <button
                onClick={() => setViewMode('dependency')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'dependency'
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <GitBranch className='w-4 h-4 inline mr-1' />
                Dependencies
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'timeline'
                    ? 'bg-pink-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Clock className='w-4 h-4 inline mr-1' />
                Timeline
              </button>
              <button
                onClick={() => setViewMode('projections')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'projections'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Activity className='w-4 h-4 inline mr-1' />
                Projections
              </button>
              <button
                onClick={() => setViewMode('anomalies')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'anomalies'
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <AlertCircle className='w-4 h-4 inline mr-1' />
                Anomalies
              </button>
              <button
                onClick={() => setViewMode('intelligent-anomalies')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'intelligent-anomalies'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Brain className='w-4 h-4 inline mr-1' />
                IAD
              </button>
              <button
                onClick={() => setViewMode('replay')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'replay'
                    ? 'bg-cyan-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Play className='w-4 h-4 inline mr-1' />
                Replay
              </button>
            </div>
            {getConnectionStatus()}

            <div className='flex items-center gap-2 bg-green-600/20 border border-green-500 px-4 py-2 rounded-lg font-bold'>
              <DollarSign className='w-4 h-4 text-green-400' />
              <span className='text-green-400'>
                ${stats.totalCost.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* Main Visualization Area */}
        <div className='flex-1 flex overflow-hidden'>
          {!selectedTraceId ? (
            <div className='flex-1 flex items-center justify-center'>
              <div className='text-center text-slate-400'>
                <Network className='w-16 h-16 mx-auto mb-4 opacity-50' />
                <h2 className='text-xl font-bold mb-2'>No Trace Selected</h2>
                <p className='text-sm'>
                  Select a trace from the sidebar to view its execution flow
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className='flex-1 flex items-center justify-center'>
              <div className='text-slate-400'>Loading trace data...</div>
            </div>
          ) : error ? (
            <div className='flex-1 flex items-center justify-center'>
              <div className='text-center text-red-400'>
                <AlertCircle className='w-16 h-16 mx-auto mb-4' />
                <h2 className='text-xl font-bold mb-2'>Error Loading Trace</h2>
                <p className='text-sm'>{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation Overview */}
              {nodes.length > 0 && (
                <div className='bg-slate-900 border-b border-slate-700 p-4'>
                  <div className='max-w-5xl mx-auto space-y-3'>
                    {(() => {
                      const rootChain = nodes.find(
                        (n) =>
                          n.data.type?.includes('chain') &&
                          n.data.chainInputs &&
                          n.data.chainOutputs &&
                          (!n.data.parentRunId ||
                            n.data.chainName?.toLowerCase().includes('agent'))
                      );

                      if (!rootChain) return null;

                      let displayInput = '';
                      try {
                        const inputData =
                          typeof rootChain.data.chainInputs === 'string'
                            ? JSON.parse(rootChain.data.chainInputs)
                            : rootChain.data.chainInputs;
                        if (inputData.input) displayInput = inputData.input;
                        else if (inputData.question)
                          displayInput = inputData.question;
                        else if (inputData.query)
                          displayInput = inputData.query;
                        else if (typeof inputData === 'string')
                          displayInput = inputData;
                        else displayInput = JSON.stringify(inputData, null, 2);
                      } catch {
                        displayInput =
                          typeof rootChain.data.chainInputs === 'string'
                            ? rootChain.data.chainInputs
                            : JSON.stringify(
                                rootChain.data.chainInputs,
                                null,
                                2
                              );
                      }

                      let displayOutput = '';
                      try {
                        const outputData =
                          typeof rootChain.data.chainOutputs === 'string'
                            ? JSON.parse(rootChain.data.chainOutputs)
                            : rootChain.data.chainOutputs;
                        if (outputData.output)
                          displayOutput = outputData.output;
                        else if (outputData.answer)
                          displayOutput = outputData.answer;
                        else if (outputData.result)
                          displayOutput = outputData.result;
                        else if (typeof outputData === 'string')
                          displayOutput = outputData;
                        else
                          displayOutput = JSON.stringify(outputData, null, 2);
                      } catch {
                        displayOutput =
                          typeof rootChain.data.chainOutputs === 'string'
                            ? rootChain.data.chainOutputs
                            : JSON.stringify(
                                rootChain.data.chainOutputs,
                                null,
                                2
                              );
                      }

                      return (
                        <>
                          {displayInput && (
                            <div className='flex gap-3'>
                              <div className='flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center'>
                                <span className='text-blue-400 font-bold'>
                                  👤
                                </span>
                              </div>
                              <div className='flex-1'>
                                <div className='text-xs font-semibold text-blue-400 mb-1'>
                                  Human
                                </div>
                                <div className='text-sm text-white bg-slate-800 rounded-lg p-3 border border-slate-700 whitespace-pre-wrap'>
                                  {displayInput}
                                </div>
                              </div>
                            </div>
                          )}
                          {displayOutput && (
                            <div className='flex gap-3'>
                              <div className='flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center'>
                                <span className='text-green-400 font-bold'>
                                  🤖
                                </span>
                              </div>
                              <div className='flex-1'>
                                <div className='text-xs font-semibold text-green-400 mb-1'>
                                  Agent
                                </div>
                                <div className='text-sm text-white bg-slate-800 rounded-lg p-3 border border-slate-700 whitespace-pre-wrap'>
                                  {displayOutput}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {viewMode === 'flow' && (
                <div className='flex-1 relative'>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    nodeTypes={nodeTypes}
                    fitView
                    className='bg-slate-950'
                    panOnDrag
                    panOnScroll
                    panOnScrollSpeed={0.5}
                    zoomOnScroll={false}
                    zoomOnPinch
                    zoomOnDoubleClick={false}
                    preventScrolling={false}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable
                  >
                    <Controls
                      className='react-flow-controls'
                      style={{
                        background: 'rgba(30, 41, 59, 0.9)',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                    />
                    <MiniMap
                      className='bg-slate-800 border border-slate-700 rounded-lg'
                      nodeColor={(n) => {
                        if (n.data.type?.includes('llm')) return '#3b82f6';
                        if (n.data.type?.includes('tool')) return '#10b981';
                        if (n.data.type?.includes('chain')) return '#a855f7';
                        return '#64748b';
                      }}
                      style={{
                        background: 'rgba(30, 41, 59, 0.9)',
                        border: '1px solid #475569',
                      }}
                    />
                    <Background
                      color='#1e293b'
                      gap={20}
                      size={1}
                      style={{ opacity: 0.3 }}
                    />
                  </ReactFlow>
                </div>
              )}

              {viewMode === 'cost' && (
                <CostView
                  nodes={nodes.map((n) => n.data)}
                  onNodeSelect={(node) => {
                    const reactFlowNode = nodes.find(
                      (n) => n.data.id === node.id
                    );
                    if (reactFlowNode) {
                      setSelectedNode(reactFlowNode);
                      setSelectedNodeId(reactFlowNode.id);
                      setShowReplaySidebar(true);
                    }
                  }}
                  onShowProjections={() => setViewMode('projections')}
                />
              )}

              {viewMode === 'tools' && (
                <ToolsView
                  nodes={nodes.map((n) => n.data)}
                  onNodeSelect={(node) => {
                    const reactFlowNode = nodes.find(
                      (n) => n.data.id === node.id
                    );
                    if (reactFlowNode) {
                      setSelectedNode(reactFlowNode);
                      setSelectedNodeId(reactFlowNode.id);
                      setShowReplaySidebar(true);
                    }
                  }}
                />
              )}

              {viewMode === 'dependency' && (
                <DependencyView
                  nodes={nodes.map((n) => n.data)}
                  onNodeSelect={(node) => {
                    const reactFlowNode = nodes.find(
                      (n) => n.data.id === node.id
                    );
                    if (reactFlowNode) {
                      setSelectedNode(reactFlowNode);
                      setSelectedNodeId(reactFlowNode.id);
                      setShowReplaySidebar(true);
                    }
                  }}
                />
              )}

              {viewMode === 'timeline' && (
                <TimelineView
                  nodes={nodes.map((n) => n.data)}
                  onNodeSelect={(node: any) => {
                    const reactFlowNode = nodes.find(
                      (n) => n.data.id === node.id
                    );
                    if (reactFlowNode) {
                      setSelectedNode(reactFlowNode);
                      setSelectedNodeId(reactFlowNode.id);
                      setShowReplaySidebar(true);
                    }
                  }}
                  selectedNode={selectedNode?.data || null}
                />
              )}

              {viewMode === 'projections' && (
                <CostProjections nodes={nodes.map((n) => n.data)} traces={[]} />
              )}

              {viewMode === 'anomalies' && (
                <AnomalyDetectionView
                  nodes={nodes.map((n) => n.data)}
                  edges={edges}
                  onNodeSelect={(node) => {
                    const reactFlowNode = nodes.find(
                      (n) => n.data.id === node.id
                    );
                    if (reactFlowNode) {
                      handleNodeClick({} as any, reactFlowNode);
                    }
                  }}
                />
              )}

              {viewMode === 'intelligent-anomalies' && (
                <IntelligentAnomalyView
                  nodes={nodes.map((n) => n.data)}
                  edges={edges}
                  onNodeSelect={(node) => {
                    const reactFlowNode = nodes.find(
                      (n) => n.data.id === node.id
                    );
                    if (reactFlowNode) {
                      handleNodeClick({} as any, reactFlowNode);
                    }
                  }}
                />
              )}

              {viewMode === 'replay' && (
                <div className='flex-1 bg-slate-950 p-6 overflow-auto'>
                  <div className='max-w-4xl mx-auto'>
                    <div className='mb-8'>
                      <h2 className='text-2xl font-bold text-white mb-2 flex items-center gap-3'>
                        <Play className='w-6 h-6 text-cyan-400' />
                        Replay & Experimentation
                      </h2>
                      <p className='text-slate-400'>
                        Time-travel debugging for AI agents. Select a node to
                        replay execution from that point with modifications.
                      </p>
                    </div>

                    {!selectedNode ? (
                      <div className='bg-slate-800 border border-slate-700 rounded-lg p-8 text-center'>
                        <Play className='w-16 h-16 mx-auto mb-4 text-slate-400' />
                        <h3 className='text-xl font-bold text-white mb-2'>
                          Select a Node to Replay
                        </h3>
                        <p className='text-slate-400 mb-4'>
                          Click on any node in the flow view to start replaying
                          from that point.
                        </p>
                        <button
                          onClick={() => setViewMode('flow')}
                          className='px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-md transition-colors'
                        >
                          Go to Flow View
                        </button>
                      </div>
                    ) : (
                      <div className='space-y-6'>
                        <div className='bg-slate-800 border border-slate-700 rounded-lg p-4'>
                          <h3 className='text-lg font-semibold text-white mb-2'>
                            Selected Node
                          </h3>
                          <div className='flex items-center gap-4'>
                            <div className='flex-1'>
                              <div className='text-white font-medium'>
                                {selectedNode.data.label}
                              </div>
                              <div className='text-sm text-slate-400'>
                                {selectedNode.data.type} •{' '}
                                {selectedNode.data.toolName || 'No tool'}
                              </div>
                            </div>
                            <div className='flex items-center gap-2'>
                              <button
                                onClick={() => handleReplayNode(selectedNode)}
                                className='px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-md transition-colors flex items-center gap-2'
                              >
                                <Play className='w-4 h-4' />
                                Start Replay
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedNode(
                                    null
                                  ); /* keep selectedNodeId */
                                }}
                                className='px-3 py-2 text-slate-400 hover:text-white transition-colors'
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className='bg-slate-800 border border-slate-700 rounded-lg p-4'>
                          <h3 className='text-lg font-semibold text-white mb-3'>
                            Replay Features
                          </h3>
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                              <h4 className='font-medium text-slate-300'>
                                Modifications
                              </h4>
                              <ul className='text-sm text-slate-400 space-y-1'>
                                <li>
                                  • Change prompts and system instructions
                                </li>
                                <li>• Override tool responses</li>
                                <li>• Switch between different models</li>
                                <li>• Modify context variables</li>
                              </ul>
                            </div>
                            <div className='space-y-2'>
                              <h4 className='font-medium text-slate-300'>
                                Safety Features
                              </h4>
                              <ul className='text-sm text-slate-400 space-y-1'>
                                <li>• Side effect detection and warnings</li>
                                <li>• Mock external API calls</li>
                                <li>• Simulation mode for safe testing</li>
                                <li>• Circuit breaker suggestions</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewMode === 'flow' && (
                <div className='absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-4 z-10'>
                  <div className='font-bold text-sm mb-3'>Legend</div>
                  <div className='space-y-2 text-xs'>
                    <div className='flex items-center gap-2'>
                      <div className='w-4 h-4 rounded-full bg-blue-500' />
                      <span>LLM Call</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <div className='w-4 h-4 rounded-full bg-green-500' />
                      <span>Tool Call</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <div className='w-4 h-4 rounded-full bg-purple-500' />
                      <span>Chain</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Replay Sidebar */}
        {showReplaySidebar && (
          <div className='fixed right-0 top-0 h-full w-96 z-40'>
            <ReplaySidebar
              selectedNode={
                selectedNode
                  ? {
                      id: selectedNode.id,
                      type: selectedNode.data?.type || 'unknown',
                      label: selectedNode.data?.label || 'Unknown Node',
                      timestamp: selectedNode.data?.timestamp || Date.now(),
                      status: selectedNode.data?.status || 'complete',
                      cost: selectedNode.data?.cost || 0,
                      latency: selectedNode.data?.latency || 0,
                      tokens: selectedNode.data?.tokens,
                      model: selectedNode.data?.model,
                      reasoning: selectedNode.data?.reasoning,
                      decisionContext: selectedNode.data?.decisionContext,
                      alternatives: selectedNode.data?.alternatives,
                      selectedAlternative:
                        selectedNode.data?.selectedAlternative,
                      confidence: selectedNode.data?.confidence,
                      prompts: selectedNode.data?.prompts,
                      response: selectedNode.data?.response,
                      toolName: selectedNode.data?.toolName,
                      toolInput: selectedNode.data?.toolInput,
                      toolOutput: selectedNode.data?.toolOutput,
                      error: selectedNode.data?.error,
                      stateBefore: selectedNode.data?.stateBefore,
                      stateAfter: selectedNode.data?.stateAfter,
                      stateChanges: selectedNode.data?.stateChanges,
                      context: selectedNode.data?.context,
                      memoryUpdates: selectedNode.data?.memoryUpdates,
                      performance: selectedNode.data?.performance,
                    }
                  : null
              }
              replayState={replayState}
              onPlayPause={() =>
                setReplayState((prev) => ({
                  ...prev,
                  isPlaying: !prev.isPlaying,
                }))
              }
              onSeek={(time) =>
                setReplayState((prev) => ({ ...prev, currentTime: time }))
              }
              onSpeedChange={(speed) =>
                setReplayState((prev) => ({ ...prev, speed }))
              }
              onReset={() =>
                setReplayState((prev) => ({
                  ...prev,
                  currentTime: 0,
                  isPlaying: false,
                }))
              }
              onClose={() => setShowReplaySidebar(false)}
              onNodeClick={(nodeId) => {
                const node = nodes.find((n) => n.id === nodeId);
                if (node) {
                  setSelectedNode(node);
                  setSelectedNodeId(node.id);
                }
              }}
              nodes={nodes.map((n) => ({
                id: n.id,
                type: n.data?.type || 'unknown',
                label: n.data?.label || 'Unknown Node',
                timestamp: n.data?.timestamp || Date.now(),
                status: n.data?.status || 'complete',
                cost: n.data?.cost || 0,
                latency: n.data?.latency || 0,
                tokens: n.data?.tokens,
                model: n.data?.model,
                reasoning: n.data?.reasoning,
                decisionContext: n.data?.decisionContext,
                alternatives: n.data?.alternatives,
                selectedAlternative: n.data?.selectedAlternative,
                confidence: n.data?.confidence,
                prompts: n.data?.prompts,
                response: n.data?.response,
                toolName: n.data?.toolName,
                toolInput: n.data?.toolInput,
                toolOutput: n.data?.toolOutput,
                error: n.data?.error,
                stateBefore: n.data?.stateBefore,
                stateAfter: n.data?.stateAfter,
                stateChanges: n.data?.stateChanges,
                context: n.data?.context,
                memoryUpdates: n.data?.memoryUpdates,
                performance: n.data?.performance,
              }))}
            />
          </div>
        )}

        {/* Replay Interface Overlay */}
        {showReplayInterface && selectedNodeForReplay && traceData && (
          <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4'>
            <div className='w-full max-w-4xl max-h-[90vh] overflow-auto'>
              <ReplayInterface
                selectedNode={selectedNodeForReplay}
                trace={normalizedTraceForReplay}
                onReplayComplete={handleReplayComplete}
                onClose={handleCloseReplay}
              />
            </div>
          </div>
        )}

        {/* Replay Results Overlay (explicit flag) */}
        {showReplayResults && (
          <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4'>
            <div className='w-full max-w-4xl max-h-[90vh] overflow-auto'>
              <ReplayResults
                result={replayResult}
                originalTrace={traceData}
                onClose={() => {
                  setReplayResult(null);
                  setShowReplayResults(false);
                }}
                onStartNewReplay={() => {
                  setReplayResult(null);
                  setShowReplayResults(false);
                  if (selectedNode) setShowReplayInterface(true);
                }}
              />
            </div>
          </div>
        )}

        {/* Footer Stats */}
        <div className='bg-slate-900 border-t border-slate-700 p-3'>
          <div className='grid grid-cols-5 gap-4 text-center text-sm'>
            <div>
              <div className='text-xs text-slate-400 mb-1'>LLM Calls</div>
              <div className='text-lg font-bold text-blue-400'>
                {stats.llmCount}
              </div>
            </div>
            <div>
              <div className='text-xs text-slate-400 mb-1'>Tool Calls</div>
              <div className='text-lg font-bold text-green-400'>
                {stats.toolCount}
              </div>
            </div>
            <div>
              <div className='text-xs text-slate-400 mb-1'>Total Cost</div>
              <div className='text-lg font-bold text-green-400'>
                ${stats.totalCost.toFixed(4)}
              </div>
            </div>
            <div>
              <div className='text-xs text-slate-400 mb-1'>Avg Latency</div>
              <div className='text-lg font-bold'>
                {(stats.avgLatency / 1000).toFixed(2)}s
              </div>
            </div>
            <div>
              <div className='text-xs text-slate-400 mb-1'>Status</div>
              <div className='text-lg font-bold text-yellow-400'>
                {traceData?.trace?.status || 'Idle'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const IntegratedDashboard = () => (
  <ReactFlowProvider>
    <IntegratedDashboardContent />
  </ReactFlowProvider>
);

export default IntegratedDashboard;
