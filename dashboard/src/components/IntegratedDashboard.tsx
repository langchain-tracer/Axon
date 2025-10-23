import React, { useState, useEffect, useMemo, useCallback } from "react";
import ReactFlow, {
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    ReactFlowProvider,
    useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
    DollarSign,
    Clock,
    Network,
    Activity,
    AlertCircle,
    CheckCircle,
    XCircle,
    BarChart3,
    GitBranch,
    Brain,
    Play,
    Eye, 
    Zap, 
    Wifi,
    Link,
    Unplug
} from "lucide-react";

import { TraceList } from "./TraceList";
import { useRealtimeUpdates } from "../hooks";
import CustomNode from "./CustomNode";
import CostView from "./CostView";
import ToolsView from "./ToolsView";
import DependencyView from "./DependencyView";
import TimelineView from "./TimelineView";
import CostProjections from "./CostProjections";
import AnomalyDetectionView from "./AnomalyDetectionView";
import IntelligentAnomalyView from "./IntelligentAnomalyView";
import ReplayInterface from "./ReplayInterface";
import ReplayResults from "./ReplayResults";
import ReplaySidebar from "./ReplaySidebar";

interface TraceData {
  trace: any;
  nodes: any[];
  edges: any[];
  anomalies: any[];
  stats: any;
}

/**
 * View modes available in the dashboard
 * - flow: Visual flow diagram of the trace execution
 * - timeline: Chronological view of events
 * - cost: Cost analysis and breakdown
 * - tools: Tool usage statistics and analysis
 * - dependency: Dependency graph between components
 * - projections: Cost projections and optimization suggestions
 * - anomalies: Anomaly detection results
 * - intelligent-anomalies: AI-powered anomaly analysis
 * - replay: Trace replay interface
 */
type ViewMode = 'flow' | 'timeline' | 'cost' | 'tools' | 'dependency' | 'projections' | 'anomalies' | 'intelligent-anomalies' | 'replay';

/**
 * Main integrated dashboard component that provides a comprehensive view of agent traces
 * 
 * Features:
 * - Real-time trace visualization with ReactFlow
 * - Multiple view modes for different analysis perspectives
 * - Interactive node selection and details
 * - Cost analysis and projections
 * - Anomaly detection and intelligent analysis
 * - Trace replay functionality
 * - WebSocket-based real-time updates
 * 
 * @returns JSX element containing the complete dashboard interface
 */
