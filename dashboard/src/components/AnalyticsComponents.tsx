import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

// --- INLINE SVG ICONS (Replaced Lucide) ---
const DollarSignIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="12" y1="1" x2="12" y2="23"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
);
const ClockIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
);
const ZapIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
);
const TrendingUpIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
        <polyline points="16 7 22 7 22 13"></polyline>
    </svg>
);


export const TimelineView = ({ nodes, onNodeSelect }) => {
    const sortedNodes = [...nodes].sort((a, b) => a.timestamp - b.timestamp);
    const startTime = sortedNodes[0]?.timestamp || 0;
    const totalDuration = sortedNodes.length > 0 ? ((sortedNodes[sortedNodes.length - 1].timestamp - startTime) / 1000).toFixed(1) : 0;

    const timeline = sortedNodes.map((node, index) => {
        const relativeTime = ((node.timestamp - startTime) / 1000).toFixed(1);
        const duration = (node.latency / 1000).toFixed(1);
        const nextNode = sortedNodes[index + 1];
        const gap = nextNode ? ((nextNode.timestamp - node.timestamp - node.latency) / 1000).toFixed(1) : "0";
        return { node, relativeTime, duration, gap };
    });

    return (
        <div className="p-6 space-y-4 overflow-y-auto h-full w-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Timeline View</h2>
                <div className="text-sm text-slate-400">Total Duration: {totalDuration}s</div>
            </div>
            <div className="space-y-2">
                {timeline.map(({ node, relativeTime, duration, gap }) => (
                    <div key={node.id}>
                        <div className="flex items-center gap-4">
                            <div className="w-20 text-sm text-slate-400 font-mono text-right">{relativeTime}s</div>
                            <div className={`w-3 h-3 rounded-full ${node.type === "llm" ? "bg-blue-500" : node.type === "tool" ? "bg-green-500" : "bg-purple-500"}`} />
                            <div className="flex-1 bg-slate-800 rounded-lg p-4 hover:bg-slate-700 transition-colors cursor-pointer" onClick={() => onNodeSelect && onNodeSelect(node.id)}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold">{node.label}</div>
                                        <div className={`text-xs px-2 py-0.5 rounded ${node.type === "llm" ? "bg-blue-500/20 text-blue-400" : node.type === "tool" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}`}>{node.type.toUpperCase()}</div>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                        <div className="flex items-center gap-1 text-slate-400"><ClockIcon className="w-4 h-4" /><span>{duration}s</span></div>
                                        <div className="flex items-center gap-1 text-green-400"><DollarSignIcon className="w-4 h-4" /><span>${node.cost.toFixed(4)}</span></div>
                                        {node.tokens && <div className="text-slate-400 text-xs">{(node.tokens.input + node.tokens.output).toLocaleString()} tokens</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {Number(gap) > 0.1 && (
                            <div className="flex items-center gap-4 my-1">
                                <div className="w-20" />
                                <div className="w-3 flex justify-center"><div className="w-0.5 h-4 bg-slate-600" /></div>
                                <div className="text-xs text-slate-500 italic">{gap}s gap</div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AnalyticsView = ({ nodes, onNodeSelect }) => {
    const totalLatency = nodes.reduce((sum, n) => sum + n.latency, 0);
    const totalCost = nodes.reduce((sum, n) => sum + n.cost, 0);
    const stats = {
        totalCost,
        totalTokens: nodes.reduce((sum, n) => sum + ((n.tokens?.input || 0) + (n.tokens?.output || 0)), 0),
        avgLatency: nodes.length > 0 ? totalLatency / nodes.length : 0,
    };
    const costByType = ["llm", "tool", "decision"].map(type => ({
        type: `${type.charAt(0).toUpperCase() + type.slice(1)} Calls`,
        cost: nodes.filter(n => n.type === type).reduce((sum, n) => sum + n.cost, 0),
    }));
    const topExpensive = [...nodes].sort((a, b) => b.cost - a.cost).slice(0, 5).map(n => ({ id: n.id, name: n.label, cost: n.cost, percentage: ((n.cost / (stats.totalCost || 1)) * 100).toFixed(1) }));
    const tokenData = nodes.filter(n => n.tokens).map(n => ({ name: n.label, input: n.tokens.input, output: n.tokens.output }));
    const latencyData = [...nodes].sort((a, b) => a.timestamp - b.timestamp).map((n, i) => ({ step: i + 1, latency: n.latency / 1000, name: n.label }));
    
    const handleTokenBarClick = (data) => {
        if (data && data.activePayload && onNodeSelect) {
            const clickedNodeLabel = data.activePayload[0].payload.name;
            const targetNode = nodes.find(n => n.label === clickedNodeLabel);
            if (targetNode) onNodeSelect(targetNode.id);
        }
    };

    const COLORS = ["#3b82f6", "#10b981", "#a855f7"];

    return (
        <div className="p-6 space-y-8 overflow-y-auto h-full w-full">
            <h2 className="text-2xl font-bold mb-6">Cost & Performance Analytics</h2>
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700"><div className="flex items-center gap-3 mb-2"><DollarSignIcon className="w-5 h-5 text-green-400" /><div className="text-sm text-slate-400">Total Cost</div></div><div className="text-3xl font-bold text-green-400">${stats.totalCost.toFixed(4)}</div></div>
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700"><div className="flex items-center gap-3 mb-2"><TrendingUpIcon className="w-5 h-5 text-blue-400" /><div className="text-sm text-slate-400">Total Tokens</div></div><div className="text-3xl font-bold">{stats.totalTokens.toLocaleString()}</div></div>
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700"><div className="flex items-center gap-3 mb-2"><ClockIcon className="w-5 h-5 text-purple-400" /><div className="text-sm text-slate-400">Avg Latency</div></div><div className="text-3xl font-bold">{(stats.avgLatency / 1000).toFixed(2)}s</div></div>
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700"><div className="flex items-center gap-3 mb-2"><ZapIcon className="w-5 h-5 text-yellow-400" /><div className="text-sm text-slate-400">Total Nodes</div></div><div className="text-3xl font-bold">{nodes.length}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold mb-4">Cost Distribution by Type</h3>
                    <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={costByType} dataKey="cost" nameKey="type" cx="50%" cy="50%" outerRadius={100} label={(entry) => `${entry.type}: $${entry.cost.toFixed(4)}`}>{costByType.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip formatter={(value) => `$${Number(value).toFixed(4)}`} /></PieChart></ResponsiveContainer>
                </div>
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold mb-4">Most Expensive Operations</h3>
                    <div className="space-y-3">{topExpensive.map((item, index) => (<div key={index} className="cursor-pointer p-2 -m-2 rounded-lg hover:bg-slate-700/50 transition-colors" onClick={() => onNodeSelect && onNodeSelect(item.id)}><div className="flex items-center justify-between mb-1 text-sm"><span className="font-medium">{item.name}</span><span className="text-slate-400">{item.percentage}%</span></div><div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-end px-2 text-xs font-bold" style={{ width: `${item.percentage}%` }}>${item.cost.toFixed(4)}</div></div></div>))}</div>
                </div>
            </div>
            {tokenData.length > 0 && (<div className="bg-slate-800 rounded-xl p-6 border border-slate-700"><h3 className="text-lg font-bold mb-4">Token Usage Distribution</h3><ResponsiveContainer width="100%" height={300}><BarChart data={tokenData} onClick={handleTokenBarClick}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="name" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ backgroundColor: "#1e2b3b", border: "1px solid #475569" }} /><Legend /><Bar dataKey="input" fill="#3b82f6" name="Input Tokens" /><Bar dataKey="output" fill="#10b981" name="Output Tokens" /></BarChart></ResponsiveContainer></div>)}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700"><h3 className="text-lg font-bold mb-4">Latency Over Time</h3><ResponsiveContainer width="100%" height={300}><LineChart data={latencyData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="step" stroke="#94a3b8" label={{ value: "Step", position: "insideBottom", offset: -5 }} /><YAxis stroke="#94a3b8" label={{ value: "Latency (s)", angle: -90, position: "insideLeft" }} /><Tooltip contentStyle={{ backgroundColor: "#1e2b3b", border: "1px solid #475569" }} formatter={(value) => [`${Number(value).toFixed(2)}s`, "Latency"]} /><Line type="monotone" dataKey="latency" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6" }} /></LineChart></ResponsiveContainer></div>
        </div>
    );
};