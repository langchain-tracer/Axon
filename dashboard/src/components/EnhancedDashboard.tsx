// // Example integration of all features into the main dashboard
// // This shows how to use layouts, anomaly detection, search, export, etc.

// import React, { useCallback, useState, useMemo, useEffect } from 'react';
// import ReactFlow, {
//   Node,
//   Edge,
//   Controls,
//   Background,
//   MiniMap,
//   useNodesState,
//   useEdgesState,
//   useReactFlow,
// } from 'reactflow';
// import 'reactflow/dist/style.css';
// import {
//   Search,
//   Download,
//   Filter,
//   Layers,
//   Keyboard,
//   ArrowLeft,
// } from 'lucide-react';

// // Import utilities
// import { applyLayout, LayoutType } from './LayoutAlgorithms';
// import { detectAllAnomalies } from './AnomalyDetection';
// import {
//   searchNodes,
//   filterNodes,
//   calculateStatistics,
//   exportToJSON,
//   exportToCSV,
//   exportGraphAsImage,
//   downloadFile,
//   setupKeyboardShortcuts,
//   FilterCriteria,
// } from './UtilityFunctions';

// // ============================================================================
// // MAIN ENHANCED COMPONENT
// // ============================================================================

// const EnhancedDashboard: React.FC = () => {
//   const [nodes, setNodes, onNodesChange] = useNodesState(generateMockNodes());
//   const [edges, setEdges, onEdgesChange] = useEdgesState(generateMockEdges());
//   const [selectedNode, setSelectedNode] = useState<Node | null>(null);
//   const [layoutType, setLayoutType] = useState<LayoutType>('dagre');
  
//   // UI state
//   const [showFilters, setShowFilters] = useState(false);
//   const [showSearch, setShowSearch] = useState(false);
//   const [showExportMenu, setShowExportMenu] = useState(false);
//   const [showLayoutMenu, setShowLayoutMenu] = useState(false);
//   const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
//   // Search & Filter
//   const [searchQuery, setSearchQuery] = useState('');
//   const [filters, setFilters] = useState<FilterCriteria>({
//     types: ['llm', 'tool', 'decision'],
//     minCost: 0,
//     maxCost: 10,
//   });

//   const { fitView, zoomIn, zoomOut } = useReactFlow();

//   // Calculate anomalies
//   const anomalies = useMemo(() => {
//     return detectAllAnomalies(nodes, {
//       config: {
//         loopThreshold: 3,
//         costSpikeMultiplier: 3,
//       },
//       budgets: {
//         time: 60000, // 60 seconds
//         cost: 5.0,   // $5
//       },
//     });
//   }, [nodes]);

//   // Mark nodes with anomalies
//   useEffect(() => {
//     const nodesWithAnomalies = nodes.map(node => ({
//       ...node,
//       data: {
//         ...node.data,
//         hasAnomaly: anomalies.some(a => a.nodeId === node.id),
//         anomalyType: anomalies.find(a => a.nodeId === node.id)?.type,
//       },
//     }));
    
//     setNodes(nodesWithAnomalies);
//   }, [anomalies]);

//   // Filter and search nodes
//   const visibleNodes = useMemo(() => {
//     let filtered = filterNodes(nodes, filters);
    
//     if (searchQuery) {
//       filtered = searchNodes(filtered, searchQuery, {
//         searchInPrompts: true,
//         searchInResponses: true,
//         searchInParams: true,
//       });
//     }
    
//     return filtered;
//   }, [nodes, filters, searchQuery]);

//   // Calculate statistics
//   const stats = useMemo(() => calculateStatistics(nodes), [nodes]);

//   // Handle layout change
//   const handleLayoutChange = useCallback((type: LayoutType) => {
//     setLayoutType(type);
//     const layoutedNodes = applyLayout(type, nodes, edges);
//     setNodes(layoutedNodes);
//     setTimeout(() => fitView({ duration: 300 }), 50);
//   }, [nodes, edges, setNodes, fitView]);

//   // Handle export
//   const handleExport = useCallback((format: 'json' | 'csv' | 'png' | 'svg') => {
//     switch (format) {
//       case 'json':
//         const jsonData = exportToJSON(nodes, edges, { includeMetadata: true });
//         downloadFile(jsonData, `trace-${Date.now()}.json`, 'application/json');
//         break;
//       case 'csv':
//         const csvData = exportToCSV(nodes);
//         downloadFile(csvData, `trace-${Date.now()}.csv`, 'text/csv');
//         break;
//       case 'png':
//       case 'svg':
//         exportGraphAsImage(format, `trace-${Date.now()}.${format}`);
//         break;
//     }
//     setShowExportMenu(false);
//   }, [nodes, edges]);

