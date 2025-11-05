// import React, { useState, useMemo } from 'react';
// import {
//   CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, BarChart3, Zap, Target,
//   TrendingUp, TrendingDown, Minus, Play, RotateCcw,
// } from 'lucide-react';

// interface ReplayResultsProps {
//   result: any;
//   originalTrace: any;
//   onClose: () => void;
//   onStartNewReplay: () => void;
// }

// /* ------------ helpers ------------ */
// function safeNumber(n: any, fallback = 0) {
//   const v = typeof n === 'number' ? n : Number(n);
//   return Number.isFinite(v) ? v : fallback;
// }
// function asArray<T = any>(v: any): T[] {
//   return Array.isArray(v) ? v : [];
// }
// /* --------------------------------- */

// /* Normalize many server shapes into one */
// function normalizeResult(raw: any) {
//   const r = raw ?? {};

//   const toIdList = (v: any): string[] => {
//     const arr = asArray<any>(v);
//     return arr.map((x) =>
//       typeof x === 'string'
//         ? x
//         : x?.id ?? x?.nodeId ?? x?.runId ?? x?.label ?? JSON.stringify(x)
//     );
//   };

//   const text: string =
//     typeof r.text === 'string' ? r.text :
//     typeof r.output === 'string' ? r.output :
//     Array.isArray(r.deltas) ? r.deltas.join('') :
//     typeof r.deltaAccumulated === 'string' ? r.deltaAccumulated :
//     typeof r.message === 'string' ? r.message :
//     typeof r.content === 'string' ? r.content :
//     typeof r?.llm?.text === 'string' ? r.llm.text :
//     typeof r?.response?.text === 'string' ? r.response.text : '';

//   const rawCost =
//     r.totalCost ?? r.cost ?? r.metrics?.totalCost ?? r.metrics?.cost ?? r.llm?.cost ?? r.response?.cost ?? r.usage?.cost;

//   const rawLatency =
//     r.totalLatency ?? r.latency ?? r.durationMs ?? r.metrics?.latency ?? r.metrics?.totalLatency;

//   // pick up live tokens/cost if provided by backend
//   const llmTokens = r.llmTokens && typeof r.llmTokens === 'object'
//     ? {
//         input: safeNumber(r.llmTokens.input, 0),
//         output: safeNumber(r.llmTokens.output, 0),
//         total: safeNumber(r.llmTokens.total, safeNumber(r.llmTokens.input,0)+safeNumber(r.llmTokens.output,0)),
//       }
//     : undefined;

//   const replayLlmCost = safeNumber(r.replayLlmCost, 0);

//   return {
//     success: Boolean(r.success ?? r.ok ?? false),
//     newTraceId: r.newTraceId ?? undefined,
//     executedNodes: toIdList(r.executedNodes ?? r.nodesExecuted ?? r.steps ?? r.events?.filter?.((e: any) => e?.type === 'executed')),
//     skippedNodes: toIdList(r.skippedNodes ?? r.nodesSkipped ?? r.events?.filter?.((e: any) => e?.type === 'skipped')),
//     sideEffects: asArray<any>(r.sideEffects ?? r.effects ?? r.events?.filter?.((e: any) => e?.type === 'side_effect')),
//     error: r.error ?? undefined,
//     totalCost: safeNumber(rawCost, 0),
//     totalLatency: safeNumber(rawLatency, 0),
//     text,
//     llmTokens,
//     replayLlmCost,
//   };
// }

// /* detect whether any tool nodes executed */
// function anyToolsExecuted(executedIds: string[], originalTrace: any): boolean {
//   const nodes = asArray<any>(originalTrace?.nodes);
//   if (!nodes.length || !executedIds.length) return false;
//   for (const id of executedIds) {
//     const n = nodes.find((x) => x?.id === id || x?.data?.id === id);
//     const t = n?.data?.type || n?.type;
//     if (typeof t === 'string' && t.toLowerCase().includes('tool')) return true;
//   }
//   return false;
// }

// /* strip hallucinated Action/Observation blocks if no real tools ran */
// function sanitizeModelText(text: string, executedIds: string[], originalTrace: any): string {
//   if (!text) return '';
//   if (anyToolsExecuted(executedIds, originalTrace)) return text;
//   const lines = text.split(/\r?\n/);
//   const cleaned = lines.filter((line) => {
//     const trimmed = line.trim().toLowerCase();
//     if (trimmed.startsWith('action:')) return false;
//     if (trimmed.startsWith('observation:')) return false;
//     return true;
//   });
//   return cleaned.join('\n').replace(/\n{3,}/g, '\n\n');
// }

// /* approximate rerun cost from original nodes if backend didn't send anything */
// function approximateCostFromOriginal(executedIds: string[], originalTrace: any): number {
//   const nodes = asArray<any>(originalTrace?.nodes);
//   if (!nodes.length || !executedIds.length) return 0;
//   return executedIds.reduce((sum, id) => {
//     const n = nodes.find((x) => x?.id === id || x?.data?.id === id);
//     const c =
//       safeNumber(n?.data?.cost, NaN) ??
//       safeNumber(n?.cost, NaN) ??
//       safeNumber(n?.metrics?.cost, NaN);
//     return sum + (Number.isFinite(c) ? c : 0);
//   }, 0);
// }

// const ReplayResults: React.FC<ReplayResultsProps> = ({
//   result,
//   originalTrace,
//   onClose,
//   onStartNewReplay,
// }) => {
//   const normalized = useMemo(() => normalizeResult(result), [result]);

//   const displayText = useMemo(
//     () => sanitizeModelText(normalized.text, normalized.executedNodes, originalTrace),
//     [normalized.text, normalized.executedNodes, originalTrace]
//   );

//   // Prefer server totalCost; if absent, prefer replayLlmCost; else fallback to original node approximation
//   const effectiveCost = useMemo(() => {
//     const fromServer = safeNumber(normalized.totalCost, 0);
//     if (fromServer > 0) return fromServer;
//     const fromReplay = safeNumber(normalized.replayLlmCost, 0);
//     if (fromReplay > 0) return fromReplay;
//     return approximateCostFromOriginal(normalized.executedNodes, originalTrace);
//   }, [normalized.totalCost, normalized.replayLlmCost, normalized.executedNodes, originalTrace]);

//   const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'comparison']));
//   const [showComparison, setShowComparison] = useState(true);
//   const [comparisonView, setComparisonView] = useState<'overview' | 'detailed'>('overview');

//   const toggleSection = (section: string) => {
//     setExpandedSections((prev) => {
//       const next = new Set(prev);
//       if (next.has(section)) next.delete(section);
//       else next.add(section);
//       return next;
//     });
//   };

//   const getComparisonIcon = (original: number, newValue: number) => {
//     if (newValue > original) return <TrendingUp className='w-4 h-4 text-red-400' />;
//     if (newValue < original) return <TrendingDown className='w-4 h-4 text-green-400' />;
//     return <Minus className='w-4 h-4 text-slate-400' />;
//   };

//   const formatComparison = (original: number, newValue: number, unit: string = '') => {
//     const o = safeNumber(original, 0);
//     const n = safeNumber(newValue, 0);
//     const diff = n - o;
//     const percentChange = o > 0 ? ((diff / o) * 100).toFixed(1) : '0.0';
//     const sign = diff > 0 ? '+' : diff < 0 ? '' : '';
//     return (
//       <div className='flex items-center gap-2'>
//         <span className='text-white font-medium'>
//           {n.toFixed(unit ? 0 : 6)}
//           {unit}
//         </span>
//         {getComparisonIcon(o, n)}
//         <span className={`text-sm ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-400'}`}>
//           {sign}{n.toFixed(unit ? 0 : 6)}{unit} ({sign}{percentChange}%)
//         </span>
//       </div>
//     );
//   };

