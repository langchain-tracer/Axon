import React, { useState, useMemo, useCallback } from "react";
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
    Zap,
    Network,
    X,
    Play,
    BarChart3,
    GitBranch,
    Filter,
} from "lucide-react";

import { TimelineView, AnalyticsView } from "./AnalyticsComponents";
import CustomNode from "./CustomNode";
import CostView from "./CostView";
import ToolsView from "./ToolsView";
import DependencyView from "./DependencyView";

type ViewMode = 'flow' | 'timeline' | 'cost' | 'tools' | 'dependency';

// --- MOCK DATA ---
const baseTime = Date.now();
const initialRawNodes = [
    { id: "1", label: "Initial Query", type: "llm", cost: 0.0023, tokens: { input: 150, output: 50 }, latency: 1200, status: "complete", timestamp: baseTime, prompt: "What is the weather in San Francisco?", response: "I'll check the weather for you.", position: { x: 400, y: 50 } },
    { id: "2", label: "Weather API Call", type: "tool", cost: 0.0001, latency: 450, status: "complete", timestamp: baseTime + 1200, toolParams: { location: "San Francisco" }, position: { x: 200, y: 200 } },
    { id: "3", label: "Parse Response", type: "decision", cost: 0.0008, tokens: { input: 200, output: 100 }, latency: 800, status: "complete", timestamp: baseTime + 1650, position: { x: 600, y: 200 } },
    { id: "4", label: "Format Output", type: "llm", cost: 0.0042, tokens: { input: 300, output: 250 }, latency: 1500, status: "complete", timestamp: baseTime + 2450, prompt: "Format the weather data nicely", response: "The weather in San Francisco is 68°F and sunny.", position: { x: 400, y: 350 } },
    { id: "5", label: "Save to Cache", type: "tool", cost: 0.0001, latency: 200, status: "running", timestamp: baseTime + 3950, position: { x: 250, y: 500 } },
    { id: "6", label: "Log Analytics", type: "tool", cost: 0.0001, latency: 150, status: "pending", timestamp: baseTime + 4150, hasLoop: true, position: { x: 550, y: 500 } }
];

const initialRawEdges = [
    { from: "1", to: "2" }, { from: "1", to: "3" }, { from: "2", to: "4" },
    { from: "3", to: "4" }, { from: "4", to: "5" }, { from: "4", to: "6" }
];
// --- END MOCK DATA ---

// --- DATA TRANSFORMATION FOR REACT FLOW ---
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