//   // Setup keyboard shortcuts
//   useEffect(() => {
//     return setupKeyboardShortcuts({
//       onSearch: () => setShowSearch(true),
//       onExport: () => setShowExportMenu(true),
//       onZoomIn: () => zoomIn({ duration: 300 }),
//       onZoomOut: () => zoomOut({ duration: 300 }),
//       onFitView: () => fitView({ duration: 300 }),
//       onToggleFilters: () => setShowFilters(prev => !prev),
//     });
//   }, [zoomIn, zoomOut, fitView]);

//   return (
//     <div className="w-full h-screen bg-slate-950 text-white flex flex-col">
//       {/* Top Bar */}
//       <div className="bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
//         <div className="flex items-center gap-4">
//           <h1 className="text-xl font-bold">Agent Trace Visualizer</h1>
          
//           {/* Stats Display */}
//           <div className="flex items-center gap-4 text-sm">
//             <div className="px-3 py-1 bg-slate-800 rounded">
//               <span className="text-slate-400">Nodes:</span>
//               <span className="ml-2 font-bold">{stats.nodeCount}</span>
//             </div>
//             <div className="px-3 py-1 bg-slate-800 rounded">
//               <span className="text-slate-400">Cost:</span>
//               <span className="ml-2 font-bold text-green-400">${stats.totalCost.toFixed(4)}</span>
//             </div>
//             {anomalies.length > 0 && (
//               <div className="px-3 py-1 bg-red-900/30 border border-red-500 rounded">
//                 <span className="text-red-400 font-bold">{anomalies.length} Anomalies</span>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Actions */}
//         <div className="flex items-center gap-2">
//           {/* Search Button */}
//           <button
//             onClick={() => setShowSearch(!showSearch)}
//             className={`p-2 rounded-lg transition-colors ${
//               showSearch ? 'bg-blue-600' : 'hover:bg-slate-700'
//             }`}
//             title="Search (Ctrl+F)"
//           >
//             <Search className="w-5 h-5" />
//           </button>

//           {/* Layout Menu */}
//           <div className="relative">
//             <button
//               onClick={() => setShowLayoutMenu(!showLayoutMenu)}
//               className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
//               title="Change Layout"
//             >
//               <Layers className="w-5 h-5" />
//             </button>
            
//             {showLayoutMenu && (
//               <div className="absolute top-12 right-0 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-2 w-48 z-50">
//                 {(['dagre', 'timeline', 'cost', 'type-grouped', 'circular'] as LayoutType[]).map(type => (
//                   <button
//                     key={type}
//                     onClick={() => handleLayoutChange(type)}
//                     className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
//                       layoutType === type
//                         ? 'bg-blue-600'
//                         : 'hover:bg-slate-700'
//                     }`}
//                   >
//                     {type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
//                   </button>
//                 ))}
//               </div>
//             )}
//           </div>

//           {/* Filter Button */}
//           <button
//             onClick={() => setShowFilters(!showFilters)}
//             className={`p-2 rounded-lg transition-colors ${
//               showFilters ? 'bg-blue-600' : 'hover:bg-slate-700'
//             }`}
//             title="Filters (Ctrl+K)"
//           >
//             <Filter className="w-5 h-5" />
//           </button>

//           {/* Export Menu */}
//           <div className="relative">
//             <button
//               onClick={() => setShowExportMenu(!showExportMenu)}
//               className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
//               title="Export (Ctrl+E)"
//             >
//               <Download className="w-5 h-5" />
//             </button>
            
//             {showExportMenu && (
//               <div className="absolute top-12 right-0 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-2 w-40 z-50">
//                 <button
//                   onClick={() => handleExport('json')}
//                   className="w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-700 transition-colors"
//                 >
//                   Export JSON
//                 </button>
//                 <button
//                   onClick={() => handleExport('csv')}
//                   className="w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-700 transition-colors"
//                 >
//                   Export CSV
//                 </button>
//                 <button
//                   onClick={() => handleExport('png')}
//                   className="w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-700 transition-colors"
//                 >
//                   Export PNG
//                 </button>
//                 <button
//                   onClick={() => handleExport('svg')}
//                   className="w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-700 transition-colors"
//                 >
//                   Export SVG
//                 </button>
//               </div>
//             )}
//           </div>

//           {/* Keyboard Help */}
//           <button
//             onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
//             className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
//             title="Keyboard Shortcuts"
//           >
//             <Keyboard className="w-5 h-5" />
//           </button>
//         </div>
//       </div>

//       {/* Search Bar */}
//       {showSearch && (
//         <div className="bg-slate-800 border-b border-slate-700 p-4">
//           <div className="max-w-2xl mx-auto relative">
//             <input
//               type="text"
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               placeholder="Search nodes by label, prompt, response, or parameters..."
//               className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
//               autoFocus
//             />
//             <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
//           </div>
//           <div className="text-center text-sm text-slate-400 mt-2">
//             Found {visibleNodes.length} of {nodes.length} nodes
//           </div>
//         </div>
//       )}