//   // Metrics for the two sides
//   const comparisonMetrics = useMemo(() => {
//     if (!originalTrace) return null;

//     const origNodesArray = asArray<any>(originalTrace?.nodes);
//     const originalCost = safeNumber(originalTrace?.totalCost, NaN) ?? 0;
//     const originalLatency = safeNumber(originalTrace?.totalLatency, 0);
//     const originalNodes = origNodesArray.length;
//     const originalTokens =
//       origNodesArray.reduce(
//         (sum: number, node: any) =>
//           sum + safeNumber(node?.data?.tokens?.total ?? node?.tokens?.total, 0),
//         0
//       ) || 0;

//     const newCost = safeNumber(effectiveCost, 0);
//     const newLatency = safeNumber(normalized.totalLatency, 0);
//     const newNodes = normalized.executedNodes.length;

//     // Prefer llmTokens (from server) for Modified; otherwise fallback to summing executed originals
//     const newTokens =
//       (normalized.llmTokens?.total ??
//         normalized.executedNodes.reduce((sum: number, nodeId: string) => {
//           const node = origNodesArray.find((n: any) => n?.id === nodeId);
//           return sum + safeNumber(node?.data?.tokens?.total ?? node?.tokens?.total, 0);
//         }, 0)) || 0;

//     const costSavings = originalCost - newCost;
//     const costSavingsPercent = originalCost > 0 ? (costSavings / originalCost) * 100 : 0;
//     const latencySavings = originalLatency - newLatency;
//     const latencySavingsPercent = originalLatency > 0 ? (latencySavings / originalLatency) * 100 : 0;
//     const tokenSavings = originalTokens - newTokens;
//     const tokenSavingsPercent = originalTokens > 0 ? (tokenSavings / originalTokens) * 100 : 0;

//     return {
//       original: { cost: safeNumber(originalCost, 0), latency: originalLatency, nodes: originalNodes, tokens: originalTokens },
//       modified: { cost: newCost, latency: newLatency, nodes: newNodes, tokens: newTokens },
//       savings: {
//         cost: costSavings,
//         costPercent: costSavingsPercent,
//         latency: latencySavings,
//         latencyPercent: latencySavingsPercent,
//         tokens: tokenSavings,
//         tokenPercent: tokenSavingsPercent,
//       },
//     };
//   }, [originalTrace, normalized.totalLatency, normalized.executedNodes, normalized.llmTokens, effectiveCost]);

//   // Empty state (allow text-only)
//   if (
//     !normalized ||
//     (!normalized.success &&
//       !normalized.error &&
//       !displayText &&
//       normalized.executedNodes.length === 0 &&
//       normalized.skippedNodes.length === 0 &&
//       normalized.sideEffects.length === 0)
//   ) {
//     return (
//       <div className='bg-slate-800 border border-slate-700 rounded-lg p-6'>
//         <div className='text-center text-slate-400'>
//           <Play className='w-12 h-12 mx-auto mb-4' />
//           <p>No replay results to display</p>
//         </div>
//       </div>
//     );
//   }

//   const getSeverityColor = (severity: string) => {
//     switch (severity) {
//       case 'critical': return 'text-red-400 bg-red-500/20 border-red-500';
//       case 'warning':  return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
//       case 'safe':     return 'text-green-400 bg-green-500/20 border-green-500';
//       default:         return 'text-slate-400 bg-slate-500/20 border-slate-500';
//     }
//   };

//   return (
//     <div className='bg-slate-800 border border-slate-700 rounded-lg overflow-hidden'>
//       {/* Header */}
//       <div className='p-4 border-b border-slate-700'>
//         <div className='flex items-center justify-between'>
//           <div className='flex items-center gap-3'>
//             {normalized.success ? <CheckCircle className='w-5 h-5 text-green-400' /> : <XCircle className='w-5 h-5 text-red-400' />}
//             <h3 className='text-lg font-semibold text-white'>Replay Results</h3>
//             <div className={`px-2 py-1 rounded text-xs border ${normalized.success
//               ? 'text-green-400 bg-green-500/20 border-green-500'
//               : 'text-red-400 bg-red-500/20 border-red-500'}`}>
//               {normalized.success ? 'SUCCESS' : 'RESULT'}
//             </div>
//           </div>
//           <div className='flex items-center gap-2'>
//             <button
//               onClick={() => setShowComparison(!showComparison)}
//               className='text-slate-400 hover:text-white transition-colors'
//               title='Toggle comparison view'
//               disabled={!originalTrace}
//             >
//               {showComparison ? <EyeOff className='w-5 h-5' /> : <Eye className='w-5 h-5' />}
//             </button>
//             <button onClick={onClose} className='text-slate-400 hover:text-white transition-colors'>
//               <XCircle className='w-5 h-5' />
//             </button>
//           </div>
//         </div>
//         {normalized.newTraceId && (
//           <p className='text-sm text-slate-400 mt-1'>
//             New Trace ID: <span className='text-white font-mono'>{normalized.newTraceId}</span>
//           </p>
//         )}
//       </div>

//       {/* Content */}
//       <div className='p-4 max-h-96 overflow-auto'>
//         <div className='space-y-4'>
//           {/* Model Output */}
//           {displayText && (
//             <div className='bg-slate-700/50 p-4 rounded-lg'>
//               <h4 className='font-semibold text-white mb-2'>Model Output</h4>
//               <pre className='whitespace-pre-wrap text-sm text-slate-200 bg-slate-900/60 border border-slate-800 rounded p-3'>
//                 {displayText}
//               </pre>
//             </div>
//           )}

//           {/* Summary */}
//           <div className='bg-slate-700/50 p-4 rounded-lg'>
//             <button onClick={() => toggleSection('summary')} className='flex items-center justify-between w-full text-left'>
//               <h4 className='font-semibold text-white'>Execution Summary</h4>
//               {expandedSections.has('summary') ? <EyeOff className='w-4 h-4 text-slate-400' /> : <Eye className='w-4 h-4 text-slate-400' />}
//             </button>

//             {expandedSections.has('summary') && (
//               <div className='mt-3 grid grid-cols-2 gap-4'>
//                 <div>
//                   <div className='text-sm text-slate-400'>Executed Nodes</div>
//                   <div className='text-white font-medium'>{normalized.executedNodes.length}</div>
//                 </div>
//                 <div>
//                   <div className='text-sm text-slate-400'>Skipped Nodes</div>
//                   <div className='text-white font-medium'>{normalized.skippedNodes.length}</div>
//                 </div>
//                 <div>
//                   <div className='text-sm text-slate-400'>Total Cost</div>
//                   {showComparison && originalTrace ? (
//                     formatComparison(safeNumber(originalTrace?.totalCost, 0), effectiveCost, '')
//                   ) : (
//                     <div className='text-white font-medium'>${safeNumber(effectiveCost, 0).toFixed(6)}</div>
//                   )}
//                 </div>
//                 <div>
//                   <div className='text-sm text-slate-400'>Total Latency</div>
//                   {showComparison && originalTrace ? (
//                     formatComparison(safeNumber(originalTrace?.totalLatency, 0), safeNumber(normalized.totalLatency, 0), 'ms')
//                   ) : (
//                     <div className='text-white font-medium'>{safeNumber(normalized.totalLatency, 0).toFixed(0)}ms</div>
//                   )}
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* Comparison */}
//           {comparisonMetrics && (
//             <div className='bg-slate-700/50 p-4 rounded-lg'>
//               <div className='flex items-center justify-between mb-4'>
//                 <button onClick={() => toggleSection('comparison')} className='flex items-center gap-2 text-left'>
//                   <BarChart3 className='w-5 h-5 text-blue-400' />
//                   <h4 className='font-semibold text-white'>Replay Studio Comparison</h4>
//                   {expandedSections.has('comparison') ? <EyeOff className='w-4 h-4 text-slate-400' /> : <Eye className='w-4 h-4 text-slate-400' />}
//                 </button>
//                 <div className='flex gap-2'>
//                   <button
//                     onClick={() => setComparisonView('overview')}
//                     className={`px-3 py-1 rounded text-sm ${comparisonView === 'overview' ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}
//                   >
//                     Overview
//                   </button>
//                   <button
//                     onClick={() => setComparisonView('detailed')}
//                     className={`px-3 py-1 rounded text-sm ${comparisonView === 'detailed' ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}
//                   >
//                     Detailed
//                   </button>
//                 </div>
//               </div>

