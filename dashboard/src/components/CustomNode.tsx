import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { DollarSign, Clock, Zap, Hash } from 'lucide-react';

// Utility function to determine colors based on node type
const getTypeColor = (type) => {
    switch (type) {
        case "llm_start":
        case "llm_end":
        case "llm":
            return {
                border: "border-blue-500",
                bg: "bg-blue-500/10",
                text: "text-blue-400",
                typeLabel: "LLM"
            };
        case "tool_start":
        case "tool_end":
        case "tool":
            return {
                border: "border-green-500",
                bg: "bg-green-500/10",
                text: "text-green-400",
                typeLabel: "TOOL"
            };
        case "chain_start":
        case "chain_end":
        case "decision":
            return {
                border: "border-purple-500",
                bg: "bg-purple-500/10",
                text: "text-purple-400",
                typeLabel: "DECISION"
            };
        default:
            return {
                border: "border-slate-500",
                bg: "bg-slate-500/10",
                text: "text-slate-400",
                typeLabel: type?.toUpperCase() || "STEP"
            };
    }
};

// Utility function to format step names
const formatStepName = (label, type, data) => {
    if (label && !label.startsWith('Step ')) {
        return label;
    }
    
    switch (type) {
        case "llm_start":
            return "LLM Processing";
        case "llm_end":
            return "LLM Response";
        case "tool_start":
            return data.toolName ? `${data.toolName} Call` : "Tool Execution";
        case "tool_end":
            return data.toolName ? `${data.toolName} Result` : "Tool Complete";
        case "chain_start":
            return "Process Start";
        case "chain_end":
            return "Process Complete";
        default:
            return label || "Processing Step";
    }
};

const CustomNode = ({ data, selected }: NodeProps) => {
    const colors = getTypeColor(data.type);
    const stepName = formatStepName(data.label, data.type, data);
    const cost = data.cost || 0;
    const latency = data.latency || 0;
    const tokens = data.tokens || { input: 0, output: 0, total: 0 };

    return (
        <>
            {/* Handle for incoming connections */}
            <Handle type="target" position={Position.Top} className="!bg-slate-500 w-2 h-2" />
            
            {/* Node Container */}
            <div
                className={`
                    px-4 py-3 rounded-lg border-2 ${colors.border} ${colors.bg} bg-slate-800 w-56
                    transition-all duration-150
                    ${selected ? "ring-2 ring-blue-400 shadow-lg shadow-blue-500/50 scale-105" : ""}
                    ${data.status === "running" ? "ring-2 ring-yellow-400 animate-pulse" : ""}
                    ${data.hasLoop ? "ring-2 ring-red-500" : ""}
                `}
            >
                {/* Step Name */}
                <div className="font-bold text-sm mb-2 text-center text-slate-100 leading-tight">
                    {stepName}
                </div>
                
                {/* Step Type */}
                <div
                    className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text} text-center mb-3 font-bold`}
                >
                    {colors.typeLabel}
                </div>
                
                {/* Metrics */}
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
                    
                    {/* Tool-specific info */}
                    {data.toolName && data.type.includes('tool') && (
                        <div className="text-xs text-center text-slate-300 mt-2 pt-2 border-t border-slate-600">
                            <div className="font-medium">{data.toolName}</div>
                            {data.toolInput && (
                                <div className="text-slate-400 truncate" title={data.toolInput}>
                                    Input: {data.toolInput}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Loop indicator */}
                {data.hasLoop && (
                    <div className="mt-2 text-xs text-red-400 text-center font-bold">
                        ▲ Loop
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