//       {/* Main Content */}
//       <div className="flex-1 relative">
//         <ReactFlow
//           nodes={visibleNodes}
//           edges={edges}
//           onNodesChange={onNodesChange}
//           onEdgesChange={onEdgesChange}
//           onNodeClick={(_, node) => setSelectedNode(node)}
//           fitView
//           className="bg-slate-950"
//         >
//           <Background color="#334155" gap={16} />
//           <Controls className="bg-slate-800 border border-slate-700" />
//           <MiniMap className="bg-slate-800 border border-slate-700" />
//         </ReactFlow>

//         {/* Filter Sidebar */}
//         {showFilters && (
//           <div className="absolute top-0 right-0 w-80 h-full bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto z-10">
//             <div className="flex items-center justify-between mb-4">
//               <h3 className="font-bold text-lg">Filters</h3>
//               <button
//                 onClick={() => setShowFilters(false)}
//                 className="p-1 hover:bg-slate-700 rounded"
//               >
//                 <ArrowLeft className="w-5 h-5" />
//               </button>
//             </div>

//             {/* Node Types */}
//             <div className="mb-6">
//               <div className="font-bold text-sm mb-2">Node Types</div>
//               <div className="space-y-2">
//                 {['llm', 'tool', 'decision'].map(type => (
//                   <label key={type} className="flex items-center gap-2 cursor-pointer">
//                     <input
//                       type="checkbox"
//                       checked={filters.types?.includes(type)}
//                       onChange={(e) => {
//                         const newTypes = e.target.checked
//                           ? [...(filters.types || []), type]
//                           : filters.types?.filter(t => t !== type);
//                         setFilters({ ...filters, types: newTypes });
//                       }}
//                       className="w-4 h-4"
//                     />
//                     <span className="text-sm capitalize">{type}</span>
//                   </label>
//                 ))}
//               </div>
//             </div>

//             {/* Cost Range */}
//             <div className="mb-6">
//               <div className="font-bold text-sm mb-2">Cost Range</div>
//               <div className="space-y-3">
//                 <div>
//                   <label className="text-xs text-slate-400">Min: ${filters.minCost}</label>
//                   <input
//                     type="range"
//                     min="0"
//                     max="5"
//                     step="0.1"
//                     value={filters.minCost}
//                     onChange={(e) => setFilters({ ...filters, minCost: parseFloat(e.target.value) })}
//                     className="w-full"
//                   />
//                 </div>
//                 <div>
//                   <label className="text-xs text-slate-400">Max: ${filters.maxCost}</label>
//                   <input
//                     type="range"
//                     min="0"
//                     max="5"
//                     step="0.1"
//                     value={filters.maxCost}
//                     onChange={(e) => setFilters({ ...filters, maxCost: parseFloat(e.target.value) })}
//                     className="w-full"
//                   />
//                 </div>
//               </div>
//             </div>

//             {/* Anomalies Only */}
//             <div className="mb-6">
//               <label className="flex items-center gap-2 cursor-pointer">
//                 <input
//                   type="checkbox"
//                   checked={filters.hasAnomaly}
//                   onChange={(e) => setFilters({ ...filters, hasAnomaly: e.target.checked })}
//                   className="w-4 h-4"
//                 />
//                 <span className="text-sm">Show only anomalies</span>
//               </label>
//             </div>

//             {/* Reset */}
//             <button
//               onClick={() => setFilters({
//                 types: ['llm', 'tool', 'decision'],
//                 minCost: 0,
//                 maxCost: 10,
//               })}
//               className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold"
//             >
//               Reset Filters
//             </button>
//           </div>
//         )}

//         {/* Keyboard Help Modal */}
//         {showKeyboardHelp && (
//           <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
//             <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md">
//               <h3 className="text-xl font-bold mb-4">Keyboard Shortcuts</h3>
//               <div className="space-y-3 text-sm">
//                 <div className="flex justify-between">
//                   <span className="text-slate-400">Search</span>
//                   <kbd className="px-2 py-1 bg-slate-900 rounded">Ctrl+F</kbd>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-slate-400">Export</span>
//                   <kbd className="px-2 py-1 bg-slate-900 rounded">Ctrl+E</kbd>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-slate-400">Toggle Filters</span>
//                   <kbd className="px-2 py-1 bg-slate-900 rounded">Ctrl+K</kbd>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-slate-400">Zoom In</span>
//                   <kbd className="px-2 py-1 bg-slate-900 rounded">Ctrl++</kbd>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-slate-400">Zoom Out</span>
//                   <kbd className="px-2 py-1 bg-slate-900 rounded">Ctrl+-</kbd>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-slate-400">Fit View</span>
//                   <kbd className="px-2 py-1 bg-slate-900 rounded">Ctrl+0</kbd>
//                 </div>
//               </div>
//               <button
//                 onClick={() => setShowKeyboardHelp(false)}
//                 className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default EnhancedDashboard;