//               {expandedSections.has('comparison') && (
//                 <div className='space-y-4'>
//                   {comparisonView === 'overview' ? (
//                     <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
//                       {/* Original */}
//                       <div className='bg-slate-800/50 p-4 rounded-lg border border-slate-600'>
//                         <div className='flex items-center gap-2 mb-3'>
//                           <div className='w-3 h-3 bg-red-500 rounded-full' />
//                           <h5 className='font-semibold text-white'>Original</h5>
//                         </div>
//                         <div className='space-y-3'>
//                           <div className='bg-slate-700/30 p-3 rounded border-l-4 border-red-500'>
//                             <div className='text-sm text-slate-400 mb-2'>Result</div>
//                             <div className='space-y-1 text-sm'>
//                               <div className='flex justify-between'><span className='text-slate-300'>Tokens:</span><span className='text-white font-medium'>{comparisonMetrics.original.tokens.toLocaleString()}</span></div>
//                               <div className='flex justify-between'><span className='text-slate-300'>Cost:</span><span className='text-white font-medium'>${comparisonMetrics.original.cost.toFixed(2)}</span></div>
//                               <div className='flex justify-between'><span className='text-slate-300'>Latency:</span><span className='text-white font-medium'>{(comparisonMetrics.original.latency/1000).toFixed(2)}s</span></div>
//                             </div>
//                           </div>
//                         </div>
//                       </div>

//                       {/* Modified */}
//                       <div className='bg-slate-800/50 p-4 rounded-lg border border-green-500'>
//                         <div className='flex items-center gap-2 mb-3'>
//                           <div className='w-3 h-3 bg-green-500 rounded-full' />
//                           <h5 className='font-semibold text-white'>Modified</h5>
//                         </div>
//                         <div className='space-y-3'>
//                           <div className='bg-green-500/10 p-3 rounded border border-green-500'>
//                             <div className='text-sm text-slate-400 mb-2'>Replay Result</div>
//                             <div className='space-y-1 text-sm'>
//                               <div className='flex justify-between'>
//                                 <span className='text-slate-300'>Tokens:</span>
//                                 <span className='text-white font-medium'>~{comparisonMetrics.modified.tokens.toLocaleString()}</span>
//                                 <span className='text-green-400 text-xs'>({comparisonMetrics.savings.tokenPercent.toFixed(0)}% reduction)</span>
//                               </div>
//                               <div className='flex justify-between'>
//                                 <span className='text-slate-300'>Cost:</span>
//                                 <span className='text-white font-medium'>~${comparisonMetrics.modified.cost.toFixed(2)}</span>
//                                 <span className='text-green-400 text-xs'>({comparisonMetrics.savings.costPercent.toFixed(0)}% savings)</span>
//                               </div>
//                               <div className='flex justify-between'>
//                                 <span className='text-slate-300'>Latency:</span>
//                                 <span className='text-white font-medium'>~{(comparisonMetrics.modified.latency/1000).toFixed(2)}s</span>
//                                 <span className='text-green-400 text-xs'>({comparisonMetrics.savings.latencyPercent.toFixed(0)}% faster)</span>
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     </div>
//                   ) : (
//                     // Detailed
//                     <div className='space-y-4'>
//                       <div className='grid grid-cols-2 gap-4'>
//                         <div className='bg-slate-800/30 p-4 rounded-lg'>
//                           <h6 className='font-semibold text-white mb-3 flex items-center gap-2'>
//                             <Target className='w-4 h-4 text-blue-400' /> Original Execution
//                           </h6>
//                           <div className='space-y-2 text-sm'>
//                             <div className='flex justify-between'><span className='text-slate-400'>Total Cost:</span><span className='text-white'>${comparisonMetrics.original.cost.toFixed(6)}</span></div>
//                             <div className='flex justify-between'><span className='text-slate-400'>Total Latency:</span><span className='text-white'>{(comparisonMetrics.original.latency/1000).toFixed(2)}s</span></div>
//                             <div className='flex justify-between'><span className='text-slate-400'>Total Tokens:</span><span className='text-white'>{comparisonMetrics.original.tokens.toLocaleString()}</span></div>
//                             <div className='flex justify-between'><span className='text-slate-400'>Nodes Executed:</span><span className='text-white'>{comparisonMetrics.original.nodes}</span></div>
//                           </div>
//                         </div>

//                         <div className='bg-slate-800/30 p-4 rounded-lg'>
//                           <h6 className='font-semibold text-white mb-3 flex items-center gap-2'>
//                             <Zap className='w-4 h-4 text-green-400' /> Modified Execution
//                           </h6>
//                           <div className='space-y-2 text-sm'>
//                             <div className='flex justify-between'><span className='text-slate-400'>Total Cost:</span><span className='text-white'>${comparisonMetrics.modified.cost.toFixed(6)}</span></div>
//                             <div className='flex justify-between'><span className='text-slate-400'>Total Latency:</span><span className='text-white'>{(comparisonMetrics.modified.latency/1000).toFixed(2)}s</span></div>
//                             <div className='flex justify-between'><span className='text-slate-400'>Total Tokens:</span><span className='text-white'>{comparisonMetrics.modified.tokens.toLocaleString()}</span></div>
//                             <div className='flex justify-between'><span className='text-slate-400'>Nodes Executed:</span><span className='text-white'>{comparisonMetrics.modified.nodes}</span></div>
//                           </div>
//                         </div>
//                       </div>

//                       <div className='bg-green-500/10 border border-green-500/20 p-4 rounded-lg'>
//                         <h6 className='font-semibold text-green-400 mb-3'>Savings Summary</h6>
//                         <div className='grid grid-cols-3 gap-4 text-sm'>
//                           <div className='text-center'><div className='text-2xl font-bold text-green-400'>${comparisonMetrics.savings.cost.toFixed(2)}</div><div className='text-slate-400'>Cost Savings</div><div className='text-green-400 text-xs'>({comparisonMetrics.savings.costPercent.toFixed(1)}%)</div></div>
//                           <div className='text-center'><div className='text-2xl font-bold text-green-400'>{(comparisonMetrics.savings.latency/1000).toFixed(1)}s</div><div className='text-slate-400'>Time Savings</div><div className='text-green-400 text-xs'>({comparisonMetrics.savings.latencyPercent.toFixed(1)}%)</div></div>
//                           <div className='text-center'><div className='text-2xl font-bold text-green-400'>{comparisonMetrics.savings.tokens.toLocaleString()}</div><div className='text-slate-400'>Token Savings</div><div className='text-green-400 text-xs'>({comparisonMetrics.savings.tokenPercent.toFixed(1)}%)</div></div>
//                         </div>
//                       </div>

