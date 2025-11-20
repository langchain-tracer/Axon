import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  DollarSign, 
  Clock, 
  Zap, 
  Hash, 
  Brain, 
  Wrench, 
  GitBranch, 
  Activity, 
  AlertCircle, 
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  MessageSquare,
  Function,
  Settings
} from 'lucide-react';

// Enhanced utility function for decision graph node types
const getTypeColor = (type) => {
    switch (type) {
        // LLM operations (LangChain & OpenAI)
        case "llm_start":
        case "llm_end":
        case "llm":
        case "llm_call":
        case "function_call_start":
        case "function_call_end":
        case "conversation_turn":
            return {
                border: "border-blue-500",
                bg: "bg-blue-500/10",
                text: "text-blue-400",
                typeLabel: "LLM",
                icon: Brain
            };
        
        // Tool operations (LangChain & OpenAI)
        case "tool_start":
        case "tool_end":
        case "tool":
        case "tool_invocation":
        case "tool_selection":
            return {
                border: "border-green-500",
                bg: "bg-green-500/10",
                text: "text-green-400",
                typeLabel: "TOOL",
                icon: Wrench
            };
        
        // Decision points
        case "decision_point":
        case "decision":
            return {
                border: "border-amber-500",
                bg: "bg-amber-500/10",
                text: "text-amber-400",
                typeLabel: "DECISION",
                icon: GitBranch
            };
        
        // State transitions
        case "state_transition":
            return {
                border: "border-purple-500",
                bg: "bg-purple-500/10",
                text: "text-purple-400",
                typeLabel: "STATE",
                icon: Activity
            };
        
        // Reasoning steps
        case "reasoning_step":
            return {
                border: "border-red-500",
                bg: "bg-red-500/10",
                text: "text-red-400",
                typeLabel: "REASONING",
                icon: Zap
            };
        
        // Error handling
        case "error_handling":
            return {
                border: "border-red-600",
                bg: "bg-red-600/10",
                text: "text-red-500",
                typeLabel: "ERROR",
                icon: AlertCircle
            };
        
        // Chain operations
        case "chain_start":
        case "chain_end":
        case "chain_step":
        case "chain":  // Add the actual "chain" type from backend
            return {
                border: "border-purple-500",
                bg: "bg-purple-500/10",
                text: "text-purple-400",
                typeLabel: "DECISION",
                icon: GitBranch
            };
        
        // Validation
        case "validation":
            return {
                border: "border-cyan-500",
                bg: "bg-cyan-500/10",
                text: "text-cyan-400",
                typeLabel: "VALIDATION",
                icon: CheckCircle
            };
        
        // Optimization
        case "optimization":
            return {
                border: "border-lime-500",
                bg: "bg-lime-500/10",
                text: "text-lime-400",
                typeLabel: "OPTIMIZATION",
                icon: Zap
            };
        
        // User interaction
        case "user_interaction":
            return {
                border: "border-pink-500",
                bg: "bg-pink-500/10",
                text: "text-pink-400",
                typeLabel: "USER",
                icon: MessageSquare
            };
        
        default:
            return {
                border: "border-slate-500",
                bg: "bg-slate-500/10",
                text: "text-slate-400",
                typeLabel: type?.toUpperCase() || "STEP",
                icon: CheckCircle
            };
    }
};

// Utility function to format step names
const formatStepName = (label, type, data) => {
    if (label && !label.startsWith('Step ')) {
        return label;
    }
    
    // OpenAI-specific naming
    if (data.functionName) {
        return data.functionName;
    }
    if (data.selectedTool?.name) {
        return `Tool: ${data.selectedTool.name}`;
    }
    if (data.type === 'conversation_turn' && data.turnNumber) {
        return `Conversation Turn #${data.turnNumber}`;
    }
    
    switch (type) {
        case "llm_start":
        case "function_call_start":
            return "LLM Processing";
        case "llm_end":
        case "function_call_end":
            return "LLM Response";
        case "tool_start":
        case "tool_selection":
            return data.toolName ? `${data.toolName} Call` : "Tool Execution";
        case "tool_end":
            return data.toolName ? `${data.toolName} Result` : "Tool Complete";
        case "conversation_turn":
            return data.turnNumber ? `Conversation Turn #${data.turnNumber}` : "Conversation Turn";
        case "chain_start":
            return "Process Start";
        case "chain_end":
            return "Process Complete";
        default:
            return label || "Processing Step";
    }
};

