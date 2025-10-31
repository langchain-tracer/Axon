import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Play,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  EyeOff,
  BarChart3,
  Zap,
  Target,
} from 'lucide-react';

interface ReplayResultsProps {
  result: any;
  originalTrace: any;
  onClose: () => void;
  onStartNewReplay: () => void;
}

/* ------------ Minimal safety helpers (NEW) ------------ */
function safeNumber(n: any, fallback = 0) {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}
function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}
function normalizeResult(raw: any) {
  const r = raw ?? {};
  return {
    success: !!r.success,
    newTraceId: r.newTraceId ?? undefined,
    executedNodes: asArray<string>(r.executedNodes),
    skippedNodes: asArray<string>(r.skippedNodes),
    sideEffects: asArray<any>(r.sideEffects),
    error: r.error ?? undefined,
    totalCost: safeNumber(r.totalCost, 0),
    totalLatency: safeNumber(r.totalLatency, 0),
  };
}
/* ----------------------------------------------------- */

const ReplayResults: React.FC<ReplayResultsProps> = ({
  result,
  originalTrace,
  onClose,
  onStartNewReplay,
}) => {
  // Normalize once; prevents undefined .length crashes
  const normalized = useMemo(() => normalizeResult(result), [result]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'comparison'])
  );
  const [showComparison, setShowComparison] = useState(true);
  const [comparisonView, setComparisonView] = useState<'overview' | 'detailed'>(
    'overview'
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) newSet.delete(section);
      else newSet.add(section);
      return newSet;
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
          {n.toFixed(6)}
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
          {diff.toFixed(6)}
          {unit} ({sign}
          {percentChange}%)
        </span>
      </div>
    );
  };

  // Calculate comprehensive comparison metrics (DEFENSIVE)
  const calculateComparisonMetrics = () => {
    const origNodesArray = asArray<any>(originalTrace?.nodes);
    const originalCost = safeNumber(originalTrace?.totalCost, 0);
    const originalLatency = safeNumber(originalTrace?.totalLatency, 0);
    const originalNodes = origNodesArray.length;
    const originalTokens =
      origNodesArray.reduce(
        (sum: number, node: any) => sum + safeNumber(node?.tokens?.total, 0),
        0
      ) || 0;

    const newCost = safeNumber(normalized.totalCost, 0);
    const newLatency = safeNumber(normalized.totalLatency, 0);
    const newNodes = normalized.executedNodes.length;

    const newTokens =
      normalized.executedNodes.reduce((sum: number, nodeId: string) => {
        const node = origNodesArray.find((n: any) => n?.id === nodeId);
        return sum + safeNumber(node?.tokens?.total, 0);
      }, 0) || 0;

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
        cost: originalCost,
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
  };

  // Only compute metrics if we have an original trace to compare to
  const comparisonMetrics = useMemo(
    () => (originalTrace ? calculateComparisonMetrics() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [originalTrace, normalized]
  );

  const getSideEffectIcon = (type: string) => {
    switch (type) {
      case 'email':
        return '📧';
      case 'api_call':
        return '🌐';
      case 'database_write':
        return '💾';
      case 'payment':
        return '💳';
      case 'external_service':
        return '🔗';
      default:
        return '⚠️';
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

  // If we truly have nothing meaningful
  if (!normalized || (!normalized.success && !normalized.error)) {
    return (
      <div className='bg-slate-800 border border-slate-700 rounded-lg p-6'>
        <div className='text-center text-slate-400'>
          <Play className='w-12 h-12 mx-auto mb-4' />
          <p>No replay results to display</p>
        </div>
      </div>
    );
  }

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
              {normalized.success ? 'SUCCESS' : 'FAILED'}
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
                      originalTrace?.totalCost || 0,
                      normalized.totalCost,
                      ''
                    )
                  ) : (
                    <div className='text-white font-medium'>
                      ${normalized.totalCost.toFixed(6)}
                    </div>
                  )}
                </div>
                <div>
                  <div className='text-sm text-slate-400'>Total Latency</div>
                  {showComparison && originalTrace ? (
                    formatComparison(
                      originalTrace?.totalLatency || 0,
                      normalized.totalLatency,
                      'ms'
                    )
                  ) : (
                    <div className='text-white font-medium'>
                      {normalized.totalLatency.toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Comprehensive Comparison */}
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
                      {/* Original Column */}
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

                      {/* Modified Column */}
                      <div className='bg-slate-800/50 p-4 rounded-lg border border-green-500'>
                        <div className='flex items-center gap-2 mb-3'>
                          <div className='w-3 h-3 bg-green-500 rounded-full' />
                          <h5 className='font-semibold text-white'>Modified</h5>
                        </div>
                        <div className='space-y-3'>
                          <div className='bg-green-500/10 p-3 rounded border border-green-500'>
                            <div className='text-sm text-slate-400 mb-2'>
                              Projected Result
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
                    // Detailed Comparison
                    <div className='space-y-4'>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='bg-slate-800/30 p-4 rounded-lg'>
                          <h6 className='font-semibold text-white mb-3 flex items-center gap-2'>
                            <Target className='w-4 h-4 text-blue-400' />
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
                            <Zap className='w-4 h-4 text-green-400' />
                            Modified Execution
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
                    </div>
                  )}

                  {/* Bottom Summary Bar */}
                  <div className='bg-slate-800/50 p-4 rounded-lg border border-slate-600'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-4'>
                        <div className='text-sm'>
                          <span className='text-slate-400'>
                            Estimated savings:{' '}
                          </span>
                          <span className='text-green-400 font-semibold'>
                            ${comparisonMetrics.savings.cost.toFixed(2)} (
                            {comparisonMetrics.savings.costPercent.toFixed(0)}%)
                          </span>
                        </div>
                        <div className='text-sm'>
                          <span className='text-slate-400'>Re-run cost: </span>
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
                          <Play className='w-4 h-4' />
                          Start Replay
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Executed Nodes */}
          {normalized.executedNodes.length > 0 && (
            <div className='bg-slate-700/50 p-4 rounded-lg'>
              <button
                onClick={() => toggleSection('executed')}
                className='flex items-center justify-between w-full text-left'
              >
                <h4 className='font-semibold text-white flex items-center gap-2'>
                  <CheckCircle className='w-4 h-4 text-green-400' />
                  Executed Nodes ({normalized.executedNodes.length})
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
                      const node = originalTrace?.nodes?.find(
                        (n: any) => n?.id === nodeId
                      );
                      return (
                        <div
                          key={nodeId}
                          className='flex items-center justify-between bg-slate-600/50 p-2 rounded'
                        >
                          <div className='flex items-center gap-2'>
                            <span className='text-sm text-slate-400'>
                              #{index + 1}
                            </span>
                            <span className='text-white font-medium'>
                              {node?.label || nodeId}
                            </span>
                            {node?.type && (
                              <span className='text-xs text-slate-400 bg-slate-500/50 px-2 py-1 rounded'>
                                {node.type}
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
                  <XCircle className='w-4 h-4 text-red-400' />
                  Skipped Nodes ({normalized.skippedNodes.length})
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
                      const node = originalTrace?.nodes?.find(
                        (n: any) => n?.id === nodeId
                      );
                      return (
                        <div
                          key={nodeId}
                          className='flex items-center justify-between bg-slate-600/50 p-2 rounded'
                        >
                          <div className='flex items-center gap-2'>
                            <span className='text-sm text-slate-400'>
                              #{index + 1}
                            </span>
                            <span className='text-white font-medium'>
                              {node?.label || nodeId}
                            </span>
                            {node?.type && (
                              <span className='text-xs text-slate-400 bg-slate-500/50 px-2 py-1 rounded'>
                                {node.type}
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
                  <AlertTriangle className='w-4 h-4 text-yellow-400' />
                  Side Effects ({normalized.sideEffects.length})
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
                        <span className='text-lg'>
                          {getSideEffectIcon(effect?.type)}
                        </span>
                        <span className='text-white font-medium'>
                          {effect?.type ?? 'side_effect'}
                        </span>
                        <div
                          className={`px-2 py-1 rounded text-xs border ${getSeverityColor(
                            effect?.severity ?? 'warning'
                          )}`}
                        >
                          {effect?.severity ?? 'warning'}
                        </div>
                      </div>
                      <p className='text-sm text-slate-300'>
                        {effect?.description ?? 'No description provided.'}
                      </p>
                      <div className='mt-2 grid grid-cols-2 gap-2 text-xs'>
                        <div>
                          <span className='text-slate-400'>Reversible:</span>
                          <span
                            className={`ml-1 ${
                              effect?.reversible
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}
                          >
                            {effect?.reversible ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div>
                          <span className='text-slate-400'>External:</span>
                          <span
                            className={`ml-1 ${
                              effect?.externalDependency
                                ? 'text-yellow-400'
                                : 'text-green-400'
                            }`}
                          >
                            {effect?.externalDependency ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
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
                <XCircle className='w-4 h-4' />
                Error
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
              'Replay failed - see error details above'
            )}
          </div>

          <div className='flex items-center gap-2'>
            <button
              onClick={onStartNewReplay}
              className='px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2'
            >
              <RotateCcw className='w-4 h-4' />
              New Replay
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
