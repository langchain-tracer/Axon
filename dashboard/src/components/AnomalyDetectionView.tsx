import React, { useState, useEffect } from 'react';
import { 
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Clock
} from 'lucide-react';
import { AnomalyDetector, Anomaly, AnomalyDetectionResult } from '../utils/AnomalyDetection';
import { getAnomalyIcon, getSeverityColor, getTypeColor, toggleAnomalyExpansion as toggleExpansion } from '../utils/anomalyUtils';

interface AnomalyDetectionViewProps {
  nodes: any[];
  edges: any[];
  onNodeSelect: (node: any) => void;
}

const AnomalyDetectionView: React.FC<AnomalyDetectionViewProps> = ({ 
  nodes, 
  edges, 
  onNodeSelect 
}) => {
  const [detectionResult, setDetectionResult] = useState<AnomalyDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    runAnomalyDetection();
  }, [nodes, edges]);

  const runAnomalyDetection = async () => {
    setLoading(true);
    try {
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const detector = new AnomalyDetector(nodes, edges);
      const result = detector.detectAnomalies();
      setDetectionResult(result);
    } catch (error) {
      console.error('Anomaly detection failed:', error);
    } finally {
      setLoading(false);
    }
  };


  const filteredAnomalies = detectionResult?.anomalies.filter(anomaly => {
    const typeMatch = filterType === 'all' || anomaly.type === filterType;
    const severityMatch = filterSeverity === 'all' || anomaly.severity === filterSeverity;
    return typeMatch && severityMatch;
  }) || [];

  if (loading) {
    return (
      <div className="flex-1 bg-slate-950 p-6 overflow-auto flex items-center justify-center">
        <div className="text-center text-slate-400">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin" />
          <p>Analyzing trace for anomalies...</p>
        </div>
      </div>
    );
  }

  if (!detectionResult) {
    return (
      <div className="flex-1 bg-slate-950 p-6 overflow-auto flex items-center justify-center">
        <div className="text-center text-slate-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>No anomaly detection results available</p>
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
                <AlertTriangle className="w-6 h-6 text-red-400" />
                Anomaly Detection
              </h2>
              <p className="text-slate-400">
                Automated detection of loops, contradictions, and performance issues
              </p>
            </div>
            <button
              onClick={runAnomalyDetection}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg border border-blue-500 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Re-analyze
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-slate-400">Total Anomalies</span>
            </div>
            <div className="text-2xl font-bold text-white">{detectionResult.summary.total}</div>
          </div>
          
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-slate-400">Cost Impact</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">
              ${detectionResult.summary.totalCostImpact.toFixed(6)}
            </div>
          </div>
          
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-400">Latency Impact</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {detectionResult.summary.totalLatencyImpact.toFixed(0)}ms
            </div>
          </div>
          
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm text-slate-400">High Severity</span>
            </div>
            <div className="text-2xl font-bold text-red-400">
              {(detectionResult.summary.bySeverity.high || 0) + (detectionResult.summary.bySeverity.critical || 0)}
            </div>
          </div>
        </div>

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
              <option value="loop">Loops</option>
              <option value="contradiction">Contradictions</option>
              <option value="expensive_operation">Expensive Operations</option>
              <option value="redundant_calls">Redundant Calls</option>
              <option value="error_pattern">Error Patterns</option>
              <option value="performance_issue">Performance Issues</option>
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
            <h3 className="text-xl font-bold mb-2">No Anomalies Found!</h3>
            <p>Your trace appears to be running efficiently with no detected issues.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnomalies.map((anomaly) => (
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
                          {anomaly.affectedNodes.map((nodeId) => {
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
                      
                      {/* Suggestions */}
                      <div>
                        <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Suggestions
                        </h4>
                        <ul className="space-y-1">
                          {anomaly.suggestions.map((suggestion, index) => (
                            <li key={index} className="text-sm text-slate-300 flex items-start gap-2">
                              <span className="text-green-400 mt-1">•</span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
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

export default AnomalyDetectionView;