const CustomNode = ({ data, selected }: NodeProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const colors = getTypeColor(data.type);
    const stepName = formatStepName(data.label, data.type, data);
    const cost = data.cost || 0;
    const latency = data.latency || 0;
    const tokens = data.tokens || { input: 0, output: 0, total: 0 };
    const IconComponent = colors.icon;

    return (
        <>
            {/* Handle for incoming connections */}
            <Handle type="target" position={Position.Top} className="!bg-slate-500 w-2 h-2" />
            
            {/* Node Container */}
            <div
                className={`
                    rounded-lg border-2 ${colors.border} ${colors.bg} bg-slate-800 w-64
                    transition-all duration-150
                    ${selected ? "ring-2 ring-blue-400 shadow-lg shadow-blue-500/50 scale-105" : ""}
                    ${data.status === "running" ? "ring-2 ring-yellow-400 animate-pulse" : ""}
                    ${data.hasLoop ? "ring-2 ring-red-500" : ""}
                `}
            >
                {/* Header */}
                <div className="px-4 py-3">
                    {/* Step Name with Icon */}
                    <div className="flex items-center gap-2 mb-2">
                        <IconComponent className="w-4 h-4 text-slate-300" />
                        <div className="font-bold text-sm text-slate-100 leading-tight flex-1">
                            {stepName}
                        </div>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                    
                    {/* Step Type */}
                    <div
                        className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text} text-center mb-3 font-bold`}
                    >
                        {colors.typeLabel}
                    </div>
                    
                    {/* Key Metrics */}
                    <div className="text-xs space-y-1.5">
                        {/* Cost */}
                        <div className="flex items-center justify-center gap-1.5 text-green-400">
                            <DollarSign className="w-3 h-3" />
                            <span>${cost > 0.0001 ? cost.toFixed(4) : cost.toFixed(6)}</span>
                        </div>
                        
                        {/* Latency */}
                        <div className="flex items-center justify-center gap-1.5 text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{(latency / 1000).toFixed(2)}s</span>
                        </div>
                        
                        {/* Tokens (if available) */}
                        {tokens.total > 0 && (
                            <div className="flex items-center justify-center gap-1.5 text-blue-400">
                                <Hash className="w-3 h-3" />
                                <span>{tokens.total.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="px-4 pb-3 border-t border-slate-600">
                        {/* Decision Context */}
                        {data.decisionContext && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-300 mb-2">Decision Context</div>
                                <div className="text-xs text-slate-400 space-y-1">
                                    {data.decisionContext.previousSteps && (
                                        <div>
                                            <span className="text-slate-500">Previous:</span> {data.decisionContext.previousSteps.length} steps
                                        </div>
                                    )}
                                    {data.decisionContext.availableOptions && (
                                        <div>
                                            <span className="text-slate-500">Options:</span> {data.decisionContext.availableOptions.length}
                                        </div>
                                    )}
                                    {data.decisionContext.goals && (
                                        <div>
                                            <span className="text-slate-500">Goals:</span> {data.decisionContext.goals.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Reasoning */}
                        {data.reasoning && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-300 mb-2">Reasoning</div>
                                <div className="text-xs text-slate-400 bg-slate-700 p-2 rounded">
                                    {data.reasoning.length > 100 ? `${data.reasoning.substring(0, 100)}...` : data.reasoning}
                                </div>
                            </div>
                        )}

                        {/* Alternatives */}
                        {data.alternatives && data.alternatives.length > 0 && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-300 mb-2">Alternatives</div>
                                <div className="space-y-1">
                                    {data.alternatives.slice(0, 3).map((alt, idx) => (
                                        <div key={idx} className="text-xs text-slate-400 bg-slate-700 p-2 rounded">
                                            <div className="font-medium">{alt.option}</div>
                                            <div className="text-slate-500">Confidence: {(alt.confidence * 100).toFixed(0)}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* State Changes */}
                        {data.stateChanges && data.stateChanges.length > 0 && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-300 mb-2">State Changes</div>
                                <div className="space-y-1">
                                    {data.stateChanges.slice(0, 2).map((change, idx) => (
                                        <div key={idx} className="text-xs text-slate-400">
                                            <span className="text-slate-500">{change.key}:</span> {change.reason}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tool-specific info (LangChain & OpenAI) */}
                        {(data.toolName || data.selectedTool) && (data.type?.includes('tool') || data.type === 'tool_selection') && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-300 mb-2">Tool Details</div>
                                <div className="text-xs text-slate-400">
                                    <div className="font-medium">{data.toolName || data.selectedTool?.name}</div>
                                    {data.toolInput && (
                                        <div className="text-slate-500 mt-1 truncate" title={typeof data.toolInput === 'string' ? data.toolInput : JSON.stringify(data.toolInput)}>
                                            Input: {typeof data.toolInput === 'string' ? data.toolInput : JSON.stringify(data.toolInput).substring(0, 50)}
                                        </div>
                                    )}
                                    {data.selectedTool && (
                                        <div className="text-slate-500 mt-1">
                                            Confidence: {(data.confidence * 100).toFixed(1)}%
                                        </div>
                                    )}
                                    {data.availableTools && (
                                        <div className="text-slate-500 mt-1">
                                            Available: {data.availableTools.length} tools
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* OpenAI Function Call specific info */}
                        {data.functionName && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-300 mb-2">Function Call</div>
                                <div className="text-xs text-slate-400">
                                    <div className="font-medium">{data.functionName}</div>
                                    {data.arguments && (
                                        <div className="text-slate-500 mt-1 truncate" title={typeof data.arguments === 'string' ? data.arguments : JSON.stringify(data.arguments)}>
                                            Args: {typeof data.arguments === 'string' ? data.arguments : JSON.stringify(data.arguments).substring(0, 50)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* OpenAI Conversation Turn specific info */}
                        {data.type === 'conversation_turn' && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-300 mb-2">Conversation</div>
                                <div className="text-xs text-slate-400">
                                    {data.turnNumber && (
                                        <div>Turn: #{data.turnNumber}</div>
                                    )}
                                    {data.userMessage && (
                                        <div className="text-slate-500 mt-1 truncate" title={data.userMessage}>
                                            User: {data.userMessage}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Performance Metrics */}
                        {data.performance && (
                            <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-300 mb-2">Performance</div>
                                <div className="text-xs text-slate-400 space-y-1">
                                    {data.performance.memoryUsage && (
                                        <div>Memory: {(data.performance.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
                                    )}
                                    {data.performance.cpuTime && (
                                        <div>CPU: {data.performance.cpuTime}ms</div>
                                    )}
                                    {data.performance.cacheHit !== undefined && (
                                        <div>Cache: {data.performance.cacheHit ? 'Hit' : 'Miss'}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Loop indicator */}
                {data.hasLoop && (
                    <div className="px-4 pb-3 text-xs text-red-400 text-center font-bold">
                        ▲ Loop Detected
                    </div>
                )}
            </div>

            {/* Handle for outgoing connections */}
            <Handle type="source" position={Position.Bottom} className="!bg-slate-500 w-2 h-2" />
        </>
    );
};

// Memoize the component for performance optimization
export default memo(CustomNode);