//                       <div className='bg-slate-800/50 p-4 rounded-lg border border-slate-600'>
//                         <div className='flex items-center justify-between'>
//                           <div className='flex items-center gap-4'>
//                             <div className='text-sm'>
//                               <span className='text-slate-400'>Estimated savings: </span>
//                               <span className='text-green-400 font-semibold'>
//                                 ${comparisonMetrics.savings.cost.toFixed(2)} ({comparisonMetrics.savings.costPercent.toFixed(0)}%)
//                               </span>
//                             </div>
//                             <div className='text-sm'>
//                               <span className='text-slate-400'>Re-run cost: </span>
//                               <span className='text-white font-semibold'>${comparisonMetrics.modified.cost.toFixed(2)}</span>
//                             </div>
//                           </div>
//                           <div className='flex items-center gap-2'>
//                             <button onClick={onStartNewReplay} className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2'>
//                               <Play className='w-4 h-4' /> Start Replay
//                             </button>
//                           </div>
//                         </div>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Executed Nodes */}
//           {normalized.executedNodes.length > 0 && (
//             <div className='bg-slate-700/50 p-4 rounded-lg'>
//               <button onClick={() => toggleSection('executed')} className='flex items-center justify-between w-full text-left'>
//                 <h4 className='font-semibold text-white flex items-center gap-2'>
//                   <CheckCircle className='w-4 h-4 text-green-400' /> Executed Nodes ({normalized.executedNodes.length})
//                 </h4>
//                 {expandedSections.has('executed') ? <EyeOff className='w-4 h-4 text-slate-400' /> : <Eye className='w-4 h-4 text-slate-400' />}
//               </button>

//               {expandedSections.has('executed') && (
//                 <div className='mt-3 space-y-2'>
//                   {normalized.executedNodes.map((nodeId: string, index: number) => {
//                     const node =
//                       originalTrace?.nodes?.find((n: any) => n?.id === nodeId) ??
//                       originalTrace?.nodes?.find((n: any) => n?.data?.id === nodeId);
//                     return (
//                       <div key={`${nodeId}-${index}`} className='flex items-center justify-between bg-slate-600/50 p-2 rounded'>
//                         <div className='flex items-center gap-2'>
//                           <span className='text-sm text-slate-400'>#{index + 1}</span>
//                           <span className='text-white font-medium'>{node?.data?.label ?? node?.label ?? nodeId}</span>
//                           {(node?.data?.type || node?.type) && (
//                             <span className='text-xs text-slate-400 bg-slate-500/50 px-2 py-1 rounded'>
//                               {(node?.data?.type || node?.type) as string}
//                             </span>
//                           )}
//                         </div>
//                         <CheckCircle className='w-4 h-4 text-green-400' />
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Skipped Nodes */}
//           {normalized.skippedNodes.length > 0 && (
//             <div className='bg-slate-700/50 p-4 rounded-lg'>
//               <button onClick={() => toggleSection('skipped')} className='flex items-center justify-between w-full text-left'>
//                 <h4 className='font-semibold text-white flex items-center gap-2'>
//                   <XCircle className='w-4 h-4 text-red-400' /> Skipped Nodes ({normalized.skippedNodes.length})
//                 </h4>
//                 {expandedSections.has('skipped') ? <EyeOff className='w-4 h-4 text-slate-400' /> : <Eye className='w-4 h-4 text-slate-400' />}
//               </button>

//               {expandedSections.has('skipped') && (
//                 <div className='mt-3 space-y-2'>
//                   {normalized.skippedNodes.map((nodeId: string, index: number) => {
//                     const node =
//                       originalTrace?.nodes?.find((n: any) => n?.id === nodeId) ??
//                       originalTrace?.nodes?.find((n: any) => n?.data?.id === nodeId);
//                     return (
//                       <div key={`${nodeId}-${index}`} className='flex items-center justify-between bg-slate-600/50 p-2 rounded'>
//                         <div className='flex items-center gap-2'>
//                           <span className='text-sm text-slate-400'>#{index + 1}</span>
//                           <span className='text-white font-medium'>{node?.data?.label ?? node?.label ?? nodeId}</span>
//                           {(node?.data?.type || node?.type) && (
//                             <span className='text-xs text-slate-400 bg-slate-500/50 px-2 py-1 rounded'>
//                               {(node?.data?.type || node?.type) as string}
//                             </span>
//                           )}
//                         </div>
//                         <XCircle className='w-4 h-4 text-red-400' />
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Side Effects */}
//           {normalized.sideEffects.length > 0 && (
//             <div className='bg-slate-700/50 p-4 rounded-lg'>
//               <button onClick={() => toggleSection('sideEffects')} className='flex items-center justify-between w-full text-left'>
//                 <h4 className='font-semibold text-white flex items-center gap-2'>
//                   <AlertTriangle className='w-4 h-4 text-yellow-400' /> Side Effects ({normalized.sideEffects.length})
//                 </h4>
//                 {expandedSections.has('sideEffects') ? <EyeOff className='w-4 h-4 text-slate-400' /> : <Eye className='w-4 h-4 text-slate-400' />}
//               </button>

//               {expandedSections.has('sideEffects') && (
//                 <div className='mt-3 space-y-2'>
//                   {normalized.sideEffects.map((effect: any, index: number) => (
//                     <div key={index} className='bg-slate-600/50 p-3 rounded'>
//                       <div className='flex items-center gap-2 mb-2'>
//                         <span className='text-lg'>⚠️</span>
//                         <span className='text-white font-medium'>{effect?.type ?? 'side_effect'}</span>
//                         <div className={`px-2 py-1 rounded text-xs border ${
//                           effect?.severity === 'critical'
//                             ? 'text-red-400 bg-red-500/20 border-red-500'
//                             : effect?.severity === 'safe'
//                             ? 'text-green-400 bg-green-500/20 border-green-500'
//                             : 'text-yellow-400 bg-yellow-500/20 border-yellow-500'
//                         }`}>
//                           {effect?.severity ?? 'warning'}
//                         </div>
//                       </div>
//                       <p className='text-sm text-slate-300'>{effect?.description ?? 'No description provided.'}</p>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Error */}
//           {normalized.error && (
//             <div className='bg-red-500/10 border border-red-500/20 p-4 rounded-lg'>
//               <h4 className='font-semibold text-red-400 mb-2 flex items-center gap-2'><XCircle className='w-4 h-4' /> Error</h4>
//               <p className='text-sm text-red-300'>{String(normalized.error)}</p>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Footer */}
//       <div className='p-4 border-t border-slate-700 bg-slate-700/30'>
//         <div className='flex items-center justify-between'>
//           <div className='text-sm text-slate-400'>
//             {normalized.success ? (
//               <>Replay completed successfully{normalized.executedNodes.length > 0 && (<span className='ml-2'>• {normalized.executedNodes.length} nodes executed</span>)}</>
//             ) : ('Replay finished - see details above')}
//           </div>
//           <div className='flex items-center gap-2'>
//             <button onClick={onStartNewReplay} className='px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2'>
//               <RotateCcw className='w-4 h-4' /> New Replay
//             </button>
//             <button onClick={onClose} className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors'>
//               Close
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ReplayResults;

import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  BarChart3,
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  RotateCcw,
} from 'lucide-react';

interface ReplayResultsProps {
  result: any;
  originalTrace: any;
  onClose: () => void;
  onStartNewReplay: () => void;
  /** Optional: parent can handle applying node cost/token updates to its trace state */
  onApplyTracePatch?: (patch: {
    executedNodes: string[];
    nodeCosts: Record<
      string,
      {
        cost: number;
        latency: number;
        tokens: { input: number; output: number; total: number };
      }
    >;
    totals?: { cost?: number; latency?: number; tokens?: any };
  }) => void;
}

/* ------------ helpers ------------ */
function safeNumber(n: any, fallback = 0) {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}
function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}
/** Minimal helper to merge nodeCosts into a trace (fallback if no onApplyTracePatch is provided) */
function applyPatchToTrace(
  trace: any,
  patch: { nodeCosts: Record<string, any> } | null | undefined
) {
  if (!trace || !patch?.nodeCosts || !Array.isArray(trace.nodes)) return trace;
  for (const [nodeId, m] of Object.entries(patch.nodeCosts)) {
    const node = trace.nodes.find(
      (n: any) => n?.id === nodeId || n?.data?.id === nodeId
    );
    if (!node) continue;
    node.data = node.data ?? {};
    if (m?.tokens) node.data.tokens = m.tokens;
    if (typeof m?.cost === 'number') node.data.cost = m.cost;
    if (typeof m?.latency === 'number') node.data.latency = m.latency;
  }
  // recompute simple totalCost
  const sumCost = trace.nodes.reduce(
    (s: number, n: any) => s + (Number(n?.data?.cost) || Number(n?.cost) || 0),
    0
  );
  trace.totalCost = sumCost;
  return trace;
}
/* --------------------------------- */

