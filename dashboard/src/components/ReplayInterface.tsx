// import React, { useState, useEffect, useMemo } from 'react';
// import {
//   Play,
//   XCircle,
//   Settings,
//   AlertTriangle,
//   CheckCircle,
//   Zap,
//   Shield,
//   Eye,
//   EyeOff,
// } from 'lucide-react';
// import {
//   ReplayEngine,
//   ReplayModifications,
//   ReplayOptions,
//   ReplayMode,
//   SideEffect,
// } from '../utils/ReplayEngine';
// import { useReplay } from '../hooks';
// import createSocketLLMCaller from '../utils/createLLMCaller';

// interface ReplayInterfaceProps {
//   selectedNode: any;
//   trace: any; // {nodes, edges, id} OR {trace, nodes, edges, ...}
//   onReplayComplete: (result: any) => void;
//   onClose: () => void;
// }

// export default function ReplayInterface({
//   selectedNode,
//   trace,
//   onReplayComplete,
//   onClose,
// }: ReplayInterfaceProps) {
//   const replayEngine = useMemo(() => new ReplayEngine(), []);

//   const [safetyAnalysis, setSafetyAnalysis] = useState<any>(null);
//   const [modifications, setModifications] = useState<ReplayModifications>({
//     promptChanges: new Map(),
//     toolResponseOverrides: new Map(),
//     systemInstructionUpdates: new Map(),
//     contextVariableChanges: new Map(),
//     modelChanges: new Map(),
//   });

//   const [options, setOptions] = useState<ReplayOptions>({
//     mode: ReplayMode.SAFE,
//     mockExternalCalls: true,
//     useOriginalData: true,
//     confirmEachSideEffect: false,
//     maxReplayDepth: 10,
//   });

//   const [activeTab, setActiveTab] = useState<
//     'modifications' | 'options' | 'analysis'
//   >('analysis');
//   const [expandedSideEffects, setExpandedSideEffects] = useState<Set<string>>(
//     new Set()
//   );

//   const llm = useMemo(() => createSocketLLMCaller(), []);
//   const {
//     replayFromNode,
//     result: replayPacket,
//     loading: isReplaying,
//     output: replayText,
//   } = useReplay();

//   useEffect(() => {
//     if (replayPacket) onReplayComplete(replayPacket);
//   }, [replayPacket, onReplayComplete]);

//   // Normalize trace shape
//   const normalizedTrace = useMemo(() => {
//     if (!trace) return { id: undefined, nodes: [], edges: [] };
//     const topNodes = Array.isArray(trace.nodes) ? trace.nodes : [];
//     const nestedNodes =
//       trace.trace && Array.isArray(trace.trace.nodes) ? trace.trace.nodes : [];
//     const nodes = topNodes.length ? topNodes : nestedNodes;

//     const topEdges = Array.isArray(trace.edges) ? trace.edges : [];
//     const nestedEdges =
//       trace.trace && Array.isArray(trace.trace.edges) ? trace.trace.edges : [];
//     const edges = topEdges.length ? topEdges : nestedEdges;

//     const id = trace.id ?? trace.trace?.id ?? trace.traceId ?? undefined;
//     return { id, nodes, edges };
//   }, [trace]);

//   useEffect(() => {
//     if (!selectedNode || !trace) return;

//     const nodes = Array.isArray((trace as any)?.nodes)
//       ? (trace as any).nodes
//       : Array.isArray((trace as any)?.trace?.nodes)
//       ? (trace as any).trace.nodes
//       : [];

//     if (nodes.length === 0) {
//       setSafetyAnalysis(null);
//       return;
//     }

//     const analysis = replayEngine.analyzeReplaySafety(selectedNode.id, trace);
//     setSafetyAnalysis(analysis);
//     setOptions((prev) => ({ ...prev, mode: analysis.mode }));
//   }, [selectedNode, trace, replayEngine]);

//   const handleStartReplay = async () => {
//     if (!selectedNode || !trace) return;

//     let resolvedLlm: any = undefined;
//     if (options.liveMode) {
//       try {
//         resolvedLlm = await llm;
//       } catch {
//         resolvedLlm = undefined;
//       }
//     }

//     const traceId =
//       (trace as any)?.trace?.id ??
//       (trace as any)?.id ??
//       (trace as any)?.traceId ??
//       null;

//     const editedPrompt =
//       modifications.promptChanges?.get(selectedNode.id) ??
//       (selectedNode.prompts && selectedNode.prompts.length
//         ? selectedNode.prompts.join('\n\n')
//         : selectedNode.response ||
//           (typeof selectedNode.toolInput === 'string'
//             ? selectedNode.toolInput
//             : JSON.stringify(selectedNode.toolInput ?? '', null, 2)) ||
//           '');

//     const chosenModel =
//       modifications.modelChanges?.get(selectedNode.id) ||
//       selectedNode.model ||
//       'gpt-3.5-turbo';

//     const messages = [
//       { role: 'system', content: 'You are a helpful assistant.' },
//       { role: 'user', content: editedPrompt || 'No prompt provided.' },
//     ];

