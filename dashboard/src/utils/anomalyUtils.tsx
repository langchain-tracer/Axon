import React from 'react';
import { 
  AlertTriangle, 
  Bug, 
  DollarSign, 
  Clock, 
  RefreshCw, 
  Zap, 
  XCircle
} from 'lucide-react';

/**
 * Get icon component for anomaly type
 */
export const getAnomalyIcon = (type: string) => {
  switch (type) {
    case 'loop': return <RefreshCw className="w-4 h-4" />;
    case 'contradiction': return <XCircle className="w-4 h-4" />;
    case 'expensive_operation': return <DollarSign className="w-4 h-4" />;
    case 'redundant_calls': return <Zap className="w-4 h-4" />;
    case 'error_pattern': return <Bug className="w-4 h-4" />;
    case 'performance_issue': return <Clock className="w-4 h-4" />;
    default: return <AlertTriangle className="w-4 h-4" />;
  }
};

/**
 * Get CSS classes for severity color styling
 */
export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/20 border-red-500';
    case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500';
    case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
    case 'low': return 'text-blue-400 bg-blue-500/20 border-blue-500';
    default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
  }
};

/**
 * Get CSS classes for anomaly type color styling
 */
export const getTypeColor = (type: string): string => {
  switch (type) {
    case 'loop': return 'text-purple-400 bg-purple-500/20 border-purple-500';
    case 'contradiction': return 'text-red-400 bg-red-500/20 border-red-500';
    case 'expensive_operation': return 'text-orange-400 bg-orange-500/20 border-orange-500';
    case 'redundant_calls': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
    case 'error_pattern': return 'text-red-400 bg-red-500/20 border-red-500';
    case 'performance_issue': return 'text-blue-400 bg-blue-500/20 border-blue-500';
    default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
  }
};

/**
 * Toggle anomaly expansion state
 */
export const toggleAnomalyExpansion = (
  anomalyId: string,
  expandedAnomalies: Set<string>,
  setExpandedAnomalies: React.Dispatch<React.SetStateAction<Set<string>>>
) => {
  const newExpanded = new Set(expandedAnomalies);
  if (newExpanded.has(anomalyId)) {
    newExpanded.delete(anomalyId);
  } else {
    newExpanded.add(anomalyId);
  }
  setExpandedAnomalies(newExpanded);
};

