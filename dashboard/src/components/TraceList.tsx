import React, { useState, useEffect } from 'react';
import { Clock, DollarSign, Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface Trace {
  id: string;
  project: string;
  timestamp: number;
  nodeCount: number;
  cost: number;
  latency: number;
  description: string;
  status: 'running' | 'complete' | 'error';
}

interface TraceListProps {
  onTraceSelect: (traceId: string) => void;
  selectedTraceId?: string;
}

export const TraceList: React.FC<TraceListProps> = ({ onTraceSelect, selectedTraceId }) => {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTraces();
    
    // Refresh traces every 5 seconds
    const interval = setInterval(fetchTraces, 5000);
    return () => clearInterval(interval);
  }, []);

  const transformTraceData = (apiTrace: any): Trace => {
    return {
      id: apiTrace.trace_id,
      project: apiTrace.project_name,
      status: apiTrace.end_time ? 'complete' : 'running',
      timestamp: apiTrace.start_time,
      description: apiTrace.metadata?.test || 'Agent execution',
      nodeCount: apiTrace.nodeCount || 0,
      cost: apiTrace.cost || 0,
      latency: apiTrace.end_time ? (apiTrace.end_time - apiTrace.start_time) : 0
    };
  };

  const fetchTraces = async () => {
    try {
      const response = await fetch('/api/traces');
      if (!response.ok) {
        throw new Error(`Failed to fetch traces: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Raw API data:', data);
      const transformedTraces = (data.traces || []).map(transformTraceData);
      console.log('Transformed traces:', transformedTraces);
      setTraces(transformedTraces);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch traces');
      console.error('Error fetching traces:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 text-yellow-400" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (latency: number) => {
    if (!latency) return '0ms';
    if (latency < 1000) {
      return `${latency}ms`;
    }
    return `${(latency / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex items-center justify-center">
        <div className="text-slate-400">Loading traces...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex items-center justify-center">
        <div className="text-red-400 text-center p-4">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <div className="text-sm">Failed to load traces</div>
          <div className="text-xs text-slate-400 mt-1">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-white">Traces</h2>
        <div className="text-sm text-slate-400 mt-1">
          {traces.length} trace{traces.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {traces.length === 0 ? (
          <div className="p-4 text-center text-slate-400">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No traces yet</div>
            <div className="text-xs mt-1">Start your agents to see traces here</div>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {traces.map((trace) => (
              <div
                key={trace.id}
                onClick={() => onTraceSelect(trace.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedTraceId === trace.id
                    ? 'bg-blue-600/20 border border-blue-500'
                    : 'bg-slate-700/50 hover:bg-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(trace.status)}
                    <span className="text-sm font-medium text-white">
                      {trace.project || 'default'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {formatTime(trace.timestamp)}
                  </span>
                </div>
                
                <div className="text-xs text-slate-300 mb-2 line-clamp-2">
                  {trace.description || 'No description available'}
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Activity className="w-3 h-3" />
                      {trace.nodeCount || 0}
                    </div>
                    <div className="flex items-center gap-1 text-green-400">
                      <DollarSign className="w-3 h-3" />
                      ${(trace.cost || 0).toFixed(4)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3" />
                    {formatDuration(trace.latency || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