/* Normalize many server shapes into one */
function normalizeResult(raw: any) {
  const r = raw ?? {};

  const toIdList = (v: any): string[] => {
    const arr = asArray<any>(v);
    return arr.map((x) =>
      typeof x === 'string'
        ? x
        : x?.id ?? x?.nodeId ?? x?.runId ?? x?.label ?? JSON.stringify(x)
    );
  };

  const text: string =
    typeof r.text === 'string'
      ? r.text
      : typeof r.output === 'string'
      ? r.output
      : Array.isArray(r.deltas)
      ? r.deltas.join('')
      : typeof r.deltaAccumulated === 'string'
      ? r.deltaAccumulated
      : typeof r.message === 'string'
      ? r.message
      : typeof r.content === 'string'
      ? r.content
      : typeof r?.llm?.text === 'string'
      ? r.llm.text
      : typeof r?.response?.text === 'string'
      ? r.response.text
      : '';

  const rawCost =
    r.totalCost ??
    r.cost ??
    r.metrics?.totalCost ??
    r.metrics?.cost ??
    r.llm?.cost ??
    r.response?.cost ??
    r.usage?.cost;

  const rawLatency =
    r.totalLatency ??
    r.latency ??
    r.durationMs ??
    r.metrics?.latency ??
    r.metrics?.totalLatency;

  // pick up live tokens/cost if provided by backend
  const llmTokens =
    r.llmTokens && typeof r.llmTokens === 'object'
      ? {
          input: safeNumber(r.llmTokens.input, 0),
          output: safeNumber(r.llmTokens.output, 0),
          total: safeNumber(
            r.llmTokens.total,
            safeNumber(r.llmTokens.input, 0) + safeNumber(r.llmTokens.output, 0)
          ),
        }
      : undefined;

  const replayLlmCost = safeNumber(r.replayLlmCost, 0);

  return {
    success: Boolean(r.success ?? r.ok ?? false),
    newTraceId: r.newTraceId ?? undefined,
    executedNodes: toIdList(
      r.executedNodes ??
        r.nodesExecuted ??
        r.steps ??
        r.events?.filter?.((e: any) => e?.type === 'executed')
    ),
    skippedNodes: toIdList(
      r.skippedNodes ??
        r.nodesSkipped ??
        r.events?.filter?.((e: any) => e?.type === 'skipped')
    ),
    sideEffects: asArray<any>(
      r.sideEffects ??
        r.effects ??
        r.events?.filter?.((e: any) => e?.type === 'side_effect')
    ),
    nodeCosts:
      r.nodeCosts && typeof r.nodeCosts === 'object' ? r.nodeCosts : {}, // ⬅️ NEW
    error: r.error ?? undefined,
    totalCost: safeNumber(rawCost, 0),
    totalLatency: safeNumber(rawLatency, 0),
    text,
    llmTokens,
    replayLlmCost,
  };
}

/* detect whether any tool nodes executed */
function anyToolsExecuted(executedIds: string[], originalTrace: any): boolean {
  const nodes = asArray<any>(originalTrace?.nodes);
  if (!nodes.length || !executedIds.length) return false;
  for (const id of executedIds) {
    const n = nodes.find((x) => x?.id === id || x?.data?.id === id);
    const t = n?.data?.type || n?.type;
    if (typeof t === 'string' && t.toLowerCase().includes('tool')) return true;
  }
  return false;
}

/* strip hallucinated Action/Observation blocks if no real tools ran */
function sanitizeModelText(
  text: string,
  executedIds: string[],
  originalTrace: any
): string {
  if (!text) return '';
  if (anyToolsExecuted(executedIds, originalTrace)) return text;
  const lines = text.split(/\r?\n/);
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith('action:')) return false;
    if (trimmed.startsWith('observation:')) return false;
    return true;
  });
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n');
}