const IntegratedDashboardContent = () => {
    const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
    const [traceData, setTraceData] = useState<TraceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('flow');
    
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [showReplayInterface, setShowReplayInterface] = useState(false);
    const [replayResult, setReplayResult] = useState<any>(null);
    const [showReplaySidebar, setShowReplaySidebar] = useState(false);
    const [replayState, setReplayState] = useState({
        isPlaying: false,
        currentTime: 0,
        totalTime: 0,
        speed: 1
    });
    const { setCenter } = useReactFlow();


    const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

    // Real-time updates
    const { connected, lastUpdate } = useRealtimeUpdates(selectedTraceId);

    // Fetch trace data when a trace is selected
    useEffect(() => {
        if (selectedTraceId) {
            fetchTraceData(selectedTraceId);
        } else {
            setTraceData(null);
            setNodes([]);
            setEdges([]);
        }
    }, [selectedTraceId]);

    // Handle real-time updates
    useEffect(() => {
        if (lastUpdate && lastUpdate.traceId === selectedTraceId) {
            // Refresh trace data when we receive updates
            if (selectedTraceId) {
                fetchTraceData(selectedTraceId);
            }
        }
    }, [lastUpdate, selectedTraceId]);
    
    // Handle replay navigation from sidebar
    useEffect(() => {
        const handleOpenReplay = (event: CustomEvent) => {
            const { nodeId } = event.detail;
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
                setSelectedNode(node);
                setShowReplayInterface(true); // Open the replay interface directly
                setShowReplaySidebar(false); // Close the sidebar when navigating to replay
            }
        };
        
        window.addEventListener('openReplay' as any, handleOpenReplay as any);
        return () => {
            window.removeEventListener('openReplay' as any, handleOpenReplay as any);
        };
    }, [nodes]);
    
    console.log(selectedNode, 'selectedNode/n/n/n/n');

    /**
     * Fetches trace data from the backend API and transforms it for visualization
     * 
     * This function:
     * 1. Makes an API call to get trace data by ID
     * 2. Transforms backend data into ReactFlow-compatible format
     * 3. Generates meaningful step names based on node types
     * 4. Calculates positions for nodes in the flow diagram
     * 5. Updates the component state with the processed data
     * 
     * @param traceId - The unique identifier of the trace to fetch
     * @throws Error if the API request fails
     */
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
            console.log(data, 'data/n/n/n/n');
            console.log(data.nodes, 'data.nodes/n/n/n/n');
            console.log(data.edges, 'data.edges/n/n/n/n');
            
            // Transform backend data to ReactFlow format with enhanced step names and costs
            
            /**
             * Generates human-readable step names based on node type and content
             * 
             * This function analyzes the node type and content to create meaningful
             * step names that help users understand what each step in the trace does.
             * 
             * @param node - The trace node containing type, toolName, toolInput, etc.
             * @returns A human-readable string describing the step
             */
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
                            // Try to determine the actual tool from the input
                            if (node.toolInput?.includes('weather') || node.toolInput?.includes('London')) {
                                return 'Weather API Call';
                            } else if (node.toolInput?.includes('*') || node.toolInput?.includes('+') || node.toolInput?.includes('-')) {
                                return 'Calculator Tool';
                            } else if (node.toolInput?.includes('search')) {
                                return 'Search Tool';
                            }
                            return 'Tool Execution';
                        }
                        return `${node.toolName || 'Tool'} Call`;
                    case 'tool_end':
                        if (node.toolName === 'DynamicTool') {
                            if (node.toolOutput?.includes('weather') || node.toolOutput?.includes('°F')) {
                                return 'Weather Response';
                            } else if (node.toolOutput?.includes('result') || node.toolOutput?.includes('=')) {
                                return 'Calculation Result';
                            }
                            return 'Tool Response';
                        }
                        return `${node.toolName || 'Tool'} Response`;
                    default:
                        return node.label || `Step ${stepNumber}`;
                }
            };

            /**
             * Determines the step type category for styling and grouping
             * 
             * This function categorizes nodes into different types for consistent
             * styling and visual representation in the flow diagram.
             * 
             * @param node - The trace node to categorize
             * @returns A string representing the step type category
             */
            const getStepType = (node: any): string => {
                switch (node.type) {
                    case 'llm':
                    case 'llm_start':
                    case 'llm_end':
                    case 'llm_call':
                        return 'LLM';      // Blue
                    case 'tool':
                    case 'tool_start':
                    case 'tool_end':
                    case 'tool_invocation':
                        return 'TOOL';     // Green
                    case 'chain':
                    case 'chain_start':
                    case 'chain_end':
                        return 'DECISION'; // Purple
                    default:
                        return 'STEP';     // Gray
                }
            };

            const calculateCost = (node: any): number => {
                // Simple cost calculation based on latency and type
                // In a real implementation, this would use actual token counts and pricing
                const baseCost = 0.0001;
                const latencyMultiplier = (node.latency || 0) / 1000; // Convert to seconds
                
                switch (node.type) {
                    case 'llm_start':
                    case 'llm_end':
                        return baseCost * latencyMultiplier * 10; // LLM calls are more expensive
                    case 'tool_start':
                    case 'tool_end':
                        return baseCost * latencyMultiplier;
                    default:
                        return baseCost;
                }
            };

            const flowNodes: Node[] = data.nodes.map((node: any, index: number) => ({
                id: node.id,
                type: 'custom',
                position: { x: node.x || 200 + (index % 3) * 250, y: node.y || 100 + Math.floor(index / 3) * 200 },
                data: {
                    ...node,
                    label: generateStepName(node),
                    type: node.type,  // Keep original type for color mapping
                    stepType: getStepType(node),  // Display label
                    cost: calculateCost(node),
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
                    // Add token information if available
                    tokens: node.tokens || { input: 0, output: 0 }
                }
            }));

            const flowEdges: Edge[] = data.edges.map((edge: any, index: number) => ({
                id: `e${edge.source}-${edge.target}-${index}`,
                source: edge.source,
                target: edge.target,
                type: 'smoothstep',
                animated: false,
                style: { 
                    stroke: '#64748b', 
                    strokeWidth: 2 
                }
            }));

            setNodes(flowNodes);
            setEdges(flowEdges);
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch trace data');
            console.error('Error fetching trace data:', err);
        } finally {
            setLoading(false);
        }
    };

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
        
        return {
            totalCost: traceData.stats?.totalCost || 0,
            totalNodes: traceData.stats?.totalNodes || 0,
            llmCount: traceData.stats?.llmCount || 0,
            toolCount: traceData.stats?.toolCount || 0,
            avgLatency: traceData.stats?.totalLatency || 0,
        };
    }, [traceData]);

    /**
     * Handles node click events in the flow diagram
     * 
     * When a user clicks on a node in the flow diagram, this function:
     * 1. Sets the clicked node as the selected node
     * 2. Centers the view on the clicked node with zoom
     * 3. If in flow mode, switches to replay mode and opens the replay interface
     * 
     * @param _ - React mouse event (unused)
     * @param node - The clicked ReactFlow node
     */
    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        // Removed auto-centering to allow free panning and exploration
        // setCenter(node.position.x, node.position.y, { zoom: 1.2 });
        
        // Automatically show the node details sidebar when a node is clicked
        setShowReplaySidebar(true);
    }, []);

    /**
     * Handles initiating replay for a specific node
     * 
     * This function is called when the user wants to replay a specific node's execution.
     * It sets up the replay interface by selecting the node and showing the replay UI.
     * 
     * @param node - The node to replay
     */
    const handleReplayNode = useCallback((node: Node) => {
        setSelectedNode(node);
        setShowReplayInterface(true);
        setReplayResult(null);
    }, []);

    /**
     * Handles completion of a replay operation
     * 
     * This function is called when a replay operation completes successfully.
     * It stores the replay result and hides the replay interface.
     * 
     * @param result - The result data from the replay operation
     */
    const handleReplayComplete = useCallback((result: any) => {
        setReplayResult(result);
        setShowReplayInterface(false);
    }, []);

    /**
     * Handles closing the replay interface
     * 
     * This function is called when the user wants to close the replay interface.
     * It resets all replay-related state to clean up the UI.
     */
    const handleCloseReplay = useCallback(() => {
        setShowReplayInterface(false);
        setReplayResult(null);
        setSelectedNode(null);
    }, []);


    /**
     * Returns the connection status indicator component
     * 
     * This function renders a visual indicator showing whether the dashboard
     * is connected to the backend server for real-time updates.
     * 
     * @returns JSX element with connection status indicator
     */
    const getConnectionStatus = () => {
        if (connected) {
            return (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-md">
                    <Zap className="text-sm font-medium text-green-400"/> 
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-md">
                <Unplug className="text-sm font-medium text-red-400"/>
            </div>
        );
    };

    return (
        <div className="w-full h-screen bg-slate-950 text-white flex font-sans">
            {/* Trace List Sidebar */}
            <TraceList 
                onTraceSelect={setSelectedTraceId}
                selectedTraceId={selectedTraceId || undefined}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img 
                            src="/Axon-Web-Favicon.svg" 
                            alt="AXON" 
                            className="h-[50px] w-[50px] flex-shrink-0"
                        />
                        <img 
                            src="/AXON.svg" 
                            alt="AXON-TITLE" 
                            className="h-[80px] w-[80px] flex-shrink-0"
                        />
                      
                       
                       <div>
                        
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
                            <button 
                                onClick={() => setViewMode('flow')} 
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                    viewMode === 'flow' 
                                        ? 'bg-blue-600 text-white shadow-lg' 
                                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                                }`}
                            >
                                <Network className="w-4 h-4 inline mr-1" />
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
                                <DollarSign className="w-4 h-4 inline mr-1" />
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
                                <BarChart3 className="w-4 h-4 inline mr-1" />
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
                                <GitBranch className="w-4 h-4 inline mr-1" />
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
                                <Clock className="w-4 h-4 inline mr-1" />
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
                                <Activity className="w-4 h-4 inline mr-1" />
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
                                <AlertCircle className="w-4 h-4 inline mr-1" />
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
                                <Brain className="w-4 h-4 inline mr-1" /> 
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
                                <Play className="w-4 h-4 inline mr-1" />
                                Replay
                            </button>
                        </div>
                        <div>

                        </div>
                        {getConnectionStatus()}
                        <div>

                        </div>

                        <div className="flex items-center gap-2 bg-green-600/20 border border-green-500 px-4 py-2 rounded-lg font-bold">
                            <DollarSign className="w-4 h-4 text-green-400" />
                            <span className="text-green-400">${stats.totalCost.toFixed(4)}</span>
                        </div>
                    </div>
                </div>


                {/* Main Visualization Area */}
                <div className="flex-1 flex overflow-hidden">
                    {!selectedTraceId ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-slate-400">
                                <Network className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <h2 className="text-xl font-bold mb-2">No Trace Selected</h2>
                                <p className="text-sm">Select a trace from the sidebar to view its execution flow</p>
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-slate-400">Loading trace data...</div>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-red-400">
                                <AlertCircle className="w-16 h-16 mx-auto mb-4" />
                                <h2 className="text-xl font-bold mb-2">Error Loading Trace</h2>
                                <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Render different views based on viewMode */}
                            {viewMode === 'flow' && (
                                <div className="flex-1 relative">
                                    <ReactFlow 
                                        nodes={nodes} 
                                        edges={edges} 
                                        onNodesChange={onNodesChange} 
                                        onEdgesChange={onEdgesChange} 
                                        onNodeClick={handleNodeClick} 
                                        nodeTypes={nodeTypes} 
                                        fitView 
                                        className="bg-slate-950"
                                        panOnDrag={true}
                                        panOnScroll={true}
                                        panOnScrollSpeed={0.5}
                                        zoomOnScroll={false}
                                        zoomOnPinch={true}
                                        zoomOnDoubleClick={false}
                                        preventScrolling={false}
                                        nodesDraggable={false}
                                        nodesConnectable={false}
                                        elementsSelectable={true}
                                    >
                                        <Controls 
                                            className="react-flow-controls"
                                            style={{
                                                background: 'rgba(30, 41, 59, 0.9)',
                                                border: '1px solid #475569',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <MiniMap 
                                            className="bg-slate-800 border border-slate-700 rounded-lg" 
                                            nodeColor={(n) => {
                                                if (n.data.type?.includes('llm')) return '#3b82f6';
                                                if (n.data.type?.includes('tool')) return '#10b981';
                                                if (n.data.type?.includes('chain')) return '#a855f7';
                                                return '#64748b';
                                            }}
                                            style={{
                                                background: 'rgba(30, 41, 59, 0.9)',
                                                border: '1px solid #475569'
                                            }}
                                        />
                                        <Background 
                                            color="#1e293b" 
                                            gap={20} 
                                            size={1}
                                            style={{ opacity: 0.3 }}
                                        />
                                    </ReactFlow>
                                </div>
                            )}
                            
                            {viewMode === 'cost' && (
                                <CostView 
                                    nodes={nodes.map(n => n.data)}
                                    onNodeSelect={(node) => {
                                        const reactFlowNode = nodes.find(n => n.data.id === node.id);
                                        if (reactFlowNode) {
                                            setSelectedNode(reactFlowNode);
                                            setShowReplaySidebar(true);
                                        }
                                    }}
                                    onShowProjections={() => setViewMode('projections')}
                                />
                            )}
                            
                            {viewMode === 'tools' && (
                                <ToolsView 
                                    nodes={nodes.map(n => n.data)}
                                    onNodeSelect={(node) => {
                                        const reactFlowNode = nodes.find(n => n.data.id === node.id);
                                        if (reactFlowNode) {
                                            setSelectedNode(reactFlowNode);
                                            setShowReplaySidebar(true);
                                        }
                                    }}
                                />
                            )}
                            
                            {viewMode === 'dependency' && (
                                <DependencyView 
                                    nodes={nodes.map(n => n.data)}
                                    onNodeSelect={(node) => {
                                        const reactFlowNode = nodes.find(n => n.data.id === node.id);
                                        if (reactFlowNode) {
                                            setSelectedNode(reactFlowNode);
                                            setShowReplaySidebar(true);
                                        }
                                    }}
                                />
                            )}
                            
                            {viewMode === 'timeline' && (
                                <TimelineView 
                                    nodes={nodes.map(n => n.data)} 
                                    onNodeSelect={(node: any) => {
                                        const reactFlowNode = nodes.find(n => n.data.id === node.id);
                                        if (reactFlowNode) {
                                            setSelectedNode(reactFlowNode);
                                            setShowReplaySidebar(true);
                                        }
                                    }} 
                                    selectedNode={selectedNode?.data || null}
                                />
                            )}
                            
                            {viewMode === 'projections' && (
                                <CostProjections 
                                    nodes={nodes.map(n => n.data)} 
                                    traces={[]} // TODO: Pass actual traces data
                                />
                            )}
                            
                            {viewMode === 'anomalies' && (
                                <AnomalyDetectionView 
                                    nodes={nodes.map(n => n.data)} 
                                    edges={edges}
                                    onNodeSelect={(node) => {
                                        const reactFlowNode = nodes.find(n => n.data.id === node.id);
                                        if (reactFlowNode) {
                                            handleNodeClick({} as any, reactFlowNode);
                                        }
                                    }}
                                />
                            )}
                            
                            {viewMode === 'intelligent-anomalies' && (
                                <IntelligentAnomalyView 
                                    nodes={nodes.map(n => n.data)} 
                                    edges={edges}
                                    onNodeSelect={(node) => {
                                        const reactFlowNode = nodes.find(n => n.data.id === node.id);
                                        if (reactFlowNode) {
                                            handleNodeClick({} as any, reactFlowNode);
                                        }
                                    }}
                                />
                            )}
                            
                            {viewMode === 'replay' && (
                                <div className="flex-1 bg-slate-950 p-6 overflow-auto">
                                    <div className="max-w-4xl mx-auto">
                                        <div className="mb-8">
                                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                                                <Play className="w-6 h-6 text-cyan-400" />
                                                Replay & Experimentation
                                            </h2>
                                            <p className="text-slate-400">
                                                Time-travel debugging for AI agents. Select a node to replay execution from that point with modifications.
                                            </p>
                                        </div>
                                        
                                        {!selectedNode ? (
                                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
                                                <Play className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                                                <h3 className="text-xl font-bold text-white mb-2">Select a Node to Replay</h3>
                                                <p className="text-slate-400 mb-4">
                                                    Click on any node in the flow view to start replaying from that point.
                                                </p>
                                                <button
                                                    onClick={() => setViewMode('flow')}
                                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-md transition-colors"
                                                >
                                                    Go to Flow View
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                                    <h3 className="text-lg font-semibold text-white mb-2">Selected Node</h3>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1">
                                                            <div className="text-white font-medium">{selectedNode.data.label}</div>
                                                            <div className="text-sm text-slate-400">
                                                                {selectedNode.data.type} • {selectedNode.data.toolName || 'No tool'}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleReplayNode(selectedNode)}
                                                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-md transition-colors flex items-center gap-2"
                                                            >
                                                                <Play className="w-4 h-4" />
                                                                Start Replay
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedNode(null)}
                                                                className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
                                                            >
                                                                Clear
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                                    <h3 className="text-lg font-semibold text-white mb-3">Replay Features</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <h4 className="font-medium text-slate-300">Modifications</h4>
                                                            <ul className="text-sm text-slate-400 space-y-1">
                                                                <li>• Change prompts and system instructions</li>
                                                                <li>• Override tool responses</li>
                                                                <li>• Switch between different models</li>
                                                                <li>• Modify context variables</li>
                                                            </ul>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h4 className="font-medium text-slate-300">Safety Features</h4>
                                                            <ul className="text-sm text-slate-400 space-y-1">
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
                            
                            {/* Legend - only show in flow view */}
                            {viewMode === 'flow' && (
                                <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-4 z-10">
                                    <div className="font-bold text-sm mb-3">Legend</div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                                            <span>LLM Call</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-green-500"></div>
                                            <span>Tool Call</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-purple-500"></div>
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
                    <div className="fixed right-0 top-0 h-full w-96 z-40">
                        <ReplaySidebar
                            selectedNode={selectedNode ? {
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
                                selectedAlternative: selectedNode.data?.selectedAlternative,
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
                                performance: selectedNode.data?.performance
                            } : null}
                            replayState={replayState}
                            onPlayPause={() => setReplayState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                            onSeek={(time) => setReplayState(prev => ({ ...prev, currentTime: time }))}
                            onSpeedChange={(speed) => setReplayState(prev => ({ ...prev, speed }))}
                            onReset={() => setReplayState(prev => ({ ...prev, currentTime: 0, isPlaying: false }))}
                            onClose={() => setShowReplaySidebar(false)}
                            onNodeClick={(nodeId) => {
                                const node = nodes.find(n => n.id === nodeId);
                                if (node) {
                                    handleNodeClick({} as any, node);
                                }
                            }}
                            nodes={nodes.map(n => ({
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
                                performance: n.data?.performance
                            }))}
                        />
                    </div>
                )}
                
                {/* Replay Interface Overlay */}
                {showReplayInterface && selectedNode && traceData && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="w-full max-w-4xl max-h-[90vh] overflow-auto">
                            <ReplayInterface
                                selectedNode={selectedNode.data}
                                trace={traceData}
                                onReplayComplete={handleReplayComplete}
                                onClose={handleCloseReplay}
                            />
                        </div>
                    </div>
                )}
                
                {/* Replay Results Overlay */}
                {replayResult && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="w-full max-w-4xl max-h-[90vh] overflow-auto">
                            <ReplayResults
                                result={replayResult}
                                originalTrace={traceData}
                                onClose={handleCloseReplay}
                                onStartNewReplay={() => {
                                    setReplayResult(null);
                                    if (selectedNode) {
                                        setShowReplayInterface(true);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
                
                {/* Footer Stats */}
                <div className="bg-slate-900 border-t border-slate-700 p-3">
                    <div className="grid grid-cols-5 gap-4 text-center text-sm">
                        <div>
                            <div className="text-xs text-slate-400 mb-1">LLM Calls</div>
                            <div className="text-lg font-bold text-blue-400">{stats.llmCount}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 mb-1">Tool Calls</div>
                            <div className="text-lg font-bold text-green-400">{stats.toolCount}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 mb-1">Total Cost</div>
                            <div className="text-lg font-bold text-green-400">${stats.totalCost.toFixed(4)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 mb-1">Avg Latency</div>
                            <div className="text-lg font-bold">{(stats.avgLatency / 1000).toFixed(2)}s</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 mb-1">Status</div>
                            <div className="text-lg font-bold text-yellow-400">
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
