import React, { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { 
  ArrowRight, 
  Clock, 
  Zap, 
  AlertTriangle, 
  GitBranch, 
  Activity,
  Database,
  RefreshCw
} from 'lucide-react';

// Edge type to icon and color mapping
const getEdgeStyle = (type: string) => {
  switch (type) {
    case 'data_flow':
      return {
        color: '#6b7280',
        icon: Database,
        label: 'Data Flow',
        strokeWidth: 2,
        strokeDasharray: '5,5'
      };
    case 'causal_dependency':
      return {
        color: '#3b82f6',
        icon: ArrowRight,
        label: 'Causes',
        strokeWidth: 3,
        strokeDasharray: 'none'
      };
    case 'temporal_sequence':
      return {
        color: '#10b981',
        icon: Clock,
        label: 'Sequence',
        strokeWidth: 2,
        strokeDasharray: 'none'
      };
    case 'conditional_branch':
      return {
        color: '#f59e0b',
        icon: GitBranch,
        label: 'Condition',
        strokeWidth: 2,
        strokeDasharray: '10,5'
      };
    case 'error_propagation':
      return {
        color: '#dc2626',
        icon: AlertTriangle,
        label: 'Error',
        strokeWidth: 3,
        strokeDasharray: 'none'
      };
    case 'state_dependency':
      return {
        color: '#8b5cf6',
        icon: Activity,
        label: 'State',
        strokeWidth: 2,
        strokeDasharray: 'none'
      };
    case 'resource_usage':
      return {
        color: '#ef4444',
        icon: Zap,
        label: 'Resource',
        strokeWidth: 2,
        strokeDasharray: 'none'
      };
    case 'feedback_loop':
      return {
        color: '#ec4899',
        icon: RefreshCw,
        label: 'Feedback',
        strokeWidth: 2,
        strokeDasharray: 'none'
      };
    default:
      return {
        color: '#6b7280',
        icon: ArrowRight,
        label: 'Connection',
        strokeWidth: 1,
        strokeDasharray: 'none'
      };
  }
};

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeStyle = getEdgeStyle(data?.type || 'data_flow');
  const IconComponent = edgeStyle.icon;

  return (
    <>
      <path
        id={id}
        style={{
          stroke: edgeStyle.color,
          strokeWidth: edgeStyle.strokeWidth,
          strokeDasharray: edgeStyle.strokeDasharray,
          ...style,
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      
      {/* Edge Label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="flex items-center gap-1 bg-slate-800 border border-slate-600 rounded-full px-2 py-1 text-white shadow-lg"
        >
          <IconComponent className="w-3 h-3" style={{ color: edgeStyle.color }} />
          <span className="text-xs font-medium">{edgeStyle.label}</span>
          
          {/* Show weight if available */}
          {data?.weight && (
            <span className="text-xs text-slate-400 ml-1">
              ({data.weight.toFixed(1)})
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default memo(CustomEdge);
