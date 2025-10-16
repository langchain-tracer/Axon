import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { DollarSign, Clock } from 'lucide-react';

// Utility function to determine colors based on node type
const getTypeColor = (type) => {
    switch (type) {
        case "llm":
            return {
                border: "border-blue-500",
                bg: "bg-blue-500/10",
                text: "text-blue-400",
            };
        case "tool":
            return {
                border: "border-green-500",
                bg: "bg-green-500/10",
                text: "text-green-400",
            };
        case "decision":
            return {
                border: "border-purple-500",
                bg: "bg-purple-500/10",
                text: "text-purple-400",
            };
        default:
            return {
                border: "border-slate-500",
                bg: "bg-slate-500/10",
                text: "text-slate-400",
            };
    }
};

const CustomNode = ({ data, selected }: NodeProps) => {
    const colors = getTypeColor(data.type);

    return (
        <>
            {/* Handle for incoming connections */}
            <Handle type="target" position={Position.Top} className="!bg-slate-500 w-2 h-2" />
            
            {/* Node Container */}
            <div
                className={`
                    px-4 py-3 rounded-lg border-2 ${colors.border} ${colors.bg} bg-slate-800 w-52
                    transition-all duration-150
                    ${selected ? "ring-2 ring-blue-400 shadow-lg shadow-blue-500/50 scale-105" : ""}
                    ${data.status === "running" ? "ring-2 ring-yellow-400 animate-pulse" : ""}
                    ${data.hasLoop ? "ring-2 ring-red-500" : ""}
                `}
            >
                <div className="font-bold text-sm mb-2 text-center text-slate-100">{data.label}</div>
                <div
                    className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text} text-center mb-2 font-bold`}
                >
                    {data.type.toUpperCase()}
                </div>
                <div className="text-xs space-y-1">
                    <div className="flex items-center justify-center gap-1 text-green-400">
                        <DollarSign className="w-3 h-3" />
                        <span>${data.cost.toFixed(4)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{(data.latency / 1000).toFixed(2)}s</span>
                    </div>
                </div>
                {data.hasLoop && (
                    <div className="mt-2 text-xs text-red-400 text-center font-bold">
                        ⚠️ Loop
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