/* approximate rerun cost from original nodes if backend didn't send anything */
function approximateCostFromOriginal(
  executedIds: string[],
  originalTrace: any
): number {
  const nodes = asArray<any>(originalTrace?.nodes);
  if (!nodes.length || !executedIds.length) return 0;
  return executedIds.reduce((sum, id) => {
    const n = nodes.find((x) => x?.id === id || x?.data?.id === id);
    const c =
      safeNumber(n?.data?.cost, NaN) ??
      safeNumber(n?.cost, NaN) ??
      safeNumber(n?.metrics?.cost, NaN);
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}

const ReplayResults: React.FC<ReplayResultsProps> = ({
  result,
  originalTrace,
  onClose,
  onStartNewReplay,
  onApplyTracePatch, // ⬅️ NEW (optional)
}) => {
  const normalized = useMemo(() => normalizeResult(result), [result]);

  const displayText = useMemo(
    () =>
      sanitizeModelText(
        normalized.text,
        normalized.executedNodes,
        originalTrace
      ),
    [normalized.text, normalized.executedNodes, originalTrace]
  );

  // Prefer server totalCost; if absent, prefer replayLlmCost; else fallback to original node approximation
  const effectiveCost = useMemo(() => {
    const fromServer = safeNumber(normalized.totalCost, 0);
    if (fromServer > 0) return fromServer;
    const fromReplay = safeNumber(normalized.replayLlmCost, 0);
    if (fromReplay > 0) return fromReplay;
    return approximateCostFromOriginal(normalized.executedNodes, originalTrace);
  }, [
    normalized.totalCost,
    normalized.replayLlmCost,
    normalized.executedNodes,
    originalTrace,
  ]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'comparison'])
  );
  const [showComparison, setShowComparison] = useState(true);
  const [comparisonView, setComparisonView] = useState<'overview' | 'detailed'>(
    'overview'
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const getComparisonIcon = (original: number, newValue: number) => {
    if (newValue > original)
      return <TrendingUp className='w-4 h-4 text-red-400' />;
    if (newValue < original)
      return <TrendingDown className='w-4 h-4 text-green-400' />;
    return <Minus className='w-4 h-4 text-slate-400' />;
  };

  const formatComparison = (
    original: number,
    newValue: number,
    unit: string = ''
  ) => {
    const o = safeNumber(original, 0);
    const n = safeNumber(newValue, 0);
    const diff = n - o;
    const percentChange = o > 0 ? ((diff / o) * 100).toFixed(1) : '0.0';
    const sign = diff > 0 ? '+' : diff < 0 ? '' : '';
    return (
      <div className='flex items-center gap-2'>
        <span className='text-white font-medium'>
          {n.toFixed(unit ? 0 : 6)}
          {unit}
        </span>
        {getComparisonIcon(o, n)}
        <span
          className={`text-sm ${
            diff > 0
              ? 'text-red-400'
              : diff < 0
              ? 'text-green-400'
              : 'text-slate-400'
          }`}
        >
          {sign}
          {n.toFixed(unit ? 0 : 6)}
          {unit} ({sign}
          {percentChange}%)
        </span>
      </div>
    );
  };

  // Metrics for the two sides
  const comparisonMetrics = useMemo(() => {
    if (!originalTrace) return null;

    const origNodesArray = asArray<any>(originalTrace?.nodes);
    const originalCost = safeNumber(originalTrace?.totalCost, NaN) ?? 0;
    const originalLatency = safeNumber(originalTrace?.totalLatency, 0);
    const originalNodes = origNodesArray.length;
    const originalTokens =
      origNodesArray.reduce(
        (sum: number, node: any) =>
          sum + safeNumber(node?.data?.tokens?.total ?? node?.tokens?.total, 0),
        0
      ) || 0;

    const newCost = safeNumber(effectiveCost, 0);
    const newLatency = safeNumber(normalized.totalLatency, 0);
    const newNodes = normalized.executedNodes.length;

    // Prefer llmTokens (from server) for Modified; otherwise fallback to summing executed originals
    const newTokens =
      (normalized.llmTokens?.total ??
        normalized.executedNodes.reduce((sum: number, nodeId: string) => {
          const node = origNodesArray.find(
            (n: any) => n?.id === nodeId || n?.data?.id === nodeId
          );
          return (
            sum +
            safeNumber(node?.data?.tokens?.total ?? node?.tokens?.total, 0)
          );
        }, 0)) ||
      0;

    const costSavings = originalCost - newCost;
    const costSavingsPercent =
      originalCost > 0 ? (costSavings / originalCost) * 100 : 0;
    const latencySavings = originalLatency - newLatency;
    const latencySavingsPercent =
      originalLatency > 0 ? (latencySavings / originalLatency) * 100 : 0;
    const tokenSavings = originalTokens - newTokens;
    const tokenSavingsPercent =
      originalTokens > 0 ? (tokenSavings / originalTokens) * 100 : 0;

    return {
      original: {
        cost: safeNumber(originalCost, 0),
        latency: originalLatency,
        nodes: originalNodes,
        tokens: originalTokens,
      },
      modified: {
        cost: newCost,
        latency: newLatency,
        nodes: newNodes,
        tokens: newTokens,
      },
      savings: {
        cost: costSavings,
        costPercent: costSavingsPercent,
        latency: latencySavings,
        latencyPercent: latencySavingsPercent,
        tokens: tokenSavings,
        tokenPercent: tokenSavingsPercent,
      },
    };
  }, [
    originalTrace,
    normalized.totalLatency,
    normalized.executedNodes,
    normalized.llmTokens,
    effectiveCost,
  ]);

  // Empty state (allow text-only)
  if (
    !normalized ||
    (!normalized.success &&
      !normalized.error &&
      !displayText &&
      normalized.executedNodes.length === 0 &&
      normalized.skippedNodes.length === 0 &&
      normalized.sideEffects.length === 0)
  ) {
    return (
      <div className='bg-slate-800 border border-slate-700 rounded-lg p-6'>
        <div className='text-center text-slate-400'>
          <Play className='w-12 h-12 mx-auto mb-4' />
          <p>No replay results to display</p>
        </div>
      </div>
    );
  }

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

  // Quick presence check for nodeCosts
  const hasNodeCosts =
    normalized.nodeCosts && Object.keys(normalized.nodeCosts).length > 0;

  return (
    <div className='bg-slate-800 border border-slate-700 rounded-lg overflow-hidden'>
      {/* Header */}
      <div className='p-4 border-b border-slate-700'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            {normalized.success ? (
              <CheckCircle className='w-5 h-5 text-green-400' />
            ) : (
              <XCircle className='w-5 h-5 text-red-400' />
            )}
            <h3 className='text-lg font-semibold text-white'>Replay Results</h3>
            <div
              className={`px-2 py-1 rounded text-xs border ${
                normalized.success
                  ? 'text-green-400 bg-green-500/20 border-green-500'
                  : 'text-red-400 bg-red-500/20 border-red-500'
              }`}
            >
              {normalized.success ? 'SUCCESS' : 'RESULT'}
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className='text-slate-400 hover:text-white transition-colors'
              title='Toggle comparison view'
              disabled={!originalTrace}
            >
              {showComparison ? (
                <EyeOff className='w-5 h-5' />
              ) : (
                <Eye className='w-5 h-5' />
              )}
            </button>
            <button
              onClick={onClose}
              className='text-slate-400 hover:text-white transition-colors'
            >
              <XCircle className='w-5 h-5' />
            </button>
          </div>
        </div>
        {normalized.newTraceId && (
          <p className='text-sm text-slate-400 mt-1'>
            New Trace ID:{' '}
            <span className='text-white font-mono'>
              {normalized.newTraceId}
            </span>
          </p>
        )}
      </div>

      {/* Content */}
      <div className='p-4 max-h-96 overflow-auto'>
        <div className='space-y-4'>
          {/* Model Output */}
          {displayText && (
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <h4 className='font-semibold text-white mb-2'>Model Output</h4>
              <pre className='whitespace-pre-wrap text-sm text-slate-200 bg-slate-900/60 border border-slate-800 rounded p-3'>
                {displayText}
              </pre>
            </div>
          )}

          {/* Summary */}
          <div className='bg-slate-700/50 p-4 rounded-lg'>
            <button
              onClick={() => toggleSection('summary')}
              className='flex items-center justify-between w-full text-left'
            >
              <h4 className='font-semibold text-white'>Execution Summary</h4>
              {expandedSections.has('summary') ? (
                <EyeOff className='w-4 h-4 text-slate-400' />
              ) : (
                <Eye className='w-4 h-4 text-slate-400' />
              )}
            </button>

            {expandedSections.has('summary') && (
              <div className='mt-3 grid grid-cols-2 gap-4'>
                <div>
                  <div className='text-sm text-slate-400'>Executed Nodes</div>
                  <div className='text-white font-medium'>
                    {normalized.executedNodes.length}
                  </div>
                </div>
                <div>
                  <div className='text-sm text-slate-400'>Skipped Nodes</div>
                  <div className='text-white font-medium'>
                    {normalized.skippedNodes.length}
                  </div>
                </div>
                <div>
                  <div className='text-sm text-slate-400'>Total Cost</div>
                  {showComparison && originalTrace ? (
                    formatComparison(
                      safeNumber(originalTrace?.totalCost, 0),
                      effectiveCost,
                      ''
                    )
                  ) : (
                    <div className='text-white font-medium'>
                      ${safeNumber(effectiveCost, 0).toFixed(6)}
                    </div>
                  )}
                </div>
                <div>
                  <div className='text-sm text-slate-400'>Total Latency</div>
                  {showComparison && originalTrace ? (
                    formatComparison(
                      safeNumber(originalTrace?.totalLatency, 0),
                      safeNumber(normalized.totalLatency, 0),
                      'ms'
                    )
                  ) : (
                    <div className='text-white font-medium'>
                      {safeNumber(normalized.totalLatency, 0).toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Comparison */}
          {comparisonMetrics && (
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <div className='flex items-center justify-between mb-4'>
                <button
                  onClick={() => toggleSection('comparison')}
                  className='flex items-center gap-2 text-left'
                >
                  <BarChart3 className='w-5 h-5 text-blue-400' />
                  <h4 className='font-semibold text-white'>
                    Replay Studio Comparison
                  </h4>
                  {expandedSections.has('comparison') ? (
                    <EyeOff className='w-4 h-4 text-slate-400' />
                  ) : (
                    <Eye className='w-4 h-4 text-slate-400' />
                  )}
                </button>
                <div className='flex gap-2'>
                  <button
                    onClick={() => setComparisonView('overview')}
                    className={`px-3 py-1 rounded text-sm ${
                      comparisonView === 'overview'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setComparisonView('detailed')}
                    className={`px-3 py-1 rounded text-sm ${
                      comparisonView === 'detailed'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    Detailed
                  </button>
                </div>
              </div>

              {expandedSections.has('comparison') && (
                <div className='space-y-4'>
                  {comparisonView === 'overview' ? (
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                      {/* Original */}
                      <div className='bg-slate-800/50 p-4 rounded-lg border border-slate-600'>
                        <div className='flex items-center gap-2 mb-3'>
                          <div className='w-3 h-3 bg-red-500 rounded-full' />
                          <h5 className='font-semibold text-white'>Original</h5>
                        </div>
                        <div className='space-y-3'>
                          <div className='bg-slate-700/30 p-3 rounded border-l-4 border-red-500'>
                            <div className='text-sm text-slate-400 mb-2'>
                              Result
                            </div>
                            <div className='space-y-1 text-sm'>
                              <div className='flex justify-between'>
                                <span className='text-slate-300'>Tokens:</span>
                                <span className='text-white font-medium'>
                                  {comparisonMetrics.original.tokens.toLocaleString()}
                                </span>
                              </div>
                              <div className='flex justify-between'>
                                <span className='text-slate-300'>Cost:</span>
                                <span className='text-white font-medium'>
                                  ${comparisonMetrics.original.cost.toFixed(2)}
                                </span>
                              </div>
                              <div className='flex justify-between'>
                                <span className='text-slate-300'>Latency:</span>
                                <span className='text-white font-medium'>
                                  {(
                                    comparisonMetrics.original.latency / 1000
                                  ).toFixed(2)}
                                  s
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Modified */}
                      <div className='bg-slate-800/50 p-4 rounded-lg border border-green-500'>
                        <div className='flex items-center gap-2 mb-3'>
                          <div className='w-3 h-3 bg-green-500 rounded-full' />
                          <h5 className='font-semibold text-white'>Modified</h5>
                        </div>
                        <div className='space-y-3'>
                          <div className='bg-green-500/10 p-3 rounded border border-green-500'>
                            <div className='text-sm text-slate-400 mb-2'>
                              Replay Result
                            </div>
                            <div className='space-y-1 text-sm'>
                              <div className='flex justify-between'>
                                <span className='text-slate-300'>Tokens:</span>
                                <span className='text-white font-medium'>
                                  ~
                                  {comparisonMetrics.modified.tokens.toLocaleString()}
                                </span>
                                <span className='text-green-400 text-xs'>
                                  (
                                  {comparisonMetrics.savings.tokenPercent.toFixed(
                                    0
                                  )}
                                  % reduction)
                                </span>
                              </div>
                              <div className='flex justify-between'>
                                <span className='text-slate-300'>Cost:</span>
                                <span className='text-white font-medium'>
                                  ~${comparisonMetrics.modified.cost.toFixed(2)}
                                </span>
                                <span className='text-green-400 text-xs'>
                                  (
                                  {comparisonMetrics.savings.costPercent.toFixed(
                                    0
                                  )}
                                  % savings)
                                </span>
                              </div>
                              <div className='flex justify-between'>
                                <span className='text-slate-300'>Latency:</span>
                                <span className='text-white font-medium'>
                                  ~
                                  {(
                                    comparisonMetrics.modified.latency / 1000
                                  ).toFixed(2)}
                                  s
                                </span>
                                <span className='text-green-400 text-xs'>
                                  (
                                  {comparisonMetrics.savings.latencyPercent.toFixed(
                                    0
                                  )}
                                  % faster)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Detailed
                    <div className='space-y-4'>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='bg-slate-800/30 p-4 rounded-lg'>
                          <h6 className='font-semibold text-white mb-3 flex items-center gap-2'>
                            <Target className='w-4 h-4 text-blue-400' />{' '}
                            Original Execution
                          </h6>
                          <div className='space-y-2 text-sm'>
                            <div className='flex justify-between'>
                              <span className='text-slate-400'>
                                Total Cost:
                              </span>
                              <span className='text-white'>
                                ${comparisonMetrics.original.cost.toFixed(6)}
                              </span>
                            </div>
                            <div className='flex justify-between'>
                              <span className='text-slate-400'>
                                Total Latency:
                              </span>
                              <span className='text-white'>
                                {(
                                  comparisonMetrics.original.latency / 1000
                                ).toFixed(2)}
                                s
                              </span>
                            </div>
                            <div className='flex justify-between'>
                              <span className='text-slate-400'>
                                Total Tokens:
                              </span>
                              <span className='text-white'>
                                {comparisonMetrics.original.tokens.toLocaleString()}
                              </span>
                            </div>
                            <div className='flex justify-between'>
                              <span className='text-slate-400'>
                                Nodes Executed:
                              </span>
                              <span className='text-white'>
                                {comparisonMetrics.original.nodes}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className='bg-slate-800/30 p-4 rounded-lg'>
                          <h6 className='font-semibold text-white mb-3 flex items-center gap-2'>
                            <Zap className='w-4 h-4 text-green-400' /> Modified
                            Execution
                          </h6>
                          <div className='space-y-2 text-sm'>
                            <div className='flex justify-between'>
                              <span className='text-slate-400'>
                                Total Cost:
                              </span>
                              <span className='text-white'>
                                ${comparisonMetrics.modified.cost.toFixed(6)}
                              </span>
                            </div>
                            <div className='flex justify-between'>
                              <span className='text-slate-400'>
                                Total Latency:
                              </span>
                              <span className='text-white'>
                                {(
                                  comparisonMetrics.modified.latency / 1000
                                ).toFixed(2)}
                                s
                              </span>
                            </div>
                            <div className='flex justify-between'>
                              <span className='text-slate-400'>
                                Total Tokens:
                              </span>
                              <span className='text-white'>
                                {comparisonMetrics.modified.tokens.toLocaleString()}
                              </span>
                            </div>
                            <div className='flex justify-between'>
                              <span className='text-slate-400'>
                                Nodes Executed:
                              </span>
                              <span className='text-white'>
                                {comparisonMetrics.modified.nodes}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='bg-green-500/10 border border-green-500/20 p-4 rounded-lg'>
                        <h6 className='font-semibold text-green-400 mb-3'>
                          Savings Summary
                        </h6>
                        <div className='grid grid-cols-3 gap-4 text-sm'>
                          <div className='text-center'>
                            <div className='text-2xl font-bold text-green-400'>
                              ${comparisonMetrics.savings.cost.toFixed(2)}
                            </div>
                            <div className='text-slate-400'>Cost Savings</div>
                            <div className='text-green-400 text-xs'>
                              (
                              {comparisonMetrics.savings.costPercent.toFixed(1)}
                              %)
                            </div>
                          </div>
                          <div className='text-center'>
                            <div className='text-2xl font-bold text-green-400'>
                              {(
                                comparisonMetrics.savings.latency / 1000
                              ).toFixed(1)}
                              s
                            </div>
                            <div className='text-slate-400'>Time Savings</div>
                            <div className='text-green-400 text-xs'>
                              (
                              {comparisonMetrics.savings.latencyPercent.toFixed(
                                1
                              )}
                              %)
                            </div>
                          </div>
                          <div className='text-center'>
                            <div className='text-2xl font-bold text-green-400'>
                              {comparisonMetrics.savings.tokens.toLocaleString()}
                            </div>
                            <div className='text-slate-400'>Token Savings</div>
                            <div className='text-green-400 text-xs'>
                              (
                              {comparisonMetrics.savings.tokenPercent.toFixed(
                                1
                              )}
                              %)
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='bg-slate-800/50 p-4 rounded-lg border border-slate-600'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-4'>
                            <div className='text-sm'>
                              <span className='text-slate-400'>
                                Estimated savings:{' '}
                              </span>
                              <span className='text-green-400 font-semibold'>
                                ${comparisonMetrics.savings.cost.toFixed(2)} (
                                {comparisonMetrics.savings.costPercent.toFixed(
                                  0
                                )}
                                %)
                              </span>
                            </div>
                            <div className='text-sm'>
                              <span className='text-slate-400'>
                                Re-run cost:{' '}
                              </span>
                              <span className='text-white font-semibold'>
                                ${comparisonMetrics.modified.cost.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className='flex items-center gap-2'>
                            <button
                              onClick={onStartNewReplay}
                              className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2'
                            >
                              <Play className='w-4 h-4' /> Start Replay
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Executed Nodes (now shows per-node cost delta if nodeCosts present) */}
          {normalized.executedNodes.length > 0 && (
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <button
                onClick={() => toggleSection('executed')}
                className='flex items-center justify-between w-full text-left'
              >
                <h4 className='font-semibold text-white flex items-center gap-2'>
                  <CheckCircle className='w-4 h-4 text-green-400' /> Executed
                  Nodes ({normalized.executedNodes.length})
                </h4>
                {expandedSections.has('executed') ? (
                  <EyeOff className='w-4 h-4 text-slate-400' />
                ) : (
                  <Eye className='w-4 h-4 text-slate-400' />
                )}
              </button>

              {expandedSections.has('executed') && (
                <div className='mt-3 space-y-2'>
                  {normalized.executedNodes.map(
                    (nodeId: string, index: number) => {
                      const node =
                        originalTrace?.nodes?.find(
                          (n: any) => n?.id === nodeId
                        ) ??
                        originalTrace?.nodes?.find(
                          (n: any) => n?.data?.id === nodeId
                        );

                      const newMetrics = (normalized.nodeCosts ?? {})[nodeId];
                      const oldCost = safeNumber(
                        node?.data?.cost ?? node?.cost,
                        0
                      );
                      const newCost = safeNumber(newMetrics?.cost, NaN);
                      const showDelta = Number.isFinite(newCost);

                      return (
                        <div
                          key={`${nodeId}-${index}`}
                          className='flex items-center justify-between bg-slate-600/50 p-2 rounded'
                        >
                          <div className='flex items-center gap-2'>
                            <span className='text-sm text-slate-400'>
                              #{index + 1}
                            </span>
                            <span className='text-white font-medium'>
                              {node?.data?.label ?? node?.label ?? nodeId}
                            </span>
                            {(node?.data?.type || node?.type) && (
                              <span className='text-xs text-slate-400 bg-slate-500/50 px-2 py-1 rounded'>
                                {(node?.data?.type || node?.type) as string}
                              </span>
                            )}
                          </div>

                          <div className='flex items-center gap-3 text-xs'>
                            <span className='text-slate-300'>cost:</span>
                            <span className='text-white font-semibold'>
                              {showDelta ? `$${newCost.toFixed(6)}` : '—'}
                            </span>
                            {showDelta && (
                              <span
                                className={`ml-1 ${
                                  newCost <= oldCost
                                    ? 'text-green-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {newCost <= oldCost ? '↓' : '↑'}{' '}
                                {Math.abs(newCost - oldCost).toFixed(6)}
                              </span>
                            )}
                          </div>

                          <CheckCircle className='w-4 h-4 text-green-400' />
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}

          {/* Skipped Nodes */}
          {normalized.skippedNodes.length > 0 && (
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <button
                onClick={() => toggleSection('skipped')}
                className='flex items-center justify-between w-full text-left'
              >
                <h4 className='font-semibold text-white flex items-center gap-2'>
                  <XCircle className='w-4 h-4 text-red-400' /> Skipped Nodes (
                  {normalized.skippedNodes.length})
                </h4>
                {expandedSections.has('skipped') ? (
                  <EyeOff className='w-4 h-4 text-slate-400' />
                ) : (
                  <Eye className='w-4 h-4 text-slate-400' />
                )}
              </button>

              {expandedSections.has('skipped') && (
                <div className='mt-3 space-y-2'>
                  {normalized.skippedNodes.map(
                    (nodeId: string, index: number) => {
                      const node =
                        originalTrace?.nodes?.find(
                          (n: any) => n?.id === nodeId
                        ) ??
                        originalTrace?.nodes?.find(
                          (n: any) => n?.data?.id === nodeId
                        );
                      return (
                        <div
                          key={`${nodeId}-${index}`}
                          className='flex items-center justify-between bg-slate-600/50 p-2 rounded'
                        >
                          <div className='flex items-center gap-2'>
                            <span className='text-sm text-slate-400'>
                              #{index + 1}
                            </span>
                            <span className='text-white font-medium'>
                              {node?.data?.label ?? node?.label ?? nodeId}
                            </span>
                            {(node?.data?.type || node?.type) && (
                              <span className='text-xs text-slate-400 bg-slate-500/50 px-2 py-1 rounded'>
                                {(node?.data?.type || node?.type) as string}
                              </span>
                            )}
                          </div>
                          <XCircle className='w-4 h-4 text-red-400' />
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}

          {/* Side Effects */}
          {normalized.sideEffects.length > 0 && (
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <button
                onClick={() => toggleSection('sideEffects')}
                className='flex items-center justify-between w-full text-left'
              >
                <h4 className='font-semibold text-white flex items-center gap-2'>
                  <AlertTriangle className='w-4 h-4 text-yellow-400' /> Side
                  Effects ({normalized.sideEffects.length})
                </h4>
                {expandedSections.has('sideEffects') ? (
                  <EyeOff className='w-4 h-4 text-slate-400' />
                ) : (
                  <Eye className='w-4 h-4 text-slate-400' />
                )}
              </button>

              {expandedSections.has('sideEffects') && (
                <div className='mt-3 space-y-2'>
                  {normalized.sideEffects.map((effect: any, index: number) => (
                    <div key={index} className='bg-slate-600/50 p-3 rounded'>
                      <div className='flex items-center gap-2 mb-2'>
                        <span className='text-lg'>⚠️</span>
                        <span className='text-white font-medium'>
                          {effect?.type ?? 'side_effect'}
                        </span>
                        <div
                          className={`px-2 py-1 rounded text-xs border ${
                            effect?.severity === 'critical'
                              ? 'text-red-400 bg-red-500/20 border-red-500'
                              : effect?.severity === 'safe'
                              ? 'text-green-400 bg-green-500/20 border-green-500'
                              : 'text-yellow-400 bg-yellow-500/20 border-yellow-500'
                          }`}
                        >
                          {effect?.severity ?? 'warning'}
                        </div>
                      </div>
                      <p className='text-sm text-slate-300'>
                        {effect?.description ?? 'No description provided.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {normalized.error && (
            <div className='bg-red-500/10 border border-red-500/20 p-4 rounded-lg'>
              <h4 className='font-semibold text-red-400 mb-2 flex items-center gap-2'>
                <XCircle className='w-4 h-4' /> Error
              </h4>
              <p className='text-sm text-red-300'>{String(normalized.error)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className='p-4 border-t border-slate-700 bg-slate-700/30'>
        <div className='flex items-center justify-between'>
          <div className='text-sm text-slate-400'>
            {normalized.success ? (
              <>
                Replay completed successfully
                {normalized.executedNodes.length > 0 && (
                  <span className='ml-2'>
                    • {normalized.executedNodes.length} nodes executed
                  </span>
                )}
              </>
            ) : (
              'Replay finished - see details above'
            )}
          </div>
          <div className='flex items-center gap-2'>
            {hasNodeCosts && (
              <button
                onClick={() => {
                  const patch = {
                    executedNodes: normalized.executedNodes,
                    nodeCosts: normalized.nodeCosts,
                    totals: {
                      cost: normalized.totalCost,
                      latency: normalized.totalLatency,
                      tokens: normalized.llmTokens,
                    },
                  };
                  if (typeof onApplyTracePatch === 'function') {
                    onApplyTracePatch(patch);
                  } else {
                    // Fallback: do a local merge (in-place) if parent didn't provide a handler
                    applyPatchToTrace(originalTrace, patch);
                  }
                }}
                className='px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors'
                title='Apply per-node cost/token updates to the current trace'
              >
                Apply to Trace
              </button>
            )}
            <button
              onClick={onStartNewReplay}
              className='px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2'
            >
              <RotateCcw className='w-4 h-4' /> New Replay
            </button>
            <button
              onClick={onClose}
              className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors'
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplayResults;