//     await replayFromNode(selectedNode.id, {
//       // core opts
//       mode: options.mode,
//       mockExternalCalls: options.mockExternalCalls,
//       useOriginalData: options.useOriginalData,
//       confirmEachSideEffect: options.confirmEachSideEffect,
//       maxReplayDepth: options.maxReplayDepth,

//       // live knobs
//       liveMode: options.liveMode,
//       llm: resolvedLlm,
//       temperature: options.temperature,
//       maxTokens: options.maxTokens,

//       // 🔑 replay payload (belt + suspenders)
//       traceId,
//       startNodeId: selectedNode.id, // server consumes this
//       nodeId: selectedNode.id, // some hooks/clients expect this
//       messages,
//       stream: true,
//       model: chosenModel,
//       modifiedPrompt: editedPrompt,
//     });
//   };

//   const handleModificationChange = (
//     type: keyof ReplayModifications,
//     nodeId: string,
//     value: any
//   ) => {
//     setModifications((prev) => {
//       const next = { ...prev } as any;
//       const updatedMap = new Map(next[type] as Map<string, any>);
//       updatedMap.set(nodeId, value);
//       next[type] = updatedMap;
//       return next;
//     });
//   };

//   const getMapValueOr = (
//     map: Map<string, any> | undefined,
//     key: string,
//     fallback: any
//   ) => (map && map.has(key) ? map.get(key) : fallback);

//   const getModeColor = (mode: ReplayMode) => {
//     switch (mode) {
//       case ReplayMode.SAFE:
//         return 'text-green-400 bg-green-500/20 border-green-500';
//       case ReplayMode.SIMULATION:
//         return 'text-blue-400 bg-blue-500/20 border-blue-500';
//       case ReplayMode.WARNING:
//         return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
//       case ReplayMode.BLOCKED:
//         return 'text-red-400 bg-red-500/20 border-red-500';
//       default:
//         return 'text-slate-400 bg-slate-500/20 border-slate-500';
//     }
//   };

//   const getModeIcon = (mode: ReplayMode) => {
//     switch (mode) {
//       case ReplayMode.SAFE:
//         return <CheckCircle className='w-4 h-4' />;
//       case ReplayMode.SIMULATION:
//         return <Zap className='w-4 h-4' />;
//       case ReplayMode.WARNING:
//         return <AlertTriangle className='w-4 h-4' />;
//       default:
//         return <Shield className='w-4 h-4' />;
//     }
//   };

//   const getSeverityColor = (severity: string) => {
//     switch (severity) {
//       case 'critical':
//         return 'text-red-400 bg-red-500/20 border-red-500';
//       case 'warning':
//         return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
//       case 'safe':
//         return 'text-green-400 bg-green-500/20 border-green-500';
//       default:
//         return 'text-slate-400 bg-slate-500/20 border-slate-500';
//     }
//   };

//   if (!selectedNode || !trace) {
//     return (
//       <div className='bg-slate-800 border border-slate-700 rounded-lg p-6'>
//         <div className='text-center text-slate-400'>
//           <Play className='w-12 h-12 mx-auto mb-4' />
//         </div>
//         <p className='text-center text-slate-400'>
//           Select a node to start replay
//         </p>
//       </div>
//     );
//   }

//   return (
//     <div className='bg-slate-800 border border-slate-700 rounded-lg overflow-hidden'>
//       {/* Header */}
//       <div className='p-4 border-b border-slate-700'>
//         <div className='flex items-center justify-between'>
//           <div className='flex items-center gap-3'>
//             <Play className='w-5 h-5 text-blue-400' />
//             <h3 className='text-lg font-semibold text-white'>
//               Replay &amp; Experimentation
//             </h3>
//             <div
//               className={`px-2 py-1 rounded text-xs border flex items-center gap-1 ${getModeColor(
//                 options.mode
//               )}`}
//             >
//               {getModeIcon(options.mode)}
//               {options.mode.toUpperCase()}
//             </div>
//           </div>
//           <button
//             onClick={onClose}
//             className='text-slate-400 hover:text-white transition-colors'
//           >
//             <XCircle className='w-5 h-5' />
//           </button>
//         </div>
//         <p className='text-sm text-slate-400 mt-1'>
//           Replay from:{' '}
//           <span className='text-white font-medium'>
//             {selectedNode.label || selectedNode.id}
//           </span>
//         </p>
//       </div>

//       {/* Tabs */}
//       <div className='flex border-b border-slate-700'>
//         {[
//           { id: 'analysis', label: 'Safety Analysis', icon: Shield },
//           { id: 'modifications', label: 'Modifications', icon: AlertTriangle },
//           { id: 'options', label: 'Options', icon: Settings },
//         ].map((tab) => (
//           <button
//             key={tab.id}
//             onClick={() => setActiveTab(tab.id as any)}
//             className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
//               activeTab === tab.id
//                 ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
//                 : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
//             }`}
//           >
//             <tab.icon className='w-4 h-4' />
//             {tab.label}
//           </button>
//         ))}
//       </div>

