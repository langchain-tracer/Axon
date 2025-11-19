import React, { useState, useEffect } from 'react';
import { 
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle,
  AlertCircle,
  Brain,
  Target,
  Activity,
  Shield,
  Timer,
  BarChart3,
  GitBranch,
  Lightbulb
} from 'lucide-react';
import { IntelligentAnomalyDetector, IntelligentAnomaly, AnomalyDetectionResult } from '../utils/IntelligentAnomalyDetection';
import { getAnomalyIcon, getSeverityColor, getTypeColor, toggleAnomalyExpansion as toggleExpansion } from '../utils/anomalyUtils';

interface IntelligentAnomalyViewProps {
  nodes: any[];
  edges: any[];
  onNodeSelect: (node: any) => void;
}

const IntelligentAnomalyView: React.FC<IntelligentAnomalyViewProps> = ({ 
  nodes, 
  edges, 
  onNodeSelect 
}) => {
  const [detectionResult, setDetectionResult] = useState<AnomalyDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    runIntelligentDetection();
  }, [nodes, edges]);

  const runIntelligentDetection = async () => {
    setLoading(true);
    try {
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const detector = new IntelligentAnomalyDetector(nodes, edges);
      const result = detector.detectIntelligentAnomalies();
      setDetectionResult(result);
    } catch (error) {
      console.error('Intelligent anomaly detection failed:', error);
    } finally {
      setLoading(false);
    }
  };
  const filteredAnomalies = detectionResult?.anomalies.filter((anomaly: IntelligentAnomaly) => {
    const typeMatch = filterType === 'all' || anomaly.type === filterType;
    const severityMatch = filterSeverity === 'all' || anomaly.severity === filterSeverity;
    return typeMatch && severityMatch;
  }) || [];

  if (loading) {
    return (
      <div className="flex-1 bg-slate-950 p-6 overflow-auto flex items-center justify-center">
        <div className="text-center text-slate-400">
          <Brain className="w-12 h-12 mx-auto mb-4 animate-pulse text-blue-400" />
          <p className="text-lg font-semibold mb-2">Intelligent Analysis in Progress</p>
          <p className="text-sm">Analyzing patterns, detecting loops, and identifying contradictions...</p>
        </div>
      </div>
    );
  }

  if (!detectionResult) {
    return (
      <div className="flex-1 bg-slate-950 p-6 overflow-auto flex items-center justify-center">
        <div className="text-center text-slate-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>No intelligent anomaly detection results available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <Brain className="w-6 h-6 text-blue-400" />
                Intelligent Anomaly Detection
              </h2>
              <p className="text-slate-400">
                AI-powered detection of loops, contradictions, cost anomalies, and timeout risks
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600 transition-all"
              >
                <BarChart3 className="w-4 h-4" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </button>
              <button
                onClick={runIntelligentDetection}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg border border-blue-500 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Re-analyze
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-400">Intelligent Anomalies</span>
            </div>
            <div className="text-2xl font-bold text-white">{detectionResult.summary.total}</div>
            <div className="text-xs text-slate-500 mt-1">AI-detected issues</div>
          </div>
          
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-slate-400">Cost Impact</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">
              ${detectionResult.summary.totalCostImpact.toFixed(6)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Potential savings</div>
          </div>
          
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-sm text-slate-400">Circuit Breakers</span>
            </div>
            <div className="text-2xl font-bold text-red-400">
              {detectionResult.anomalies.filter((a: IntelligentAnomaly) => a.circuitBreakerTriggered).length}
            </div>
            <div className="text-xs text-slate-500 mt-1">Should trigger</div>
          </div>
          
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-slate-400">Timeout Risks</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {detectionResult.anomalies.filter((a: IntelligentAnomaly) => a.timeoutPrediction).length}
            </div>
            <div className="text-xs text-slate-500 mt-1">Predicted issues</div>
          </div>
        </div>

        {/* Advanced Statistics */}
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Loop Patterns
              </h3>
              <div className="text-lg font-bold text-purple-400">
                {detectionResult.anomalies.filter((a: IntelligentAnomaly) => a.loopPattern).length}
              </div>
              <div className="text-xs text-slate-500">Detected patterns</div>
            </div>
            
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Contradictions
              </h3>
              <div className="text-lg font-bold text-red-400">
                {detectionResult.anomalies.filter((a: IntelligentAnomaly) => a.conflictingDecisions).length}
              </div>
              <div className="text-xs text-slate-500">Decision conflicts</div>
            </div>
            
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Cost Anomalies
              </h3>
              <div className="text-lg font-bold text-orange-400">
                {detectionResult.anomalies.filter((a: IntelligentAnomaly) => a.costStatistics).length}
              </div>
              <div className="text-xs text-slate-500">Statistical outliers</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">All Types</option>
              <option value="loop">Intelligent Loops</option>
              <option value="contradiction">Contradictions</option>
              <option value="expensive_operation">Cost Anomalies</option>
              <option value="performance_issue">Timeout Risks</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Anomalies List */}
        {filteredAnomalies.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h3 className="text-xl font-bold mb-2">No Intelligent Anomalies Found!</h3>
            <p>Your agent is running efficiently with no detected patterns, contradictions, or risks.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnomalies.map((anomaly: IntelligentAnomaly) => (
              <div
                key={anomaly.id}
                className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-slate-700 transition-colors"
                  onClick={() => toggleExpansion(anomaly.id, expandedAnomalies, setExpandedAnomalies)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedAnomalies.has(anomaly.id) ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <div className="flex items-center gap-2">
                        {getAnomalyIcon(anomaly.type)}
                        <h3 className="font-semibold text-white">{anomaly.title}</h3>
                        {anomaly.circuitBreakerTriggered && (
                          <Shield className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded text-xs border ${getTypeColor(anomaly.type)}`}>
                        {anomaly.type.replace('_', ' ')}
                      </div>
                      <div className={`px-2 py-1 rounded text-xs border ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity}
                      </div>
                      <div className="text-xs text-slate-400">
                        {Math.round(anomaly.confidence * 100)}% confidence
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-400 mt-2 ml-7">
                    {anomaly.description}
                  </p>
                  
                  {(anomaly.cost || anomaly.latency) && (
                    <div className="flex gap-4 mt-2 ml-7 text-xs">
                      {anomaly.cost && (
                        <span className="text-orange-400">
                          Cost: ${anomaly.cost.toFixed(6)}
                        </span>
                      )}
                      {anomaly.latency && (
                        <span className="text-blue-400">
                          Latency: {anomaly.latency}ms
                        </span>
                      )}
                      {anomaly.semanticSimilarity && (
                        <span className="text-purple-400">
                          Similarity: {(anomaly.semanticSimilarity * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {expandedAnomalies.has(anomaly.id) && (
                  <div className="border-t border-slate-700 p-4 bg-slate-900">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Affected Nodes */}
                      <div>
                        <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          Affected Nodes
                        </h4>
                        <div className="space-y-1">
                          {anomaly.affectedNodes.map((nodeId: string) => {
                            const node = nodes.find(n => n.id === nodeId);
                            return (
                              <button
                                key={nodeId}
                                onClick={() => onNodeSelect(node)}
                                className="block w-full text-left px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300 hover:text-white transition-colors"
                              >
                                {node?.label || node?.type || nodeId}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Enhanced Suggestions */}
                      <div>
                        <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          Intelligent Suggestions
                        </h4>
                        <ul className="space-y-1">
                          {anomaly.suggestions.map((suggestion: string, index: number) => (
                            <li key={index} className="text-sm text-slate-300 flex items-start gap-2">
                              <span className="text-green-400 mt-1">•</span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Advanced Details */}
                    {showAdvanced && (
                      <div className="mt-6 pt-4 border-t border-slate-700">
                        <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Advanced Analysis
                        </h4>
                        
                        {anomaly.loopPattern && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="text-xs text-slate-400">Loop Frequency</div>
                              <div className="text-lg font-bold text-purple-400">{anomaly.loopPattern.frequency}</div>
                            </div>
                            <div className="bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="text-xs text-slate-400">Total Cost</div>
                              <div className="text-lg font-bold text-orange-400">${anomaly.loopPattern.totalCost.toFixed(6)}</div>
                            </div>
                            <div className="bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="text-xs text-slate-400">Duration</div>
                              <div className="text-lg font-bold text-blue-400">
                                {((anomaly.loopPattern.lastOccurrence - anomaly.loopPattern.firstOccurrence) / 1000).toFixed(1)}s
                              </div>
                            </div>
                          </div>
                        )}

                        {anomaly.costStatistics && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="text-xs text-slate-400">Mean Cost</div>
                              <div className="text-lg font-bold text-green-400">${anomaly.costStatistics.mean.toFixed(6)}</div>
                            </div>
                            <div className="bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="text-xs text-slate-400">Std Dev</div>
                              <div className="text-lg font-bold text-yellow-400">${anomaly.costStatistics.stdDev.toFixed(6)}</div>
                            </div>
                            <div className="bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="text-xs text-slate-400">Outlier Threshold</div>
                              <div className="text-lg font-bold text-red-400">${anomaly.costStatistics.outlierThreshold.toFixed(6)}</div>
                            </div>
                            <div className="bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="text-xs text-slate-400">Recent Runs</div>
                              <div className="text-lg font-bold text-blue-400">{anomaly.costStatistics.recentRuns.length}</div>
                            </div>
                          </div>
                        )}

                        {anomaly.timeoutPrediction && (
                          <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Timer className="w-4 h-4 text-yellow-400" />
                              <span className="font-medium text-white">Timeout Prediction</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <div className="text-xs text-slate-400">Estimated Total Cost</div>
                                <div className="text-lg font-bold text-orange-400">
                                  ${anomaly.timeoutPrediction.estimatedTotalCost.toFixed(6)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-400">Estimated Time</div>
                                <div className="text-lg font-bold text-blue-400">
                                  {anomaly.timeoutPrediction.estimatedTotalTime}ms
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-400">Recommendation</div>
                                <div className={`text-lg font-bold ${
                                  anomaly.timeoutPrediction.recommendation === 'terminate' ? 'text-red-400' :
                                  anomaly.timeoutPrediction.recommendation === 'monitor' ? 'text-yellow-400' :
                                  'text-green-400'
                                }`}>
                                  {anomaly.timeoutPrediction.recommendation.toUpperCase()}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-slate-300">
                              {anomaly.timeoutPrediction.reason}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligentAnomalyView;