const getStepType = (node: any): string => {
    switch (node.type) {
        case 'llm_start':
        case 'llm_end':
            return 'LLM';
        case 'tool_start':
        case 'tool_end':
            return 'TOOL';
        case 'chain_start':
        case 'chain_end':
            return 'DECISION';
        default:
            return 'STEP';
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

const transformToReactFlowNodes = (rawNodes: any[]): Node[] =>
    rawNodes.map(node => ({
        id: node.id,
        type: 'custom',
        position: node.position || { x: 0, y: 0 },
        data: {
            ...node,
            label: generateStepName(node),
            type: getStepType(node),
            cost: calculateCost(node),
            latency: node.latency || 0,
            status: node.status || 'complete',
            // Add token information if available
            tokens: node.tokens || { input: 0, output: 0 },
            // Add tool-specific data
            toolName: node.toolName,
            toolInput: node.toolInput,
            toolOutput: node.toolOutput,
            // Add prompt/response data
            prompt: node.prompt,
            response: node.response
        }
    }));

const transformToReactFlowEdges = (rawEdges: any[], rawNodes: any[]): Edge[] => {
    const nodeMap = new Map(rawNodes.map(n => [n.id, n]));
    return rawEdges.map((edge, i) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        const typeColor = sourceNode?.type === 'llm' ? '#3b82f6' : sourceNode?.type === 'tool' ? '#10b981' : '#a855f7';
        
        return {
            id: edge.id || `e${edge.source}-${edge.target}-${i}`,
            source: edge.source,
            target: edge.target,
            type: 'smoothstep',
            animated: targetNode?.status === 'running',
            style: { stroke: typeColor, strokeWidth: 2 }
        };
    });
};

const initialNodes = transformToReactFlowNodes(initialRawNodes);
const initialEdges = transformToReactFlowEdges(initialRawEdges, initialRawNodes);

const AgentTraceVisualizerContent = () => {
    const [viewMode, setViewMode] = useState<ViewMode>("flow");
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const { setCenter } = useReactFlow();

    const [sidebarView, setSidebarView] = useState("details");
    const [editedPrompt, setEditedPrompt] = useState("");
    const [replayResults, setReplayResults] = useState<any>(null);

    const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

    const stats = useMemo(() => {
        const rawNodes = nodes.map(n => n.data);
        const totalLatency = rawNodes.reduce((sum, n) => sum + n.latency, 0);
        return {
            totalCost: rawNodes.reduce((sum, n) => sum + n.cost, 0),
            totalNodes: nodes.length,
            llmCount: rawNodes.filter((n) => n.type?.includes("llm")).length,
            toolCount: rawNodes.filter((n) => n.type?.includes("tool")).length,
            avgLatency: nodes.length > 0 ? totalLatency / nodes.length : 0,
        }
    }, [nodes]);

    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        setEditedPrompt(node.data.prompt || "");
        setSidebarView("details");
        setReplayResults(null);
    }, []);
    
    const handleAnalyticsNodeSelect = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setSelectedNode(node);
            setViewMode("flow");
            const x = node.position.x + (node.width ?? 0) / 2;
            const y = node.position.y + (node.height ?? 0) / 2;
            setCenter(x, y, { zoom: 1.2, duration: 800 });
        }
    }, [nodes, setCenter]);

    const handleReplay = () => {
        if (!selectedNode) return;
        setReplayResults({
            originalCost: selectedNode.data.cost,
            newCost: selectedNode.data.cost * 0.7,
            nodesAffected: 5,
            estimatedTime: 3.2
        });
    };
    
    const selectedNodeData = selectedNode?.data;

    return (
        <div className="w-full h-screen bg-slate-950 text-white flex flex-col font-sans">
            <div className="bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-blue-400 text-2xl">🌐</span>
                    <h1 className="text-xl font-bold">Agent Trace Visualizer</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-2 bg-red-500 p-2">
                        <button 
                            onClick={() => setViewMode('flow')} 
                            className="px-4 py-2 bg-blue-600 text-white rounded font-bold"
                        >
                            FLOW
                        </button>
                        <button 
                            onClick={() => setViewMode('cost')} 
                            className="px-4 py-2 bg-green-600 text-white rounded font-bold"
                        >
                            COST
                        </button>
                        <button 
                            onClick={() => setViewMode('tools')} 
                            className="px-4 py-2 bg-purple-600 text-white rounded font-bold"
                        >
                            TOOLS
                        </button>
                        <button 
                            onClick={() => setViewMode('dependency')} 
                            className="px-4 py-2 bg-orange-600 text-white rounded font-bold"
                        >
                            DEPENDENCY
                        </button>
                        <button 
                            onClick={() => setViewMode('timeline')} 
                            className="px-4 py-2 bg-pink-600 text-white rounded font-bold"
                        >
                            TIMELINE
                        </button>
                    </div>
                    <div className="flex items-center gap-2 bg-green-600/20 border border-green-500 px-4 py-2 rounded-lg font-bold">
                        <span className="text-green-400">💰</span>
                        <span className="text-green-400">${stats.totalCost > 0.0001 ? stats.totalCost.toFixed(4) : stats.totalCost.toFixed(6)}</span>
                    </div>
                </div>
            </div>
            
            {/* DEBUG: Current view mode */}
            <div className="bg-yellow-500 text-black p-2 text-center font-bold">
                CURRENT VIEW MODE: {viewMode.toUpperCase()}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {viewMode === "timeline" && <TimelineView nodes={nodes.map(n => n.data)} onNodeSelect={handleAnalyticsNodeSelect} />}
                {viewMode === "cost" && <CostView nodes={nodes.map(n => n.data)} onNodeSelect={handleAnalyticsNodeSelect} />}
                {viewMode === "tools" && <ToolsView nodes={nodes.map(n => n.data)} onNodeSelect={handleAnalyticsNodeSelect} />}
                {viewMode === "dependency" && <DependencyView nodes={nodes.map(n => n.data)} onNodeSelect={handleAnalyticsNodeSelect} />}
                {viewMode === "flow" && (
                    <>
                        <div className="flex-1 relative">
                            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={handleNodeClick} nodeTypes={nodeTypes} fitView className="bg-slate-950">
                                <Controls className="react-flow-controls" />
                                <MiniMap className="bg-slate-800 border border-slate-700" nodeColor={(n) => n.data.type === 'llm' ? '#3b82f6' : n.data.type === 'tool' ? '#10b981' : '#a855f7'} />
                                <Background color="#334155" gap={16} />
                            </ReactFlow>
                            <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-4 z-10">
                                <div className="font-bold text-sm mb-3">Legend</div>
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500"></div><span>LLM Call</span></div>
                                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-500"></div><span>Tool Call</span></div>
                                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-purple-500"></div><span>Decision</span></div>
                                </div>
                            </div>
                        </div>
                        {selectedNodeData && (
                           <div className="w-96 bg-slate-800 border-l border-slate-700 overflow-y-auto flex flex-col">
                                <div className="p-4 border-b border-slate-700">
                                  <div className="flex items-center justify-between mb-3">
                                      <h3 className="font-bold text-lg">{selectedNodeData.label}</h3>
                                      <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-700 rounded transition-colors"><X className="w-4 h-4" /></button>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => setSidebarView("details")} className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${sidebarView === "details" ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"}`}>Details</button>
                                      <button onClick={() => setSidebarView("replay")} className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${sidebarView === "replay" ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"}`}>Replay</button>
                                  </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                {sidebarView === 'details' ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            <div className="bg-slate-900 rounded-lg p-3"><div className="text-xs text-slate-400 mb-1">Latency</div><div className="text-lg font-bold">{(selectedNodeData.latency / 1000).toFixed(2)}s</div></div>
                                            <div className="bg-slate-900 rounded-lg p-3"><div className="text-xs text-slate-400 mb-1">Cost</div><div className="text-lg font-bold text-green-400">${selectedNodeData.cost.toFixed(4)}</div></div>
                                        </div>
                                        {selectedNodeData.prompt && <div className="mb-4"><div className="font-bold text-sm mb-2">Prompt</div><pre className="bg-slate-900 rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto border border-slate-700 whitespace-pre-wrap">{selectedNodeData.prompt}</pre></div>}
                                        {selectedNodeData.response && <div className="mb-4"><div className="font-bold text-sm mb-2">Response</div><pre className="bg-slate-900 rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto border border-slate-700 whitespace-pre-wrap">{selectedNodeData.response}</pre></div>}
                                    </>
                                ) : (
                                    <>
                                        <h4 className="text-lg font-bold mb-4 text-blue-400">Replay Studio</h4>
                                        {selectedNodeData.prompt && <div><div className="text-sm font-bold mb-2">Edit Prompt</div><textarea value={editedPrompt} onChange={(e) => setEditedPrompt(e.target.value)} className="w-full bg-slate-900 rounded-lg p-3 font-mono text-xs h-40 border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" /></div>}
                                        {replayResults && <div className="bg-green-900/20 border-2 border-green-500 rounded-lg p-4 my-4"><div className="text-sm font-bold mb-3 text-green-400 flex items-center gap-2"><Zap className="w-4 h-4" />Replay Results</div><div className="flex justify-between text-sm"><span className="text-slate-300">New Cost:</span><span className="font-bold text-green-400">${replayResults.newCost.toFixed(4)}</span></div></div>}
                                        <button onClick={handleReplay} className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"><Play className="w-5 h-5" />{replayResults ? "Replay Again" : "Start Replay"}</button>
                                    </>
                                )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className="bg-slate-900 border-t border-slate-700 p-3">
                <div className="grid grid-cols-5 gap-4 text-center text-sm">
                    <div><div className="text-xs text-slate-400 mb-1">LLM Calls</div><div className="text-lg font-bold text-blue-400">{stats.llmCount}</div></div>
                    <div><div className="text-xs text-slate-400 mb-1">Tool Calls</div><div className="text-lg font-bold text-green-400">{stats.toolCount}</div></div>
                    <div><div className="text-xs text-slate-400 mb-1">Total Cost</div><div className="text-lg font-bold text-green-400">${stats.totalCost.toFixed(4)}</div></div>
                    <div><div className="text-xs text-slate-400 mb-1">Avg Latency</div><div className="text-lg font-bold">{(stats.avgLatency / 1000).toFixed(2)}s</div></div>
                    <div><div className="text-xs text-slate-400 mb-1">Status</div><div className="text-lg font-bold text-yellow-400">Running</div></div>
                </div>
            </div>
        </div>
    );
};

const AgentTraceVisualizer = () => (
    <ReactFlowProvider>
        <AgentTraceVisualizerContent />
    </ReactFlowProvider>
);

export default AgentTraceVisualizer;