//       {/* Content */}
//       <div className='p-4 max-h-96 overflow-auto'>
//         {activeTab === 'analysis' && safetyAnalysis && (
//           <div className='space-y-4'>
//             <div className='bg-slate-700/50 p-4 rounded-lg'>
//               <h4 className='font-semibold text-white mb-2'>
//                 Replay Safety Analysis
//               </h4>
//               <div className='grid grid-cols-2 gap-4'>
//                 <div>
//                   <div className='text-sm text-slate-400'>Mode</div>
//                   <div
//                     className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${getModeColor(
//                       safetyAnalysis.mode
//                     )}`}
//                   >
//                     {getModeIcon(safetyAnalysis.mode)}
//                     {safetyAnalysis.mode}
//                   </div>
//                 </div>
//                 <div>
//                   <div className='text-sm text-slate-400'>Side Effects</div>
//                   <div className='text-white font-medium'>
//                     {safetyAnalysis.sideEffects?.length ?? 0}
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {Array.isArray(safetyAnalysis.warnings) &&
//               safetyAnalysis.warnings.length > 0 && (
//                 <div className='bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg'>
//                   <h4 className='font-semibold text-yellow-400 mb-2 flex items-center gap-2'>
//                     <AlertTriangle className='w-4 h-4' />
//                     Warnings
//                   </h4>
//                   <ul className='space-y-1'>
//                     {safetyAnalysis.warnings.map(
//                       (warning: string, index: number) => (
//                         <li key={index} className='text-sm text-yellow-300'>
//                           {warning}
//                         </li>
//                       )
//                     )}
//                   </ul>
//                 </div>
//               )}

//             {Array.isArray(safetyAnalysis.sideEffects) &&
//               safetyAnalysis.sideEffects.length > 0 && (
//                 <div>
//                   <h4 className='font-semibold text-white mb-2'>
//                     Detected Side Effects
//                   </h4>
//                   <div className='space-y-2'>
//                     {safetyAnalysis.sideEffects.map(
//                       (effect: SideEffect, index: number) => (
//                         <div
//                           key={index}
//                           className='bg-slate-700/50 p-3 rounded-lg'
//                         >
//                           <button
//                             onClick={() =>
//                               setExpandedSideEffects((s) => {
//                                 const c = new Set(s);
//                                 c.has(effect.nodeId)
//                                   ? c.delete(effect.nodeId)
//                                   : c.add(effect.nodeId);
//                                 return c;
//                               })
//                             }
//                             className='flex items-center justify-between w-full text-left'
//                           >
//                             <div className='flex items-center gap-2'>
//                               <div
//                                 className={`px-2 py-1 rounded text-xs border ${
//                                   effect.severity === 'critical'
//                                     ? 'text-red-400 bg-red-500/20 border-red-500'
//                                     : effect.severity === 'safe'
//                                     ? 'text-green-400 bg-green-500/20 border-green-500'
//                                     : 'text-yellow-400 bg-yellow-500/20 border-yellow-500'
//                                 }`}
//                               >
//                                 {effect.severity}
//                               </div>
//                               <span className='text-white font-medium'>
//                                 {effect.type}
//                               </span>
//                             </div>
//                             <div className='text-slate-400'>
//                               {expandedSideEffects.has(effect.nodeId) ? (
//                                 <EyeOff className='w-4 h-4' />
//                               ) : (
//                                 <Eye className='w-4 h-4' />
//                               )}
//                             </div>
//                           </button>

//                           {expandedSideEffects.has(effect.nodeId) && (
//                             <div className='mt-2 pt-2 border-t border-slate-600'>
//                               <p className='text-sm text-slate-300'>
//                                 {effect.description}
//                               </p>
//                             </div>
//                           )}
//                         </div>
//                       )
//                     )}
//                   </div>
//                 </div>
//               )}
//           </div>
//         )}

//         {activeTab === 'modifications' && (
//           <div className='space-y-4'>
//             <div className='bg-slate-700/50 p-4 rounded-lg'>
//               <h4 className='font-semibold text-white mb-3'>
//                 Modify Node Behavior
//               </h4>

//               {/* Prompt Modification */}
//               <div className='mb-4'>
//                 <label className='block text-sm font-medium text-slate-300 mb-2'>
//                   Modify Prompt
//                 </label>
//                 <div className='space-y-2'>
//                   <div className='text-xs text-slate-400'>Original:</div>
//                   <div className='text-xs text-slate-300 bg-slate-700/50 p-2 rounded border-l-2 border-slate-500 max-h-40 overflow-y-auto'>
//                     {selectedNode.prompts && selectedNode.prompts.length > 0
//                       ? selectedNode.prompts.map((p: string, i: number) => (
//                           <div
//                             key={i}
//                             className={
//                               i > 0 ? 'mt-2 pt-2 border-t border-slate-600' : ''
//                             }
//                           >
//                             {p}
//                           </div>
//                         ))
//                       : selectedNode.response
//                       ? `Response: ${selectedNode.response}`
//                       : selectedNode.toolInput
//                       ? `Tool Input: ${
//                           typeof selectedNode.toolInput === 'string'
//                             ? selectedNode.toolInput
//                             : JSON.stringify(selectedNode.toolInput, null, 2)
//                         }`
//                       : 'No prompt available'}
//                   </div>
//                   <div className='text-xs text-slate-400'>Modified:</div>
//                   <textarea
//                     key={selectedNode.id + ':prompt'}
//                     value={getMapValueOr(
//                       modifications.promptChanges,
//                       selectedNode.id,
//                       (selectedNode.prompts && selectedNode.prompts.length > 0
//                         ? selectedNode.prompts.join('\n\n')
//                         : '') ||
//                         selectedNode.response ||
//                         (typeof selectedNode.toolInput === 'string'
//                           ? selectedNode.toolInput
//                           : JSON.stringify(selectedNode.toolInput, null, 2)) ||
//                         ''
//                     )}
//                     onChange={(e) =>
//                       handleModificationChange(
//                         'promptChanges',
//                         selectedNode.id,
//                         e.target.value
//                       )
//                     }
//                     className='w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500'
//                     rows={6}
//                     placeholder='Enter modified prompt...'
//                   />
//                 </div>
//               </div>

//               {/* Model Change */}
//               <div className='mb-4'>
//                 <label className='block text-sm font-medium text-slate-300 mb-2'>
//                   Change Model
//                 </label>
//                 <select
//                   key={selectedNode.id + ':model'}
//                   value={getMapValueOr(
//                     modifications.modelChanges,
//                     selectedNode.id,
//                     selectedNode.model ?? 'gpt-3.5-turbo'
//                   )}
//                   onChange={(e) =>
//                     handleModificationChange(
//                       'modelChanges',
//                       selectedNode.id,
//                       e.target.value
//                     )
//                   }
//                   className='w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500'
//                 >
//                   <option value='gpt-3.5-turbo'>GPT-3.5 Turbo</option>
//                   <option value='gpt-4'>GPT-4</option>
//                   <option value='gpt-4-turbo'>GPT-4 Turbo</option>
//                   <option value='gpt-4o'>GPT-4o</option>
//                   <option value='gpt-4o-mini'>GPT-4o mini</option>
//                   <option value='claude-3-sonnet'>Claude 3 Sonnet</option>
//                 </select>
//               </div>
//             </div>
//           </div>
//         )}

//         {activeTab === 'options' && (
//           <div className='space-y-4'>
//             <div className='bg-slate-700/50 p-4 rounded-lg'>
//               <h4 className='font-semibold text-white mb-3'>Replay Options</h4>

//               <div className='space-y-3'>
//                 <label className='flex items-center gap-3'>
//                   <input
//                     type='checkbox'
//                     checked={options.mockExternalCalls}
//                     onChange={(e) =>
//                       setOptions((prev) => ({
//                         ...prev,
//                         mockExternalCalls: e.target.checked,
//                       }))
//                     }
//                     className='rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500'
//                   />
//                   <span className='text-sm text-slate-300'>
//                     Mock external API calls
//                   </span>
//                 </label>

//                 <label className='flex items-center gap-3'>
//                   <input
//                     type='checkbox'
//                     checked={options.useOriginalData}
//                     onChange={(e) =>
//                       setOptions((prev) => ({
//                         ...prev,
//                         useOriginalData: e.target.checked,
//                       }))
//                     }
//                     className='rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500'
//                   />
//                   <span className='text-sm text-slate-300'>
//                     Use original data for time-dependent operations
//                   </span>
//                 </label>

//                 <label className='flex items-center gap-3'>
//                   <input
//                     type='checkbox'
//                     checked={options.confirmEachSideEffect}
//                     onChange={(e) =>
//                       setOptions((prev) => ({
//                         ...prev,
//                         confirmEachSideEffect: e.target.checked,
//                       }))
//                     }
//                     className='rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500'
//                   />
//                   <span className='text-sm text-slate-300'>
//                     Confirm each side effect individually
//                   </span>
//                 </label>

//                 <div className='grid grid-cols-2 gap-3 mt-2'>
//                   <div>
//                     <label className='block text-sm font-medium text-slate-300 mb-1'>
//                       Temperature
//                     </label>
//                     <input
//                       type='number'
//                       step='0.1'
//                       min='0'
//                       max='2'
//                       value={options.temperature ?? 0.7}
//                       onChange={(e) =>
//                         setOptions((prev) => ({
//                           ...prev,
//                           temperature: Number(e.target.value),
//                         }))
//                       }
//                       className='w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500'
//                     />
//                   </div>
//                   <div>
//                     <label className='block text-sm font-medium text-slate-300 mb-1'>
//                       Max tokens
//                     </label>
//                     <input
//                       type='number'
//                       min={1}
//                       max={8192}
//                       value={options.maxTokens ?? 512}
//                       onChange={(e) =>
//                         setOptions((prev) => ({
//                           ...prev,
//                           maxTokens: Number(e.target.value),
//                         }))
//                       }
//                       className='w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500'
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Footer */}
//       <div className='p-4 border-t border-slate-700 bg-slate-700/30'>
//         <div className='flex items-center justify-between'>
//           <div className='text-sm text-slate-400'>
//             {safetyAnalysis && (
//               <>
//                 {safetyAnalysis.sideEffects?.length ?? 0} side effects detected
//                 {safetyAnalysis.mode === ReplayMode.BLOCKED && (
//                   <span className='text-red-400 ml-2'>• Replay blocked</span>
//                 )}
//               </>
//             )}
//           </div>

//           <div className='flex items-center gap-2'>
//             <button
//               onClick={onClose}
//               className='px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors'
//             >
//               Cancel
//             </button>
//             <button
//               onClick={handleStartReplay}
//               disabled={!normalizedTrace.nodes?.length || isReplaying}
//               className='px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2'
//             >
//               {isReplaying ? (
//                 <>
//                   <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
//                   Replaying...
//                 </>
//               ) : (
//                 <>
//                   <Play className='w-4 h-4' />
//                   Start Replay
//                 </>
//               )}
//             </button>
//           </div>
//         </div>

//         {/* Inline result/debug */}
//         <div className='mt-4'>
//           {isReplaying && (
//             <p className='text-xs text-slate-400'>⏳ Running replay…</p>
//           )}
//           {replayPacket && (
//             <pre className='mt-2 bg-slate-900/70 border border-slate-700 rounded-lg p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap'>
//               {JSON.stringify(replayPacket, null, 2)}
//             </pre>
//           )}
//           {replayText && !isReplaying && (
//             <p className='mt-2 text-xs text-cyan-300'>🧠 {replayText}</p>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  XCircle,
  Settings,
  AlertTriangle,
  CheckCircle,
  Zap,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ReplayEngine,
  ReplayModifications,
  ReplayOptions,
  ReplayMode,
  SideEffect,
} from '../utils/ReplayEngine';
import { useReplay } from '../hooks';
import createSocketLLMCaller from '../utils/createLLMCaller';

interface ReplayInterfaceProps {
  selectedNode: any;
  trace: any; // {nodes, edges, id} OR {trace, nodes, edges, ...}
  onReplayComplete: (result: any) => void;
  onClose: () => void;
}

export default function ReplayInterface({
  selectedNode,
  trace,
  onReplayComplete,
  onClose,
}: ReplayInterfaceProps) {
  const replayEngine = useMemo(() => new ReplayEngine(), []);

  const [safetyAnalysis, setSafetyAnalysis] = useState<any>(null);
  const [modifications, setModifications] = useState<ReplayModifications>({
    promptChanges: new Map(),
    toolResponseOverrides: new Map(),
    systemInstructionUpdates: new Map(),
    contextVariableChanges: new Map(),
    modelChanges: new Map(),
  });

  // ✅ Add sensible defaults for liveMode + token knobs so server gets consistent values
  const [options, setOptions] = useState<ReplayOptions>({
    mode: ReplayMode.SAFE,
    mockExternalCalls: true,
    useOriginalData: true,
    confirmEachSideEffect: false,
    maxReplayDepth: 10,
    liveMode: false,
    temperature: 0.0,
    maxTokens: 150,
  });

  const [activeTab, setActiveTab] = useState<
    'modifications' | 'options' | 'analysis'
  >('analysis');
  const [expandedSideEffects, setExpandedSideEffects] = useState<Set<string>>(
    new Set()
  );

  const llm = useMemo(() => createSocketLLMCaller(), []);
  const {
    replayFromNode,
    result: replayPacket,
    loading: isReplaying,
    output: replayText,
  } = useReplay();

  useEffect(() => {
    if (replayPacket) onReplayComplete(replayPacket);
  }, [replayPacket, onReplayComplete]);

  // Normalize trace shape
  const normalizedTrace = useMemo(() => {
    if (!trace) return { id: undefined, nodes: [], edges: [] };
    const topNodes = Array.isArray(trace.nodes) ? trace.nodes : [];
    const nestedNodes =
      trace.trace && Array.isArray(trace.trace.nodes) ? trace.trace.nodes : [];
    const nodes = topNodes.length ? topNodes : nestedNodes;

    const topEdges = Array.isArray(trace.edges) ? trace.edges : [];
    const nestedEdges =
      trace.trace && Array.isArray(trace.trace.edges) ? trace.trace.edges : [];
    const edges = topEdges.length ? topEdges : nestedEdges;

    const id = trace.id ?? trace.trace?.id ?? trace.traceId ?? undefined;
    return { id, nodes, edges };
  }, [trace]);

  useEffect(() => {
    if (!selectedNode || !trace) return;

    const nodes = Array.isArray((trace as any)?.nodes)
      ? (trace as any).nodes
      : Array.isArray((trace as any)?.trace?.nodes)
      ? (trace as any).trace.nodes
      : [];

    if (nodes.length === 0) {
      setSafetyAnalysis(null);
      return;
    }

    const analysis = replayEngine.analyzeReplaySafety(selectedNode.id, trace);
    setSafetyAnalysis(analysis);
    setOptions((prev) => ({ ...prev, mode: analysis.mode }));
  }, [selectedNode, trace, replayEngine]);

  const modeLabel = useMemo(() => {
    // Handle numeric enums gracefully
    if (typeof options.mode === 'number') {
      return ReplayMode[options.mode] ?? 'SAFE';
    }
    return String(options.mode ?? 'SAFE').toUpperCase();
  }, [options.mode]);

  const handleStartReplay = async () => {
    if (!selectedNode || !trace) return;

    let resolvedLlm: any = undefined;
    if (options.liveMode) {
      try {
        resolvedLlm = await llm;
      } catch {
        resolvedLlm = undefined;
      }
    }

    const traceId =
      (trace as any)?.trace?.id ??
      (trace as any)?.id ??
      (trace as any)?.traceId ??
      null;

    const editedPrompt =
      modifications.promptChanges?.get(selectedNode.id) ??
      (selectedNode.prompts && selectedNode.prompts.length
        ? selectedNode.prompts.join('\n\n')
        : selectedNode.response ||
          (typeof selectedNode.toolInput === 'string'
            ? selectedNode.toolInput
            : JSON.stringify(selectedNode.toolInput ?? '', null, 2)) ||
          '');

    const chosenModel =
      modifications.modelChanges?.get(selectedNode.id) ||
      selectedNode.model ||
      'gpt-4o-mini';

    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: editedPrompt || 'No prompt provided.' },
    ];

    // 🔑 Send everything your server expects (matches your /replay_llm_request handler)
    await replayFromNode(selectedNode.id, {
      // core opts (passed through hooks/libs as needed)
      mode: options.mode,
      mockExternalCalls: options.mockExternalCalls,
      useOriginalData: options.useOriginalData,
      confirmEachSideEffect: options.confirmEachSideEffect,
      maxReplayDepth: options.maxReplayDepth,

      // live knobs
      liveMode: options.liveMode,
      llm: resolvedLlm,
      temperature: options.temperature,
      maxTokens: options.maxTokens,

      // server payload
      traceId,
      startNodeId: selectedNode.id, // server consumes this to traverse descendants
      nodeId: selectedNode.id, // some clients expect this
      messages,
      stream: true,
      model: chosenModel,
      modifiedPrompt: editedPrompt,
    });
  };

  const handleModificationChange = (
    type: keyof ReplayModifications,
    nodeId: string,
    value: any
  ) => {
    setModifications((prev) => {
      const next = { ...prev } as any;
      const updatedMap = new Map(next[type] as Map<string, any>);
      updatedMap.set(nodeId, value);
      next[type] = updatedMap;
      return next;
    });
  };

  const getMapValueOr = (
    map: Map<string, any> | undefined,
    key: string,
    fallback: any
  ) => (map && map.has(key) ? map.get(key) : fallback);

  const getModeColor = (mode: ReplayMode) => {
    switch (mode) {
      case ReplayMode.SAFE:
        return 'text-green-400 bg-green-500/20 border-green-500';
      case ReplayMode.SIMULATION:
        return 'text-blue-400 bg-blue-500/20 border-blue-500';
      case ReplayMode.WARNING:
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      case ReplayMode.BLOCKED:
        return 'text-red-400 bg-red-500/20 border-red-500';
      default:
        return 'text-slate-400 bg-slate-500/20 border-slate-500';
    }
  };

  const getModeIcon = (mode: ReplayMode) => {
    switch (mode) {
      case ReplayMode.SAFE:
        return <CheckCircle className='w-4 h-4' />;
      case ReplayMode.SIMULATION:
        return <Zap className='w-4 h-4' />;
      case ReplayMode.WARNING:
        return <AlertTriangle className='w-4 h-4' />;
      default:
        return <Shield className='w-4 h-4' />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-500/20 border-red-500';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      case 'safe':
        return 'text-green-400 bg-green-500/20 border-green-500';
      default:
        return 'text-slate-400 bg-slate-500/20 border-slate-500';
    }
  };

  if (!selectedNode || !trace) {
    return (
      <div className='bg-slate-800 border border-slate-700 rounded-lg p-6'>
        <div className='text-center text-slate-400'>
          <Play className='w-12 h-12 mx-auto mb-4' />
        </div>
        <p className='text-center text-slate-400'>
          Select a node to start replay
        </p>
      </div>
    );
  }

  return (
    <div className='bg-slate-800 border border-slate-700 rounded-lg overflow-hidden'>
      {/* Header */}
      <div className='p-4 border-b border-slate-700'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Play className='w-5 h-5 text-blue-400' />
            <h3 className='text-lg font-semibold text-white'>
              Replay &amp; Experimentation
            </h3>
            <div
              className={`px-2 py-1 rounded text-xs border flex items-center gap-1 ${getModeColor(
                options.mode
              )}`}
            >
              {getModeIcon(options.mode)}
              {String(modeLabel).toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            className='text-slate-400 hover:text-white transition-colors'
          >
            <XCircle className='w-5 h-5' />
          </button>
        </div>
        <p className='text-sm text-slate-400 mt-1'>
          Replay from:{' '}
          <span className='text-white font-medium'>
            {selectedNode.label || selectedNode.id}
          </span>
        </p>
      </div>

      {/* Tabs */}
      <div className='flex border-b border-slate-700'>
        {[
          { id: 'analysis', label: 'Safety Analysis', icon: Shield },
          { id: 'modifications', label: 'Modifications', icon: AlertTriangle },
          { id: 'options', label: 'Options', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            <tab.icon className='w-4 h-4' />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className='p-4 max-h-96 overflow-auto'>
        {activeTab === 'analysis' && safetyAnalysis && (
          <div className='space-y-4'>
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <h4 className='font-semibold text-white mb-2'>
                Replay Safety Analysis
              </h4>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <div className='text-sm text-slate-400'>Mode</div>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${getModeColor(
                      safetyAnalysis.mode
                    )}`}
                  >
                    {getModeIcon(safetyAnalysis.mode)}
                    {typeof safetyAnalysis.mode === 'number'
                      ? ReplayMode[safetyAnalysis.mode] ?? 'SAFE'
                      : String(safetyAnalysis.mode)}
                  </div>
                </div>
                <div>
                  <div className='text-sm text-slate-400'>Side Effects</div>
                  <div className='text-white font-medium'>
                    {safetyAnalysis.sideEffects?.length ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {Array.isArray(safetyAnalysis.warnings) &&
              safetyAnalysis.warnings.length > 0 && (
                <div className='bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg'>
                  <h4 className='font-semibold text-yellow-400 mb-2 flex items-center gap-2'>
                    <AlertTriangle className='w-4 h-4' />
                    Warnings
                  </h4>
                  <ul className='space-y-1'>
                    {safetyAnalysis.warnings.map(
                      (warning: string, index: number) => (
                        <li key={index} className='text-sm text-yellow-300'>
                          {warning}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

            {Array.isArray(safetyAnalysis.sideEffects) &&
              safetyAnalysis.sideEffects.length > 0 && (
                <div>
                  <h4 className='font-semibold text-white mb-2'>
                    Detected Side Effects
                  </h4>
                  <div className='space-y-2'>
                    {safetyAnalysis.sideEffects.map(
                      (effect: SideEffect, index: number) => (
                        <div
                          key={index}
                          className='bg-slate-700/50 p-3 rounded-lg'
                        >
                          <button
                            onClick={() =>
                              setExpandedSideEffects((s) => {
                                const c = new Set(s);
                                c.has(effect.nodeId)
                                  ? c.delete(effect.nodeId)
                                  : c.add(effect.nodeId);
                                return c;
                              })
                            }
                            className='flex items-center justify-between w-full text-left'
                          >
                            <div className='flex items-center gap-2'>
                              <div
                                className={`px-2 py-1 rounded text-xs border ${
                                  effect.severity === 'critical'
                                    ? 'text-red-400 bg-red-500/20 border-red-500'
                                    : effect.severity === 'safe'
                                    ? 'text-green-400 bg-green-500/20 border-green-500'
                                    : 'text-yellow-400 bg-yellow-500/20 border-yellow-500'
                                }`}
                              >
                                {effect.severity}
                              </div>
                              <span className='text-white font-medium'>
                                {effect.type}
                              </span>
                            </div>
                            <div className='text-slate-400'>
                              {expandedSideEffects.has(effect.nodeId) ? (
                                <EyeOff className='w-4 h-4' />
                              ) : (
                                <Eye className='w-4 h-4' />
                              )}
                            </div>
                          </button>

                          {expandedSideEffects.has(effect.nodeId) && (
                            <div className='mt-2 pt-2 border-t border-slate-600'>
                              <p className='text-sm text-slate-300'>
                                {effect.description}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {activeTab === 'modifications' && (
          <div className='space-y-4'>
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <h4 className='font-semibold text-white mb-3'>
                Modify Node Behavior
              </h4>

              {/* Prompt Modification */}
              <div className='mb-4'>
                <label className='block text-sm font-medium text-slate-300 mb-2'>
                  Modify Prompt
                </label>
                <div className='space-y-2'>
                  <div className='text-xs text-slate-400'>Original:</div>
                  <div className='text-xs text-slate-300 bg-slate-700/50 p-2 rounded border-l-2 border-slate-500 max-h-40 overflow-y-auto'>
                    {selectedNode.prompts && selectedNode.prompts.length > 0
                      ? selectedNode.prompts.map((p: string, i: number) => (
                          <div
                            key={i}
                            className={
                              i > 0 ? 'mt-2 pt-2 border-t border-slate-600' : ''
                            }
                          >
                            {p}
                          </div>
                        ))
                      : selectedNode.response
                      ? `Response: ${selectedNode.response}`
                      : selectedNode.toolInput
                      ? `Tool Input: ${
                          typeof selectedNode.toolInput === 'string'
                            ? selectedNode.toolInput
                            : JSON.stringify(selectedNode.toolInput, null, 2)
                        }`
                      : 'No prompt available'}
                  </div>
                  <div className='text-xs text-slate-400'>Modified:</div>
                  <textarea
                    key={selectedNode.id + ':prompt'}
                    value={getMapValueOr(
                      modifications.promptChanges,
                      selectedNode.id,
                      (selectedNode.prompts && selectedNode.prompts.length > 0
                        ? selectedNode.prompts.join('\n\n')
                        : '') ||
                        selectedNode.response ||
                        (typeof selectedNode.toolInput === 'string'
                          ? selectedNode.toolInput
                          : JSON.stringify(selectedNode.toolInput, null, 2)) ||
                        ''
                    )}
                    onChange={(e) =>
                      handleModificationChange(
                        'promptChanges',
                        selectedNode.id,
                        e.target.value
                      )
                    }
                    className='w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500'
                    rows={6}
                    placeholder='Enter modified prompt...'
                  />
                </div>
              </div>

              {/* Model Change */}
              <div className='mb-4'>
                <label className='block text-sm font-medium text-slate-300 mb-2'>
                  Change Model
                </label>
                <select
                  key={selectedNode.id + ':model'}
                  value={getMapValueOr(
                    modifications.modelChanges,
                    selectedNode.id,
                    selectedNode.model ?? 'gpt-4o-mini'
                  )}
                  onChange={(e) =>
                    handleModificationChange(
                      'modelChanges',
                      selectedNode.id,
                      e.target.value
                    )
                  }
                  className='w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500'
                >
                  <option value='gpt-4o-mini'>GPT-4o mini</option>
                  <option value='gpt-4o'>GPT-4o</option>
                  <option value='gpt-4-turbo'>GPT-4 Turbo</option>
                  <option value='gpt-4'>GPT-4</option>
                  <option value='gpt-3.5-turbo'>GPT-3.5 Turbo</option>
                  <option value='claude-3-sonnet'>Claude 3 Sonnet</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'options' && (
          <div className='space-y-4'>
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <h4 className='font-semibold text-white mb-3'>Replay Options</h4>

              <div className='space-y-3'>
                <label className='flex items-center gap-3'>
                  <input
                    type='checkbox'
                    checked={options.mockExternalCalls}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        mockExternalCalls: e.target.checked,
                      }))
                    }
                    className='rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500'
                  />
                  <span className='text-sm text-slate-300'>
                    Mock external API calls
                  </span>
                </label>

                <label className='flex items-center gap-3'>
                  <input
                    type='checkbox'
                    checked={options.useOriginalData}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        useOriginalData: e.target.checked,
                      }))
                    }
                    className='rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500'
                  />
                  <span className='text-sm text-slate-300'>
                    Use original data for time-dependent operations
                  </span>
                </label>

                <label className='flex items-center gap-3'>
                  <input
                    type='checkbox'
                    checked={options.confirmEachSideEffect}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        confirmEachSideEffect: e.target.checked,
                      }))
                    }
                    className='rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500'
                  />
                  <span className='text-sm text-slate-300'>
                    Confirm each side effect individually
                  </span>
                </label>

                {/* Live mode toggle (optional) */}
                <label className='flex items-center gap-3'>
                  <input
                    type='checkbox'
                    checked={!!options.liveMode}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        liveMode: e.target.checked,
                      }))
                    }
                    className='rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500'
                  />
                  <span className='text-sm text-slate-300'>
                    Live LLM call (Socket) for replay
                  </span>
                </label>

                <div className='grid grid-cols-2 gap-3 mt-2'>
                  <div>
                    <label className='block text-sm font-medium text-slate-300 mb-1'>
                      Temperature
                    </label>
                    <input
                      type='number'
                      step='0.1'
                      min='0'
                      max='2'
                      value={options.temperature ?? 0.0}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          temperature: Number(e.target.value),
                        }))
                      }
                      className='w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-slate-300 mb-1'>
                      Max tokens
                    </label>
                    <input
                      type='number'
                      min={1}
                      max={8192}
                      value={options.maxTokens ?? 150}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          maxTokens: Number(e.target.value),
                        }))
                      }
                      className='w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500'
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className='p-4 border-t border-slate-700 bg-slate-700/30'>
        <div className='flex items-center justify-between'>
          <div className='text-sm text-slate-400'>
            {safetyAnalysis && (
              <>
                {safetyAnalysis.sideEffects?.length ?? 0} side effects detected
                {safetyAnalysis.mode === ReplayMode.BLOCKED && (
                  <span className='text-red-400 ml-2'>• Replay blocked</span>
                )}
              </>
            )}
          </div>

          <div className='flex items-center gap-2'>
            <button
              onClick={onClose}
              className='px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={handleStartReplay}
              disabled={!normalizedTrace.nodes?.length || isReplaying}
              className='px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2'
            >
              {isReplaying ? (
                <>
                  <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  Replaying...
                </>
              ) : (
                <>
                  <Play className='w-4 h-4' />
                  Start Replay
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inline result/debug */}
        <div className='mt-4'>
          {isReplaying && (
            <p className='text-xs text-slate-400'>⏳ Running replay…</p>
          )}
          {replayPacket && (
            <pre className='mt-2 bg-slate-900/70 border border-slate-700 rounded-lg p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap'>
              {JSON.stringify(replayPacket, null, 2)}
            </pre>
          )}
          {replayText && !isReplaying && (
            <p className='mt-2 text-xs text-cyan-300'>🧠 {replayText}</p>
          )}
        </div>
      </div>
    </div>
  );
}
