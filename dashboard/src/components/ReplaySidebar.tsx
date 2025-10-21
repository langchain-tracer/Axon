import React, { useState, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  Clock, 
  DollarSign, 
  Hash, 
  Brain, 
  Wrench, 
  GitBranch, 
  Activity, 
  AlertCircle, 
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  MessageSquare,
  Zap,
  Target,
  ArrowRight,
  Copy,
  ExternalLink,
  X,
  FileSearch
} from 'lucide-react';

interface ReplayNode {
  id: string;
  type: string;
  label: string;
  timestamp: number;
  status: 'pending' | 'running' | 'complete' | 'error' | 'cancelled' | 'timeout';
  cost: number;
  latency: number;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  model?: string;
  reasoning?: string;
  decisionContext?: {
    previousSteps: string[];
    availableOptions: string[];
    constraints: Record<string, any>;
    goals: string[];
  };
  alternatives?: Array<{
    option: string;
    reasoning: string;
    confidence: number;
    consequences?: string[];
  }>;
  selectedAlternative?: string;
  confidence?: number;
  prompts?: string[];
  response?: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  error?: string;
  stateBefore?: Record<string, any>;
  stateAfter?: Record<string, any>;
  stateChanges?: Array<{
    key: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }>;
  context?: Record<string, any>;
  memoryUpdates?: Array<{
    type: 'add' | 'update' | 'remove';
    key: string;
    value: any;
    reason: string;
  }>;
  performance?: {
    memoryUsage?: number;
    cpuTime?: number;
    networkLatency?: number;
    cacheHit?: boolean;
  };
}

interface ReplaySidebarProps {
  selectedNode: ReplayNode | null;
  replayState: {
    isPlaying: boolean;
    currentTime: number;
    totalTime: number;
    speed: number;
  };
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
  onNodeClick: (nodeId: string) => void;
  onClose: () => void;
  nodes: ReplayNode[];
  width?: number;
}

const ReplaySidebar: React.FC<ReplaySidebarProps> = ({
  selectedNode,
  replayState,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onReset,
  onNodeClick,
  onClose,
  nodes,
  width = 400
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'replay'>('inspector');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'prompts', 'reasoning', 'decision', 'tool']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'llm_call': return Brain;
      case 'tool_invocation': return Wrench;
      case 'decision_point': return GitBranch;
      case 'state_transition': return Activity;
      case 'reasoning_step': return Zap;
      case 'error_handling': return AlertCircle;
      case 'validation': return CheckCircle;
      case 'user_interaction': return MessageSquare;
      default: return CheckCircle;
    }
  };

  const getNodeColor = (type: string) => {
    const colors = {
      'llm_call': 'text-blue-400',
      'tool_invocation': 'text-green-400',
      'decision_point': 'text-amber-400',
      'state_transition': 'text-purple-400',
      'reasoning_step': 'text-red-400',
      'error_handling': 'text-red-500',
      'validation': 'text-cyan-400',
      'optimization': 'text-lime-400',
      'user_interaction': 'text-pink-400'
    };
    return colors[type as keyof typeof colors] || 'text-slate-400';
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!selectedNode) {
    return (
      <div className="w-full h-full bg-slate-900 border-l border-slate-700 flex items-center justify-center">
        <div className="text-center text-slate-400 p-8">
          <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2 text-white">Node Inspector</h3>
          <p className="text-sm mb-4">Click on any node in the graph to see:</p>
          <div className="text-left bg-slate-800 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span>Exact prompts and responses</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span>Token usage and costs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span>Reasoning chain and decision context</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
              <span>Tool invocations and results</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
              <span>Timing and performance metrics</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const IconComponent = getNodeIcon(selectedNode.type);
  const nodeColor = getNodeColor(selectedNode.type);

  return (
    <div className="w-full h-full bg-slate-900 border-l border-slate-700 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Node Details</h2>
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              selectedNode.status === 'complete' ? 'bg-green-500/20 text-green-400' :
              selectedNode.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
              selectedNode.status === 'error' ? 'bg-red-500/20 text-red-400' :
              selectedNode.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {selectedNode.status.toUpperCase()}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
              title="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
          <div className="flex items-center gap-3 mb-4">
          <IconComponent className={`w-6 h-6 ${nodeColor}`} />
          <div>
            <h3 className="text-lg font-semibold text-white">{selectedNode.label}</h3>
            <p className="text-sm text-slate-400">
              {selectedNode.type.replace('_', ' ').toUpperCase()} • {formatTime(selectedNode.timestamp)}
            </p>
          </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-2">
          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-all ${
              activeTab === 'inspector'
                ? 'bg-slate-700 text-white border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileSearch className="w-4 h-4" />
            Inspector
          </button>
          <button
            onClick={() => setActiveTab('replay')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-all ${
              activeTab === 'replay'
                ? 'bg-slate-700 text-white border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Play className="w-4 h-4" />
            Replay
          </button>
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'inspector' ? (
          <>
        {/* Prompts & Responses - PRIORITY SECTION - ALWAYS SHOW */}
        <div className="border-b border-slate-700 bg-slate-800/30">
          <div className="p-4 bg-blue-600/10 border-b border-blue-500/20">
            <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">
              💬 Prompts & Responses
            </h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Prompts */}
            {selectedNode.prompts && selectedNode.prompts.length > 0 ? (
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Input Prompts</div>
                {selectedNode.prompts.map((prompt, index) => (
                  <div key={index} className="bg-slate-800 rounded-lg p-3 mb-2 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-blue-400">Prompt {index + 1}</span>
                      <button
                        onClick={() => copyToClipboard(prompt)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                    <div className="text-sm text-white whitespace-pre-wrap font-mono bg-slate-900 p-2 rounded">
                      {prompt}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 border-dashed">
                <div className="text-xs text-slate-500 italic">No prompt data captured for this node</div>
              </div>
            )}

            {/* Response */}
            {selectedNode.response ? (
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">AI Response</div>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-400">Response</span>
                    <button
                      onClick={() => copyToClipboard(selectedNode.response!)}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                  <div className="text-sm text-white whitespace-pre-wrap font-mono bg-slate-900 p-2 rounded">
                    {selectedNode.response}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 border-dashed">
                <div className="text-xs text-slate-500 italic">No response data captured for this node</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Overview Section */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('overview')}
            className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-800 transition-colors"
          >
            <span className="font-semibold text-white">Overview</span>
            {expandedSections.has('overview') ? 
              <ChevronDown className="w-4 h-4 text-slate-400" /> : 
              <ChevronRight className="w-4 h-4 text-slate-400" />
            }
          </button>
          
          {expandedSections.has('overview') && (
            <div className="px-4 pb-4 space-y-3">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-400">Cost</span>
                  </div>
                  <div className="text-lg font-bold text-white">${selectedNode.cost.toFixed(6)}</div>
                </div>
                
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-400">Latency</span>
                  </div>
                  <div className="text-lg font-bold text-white">{(selectedNode.latency / 1000).toFixed(2)}s</div>
                </div>
              </div>

              {/* Tokens */}
              {selectedNode.tokens && selectedNode.tokens.total > 0 && (
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-400">Token Usage</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-slate-500">Input</div>
                      <div className="font-bold text-white">{(selectedNode.tokens.input || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Output</div>
                      <div className="font-bold text-white">{(selectedNode.tokens.output || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Total</div>
                      <div className="font-bold text-white">{(selectedNode.tokens.total || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Model - Only show for LLM nodes */}
              {selectedNode.model && selectedNode.type === 'llm' && (
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="text-sm text-slate-400 mb-1">Model</div>
                  <div className="text-white font-medium">{selectedNode.model}</div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Reasoning Chain - PRIORITY SECTION - ALWAYS SHOW */}
        <div className="border-b border-slate-700 bg-slate-800/30">
          <div className="p-4 bg-purple-600/10 border-b border-purple-500/20">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Reasoning Chain
            </h3>
              {selectedNode.confidence && (
                <div className="text-xs text-slate-300">
                  Confidence: <span className="font-bold text-purple-400">{(selectedNode.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Reasoning Header */}
            <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-purple-500/20 p-2 rounded">
                  <IconComponent className={`w-5 h-5 ${nodeColor}`} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white mb-1">
                    {selectedNode.type.includes('llm') ? 'LLM Decision Point' : 
                     selectedNode.type.includes('tool') ? 'Tool Execution' :
                     selectedNode.type.includes('chain') ? 'Chain Processing' :
                     'Processing Step'}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {selectedNode.reasoning && selectedNode.reasoning.length > 50 && !selectedNode.reasoning.includes('completed') 
                      ? selectedNode.reasoning 
                      : selectedNode.type.includes('llm') 
                        ? `Processed ${selectedNode.tokens?.total || 0} tokens using ${selectedNode.model || 'LLM'}`
                        : selectedNode.type.includes('tool')
                          ? `Executed ${selectedNode.toolName || 'tool'} in ${(selectedNode.latency / 1000).toFixed(2)}s`
                          : selectedNode.label
                    }
                  </p>
                </div>
              </div>
              
              {/* Confidence Bar */}
              {selectedNode.confidence && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Confidence</span>
                    <span className="font-bold text-purple-400">{(selectedNode.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-300"
                      style={{ width: `${selectedNode.confidence * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Why This Node - Causal Chain */}
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-3 border-b border-slate-700 bg-slate-750">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-3 h-3" />
                  Why This Node Executed
                </h4>
              </div>
              
              <div className="p-3 space-y-3">
                {/* Reasoning Steps */}
                {selectedNode.reasoning && selectedNode.reasoning.length > 50 && !selectedNode.reasoning.includes('completed') ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">Reasoning Steps:</div>
                    <div className="space-y-2">
                      {selectedNode.reasoning.split('\n').filter(line => line.trim()).map((step, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          </div>
                          <div className="flex-1 text-slate-300 leading-relaxed">{step}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedNode.type.includes('tool') && selectedNode.toolName ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">Execution Context:</div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        </div>
                        <div className="flex-1 text-slate-300">Tool <span className="font-mono text-green-400">{selectedNode.toolName}</span> was invoked</div>
                      </div>
                      {selectedNode.toolInput && (
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          </div>
                          <div className="flex-1 text-slate-300">Processing input parameters</div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-xs">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        </div>
                        <div className="flex-1 text-slate-300">Execution completed in {(selectedNode.latency / 1000).toFixed(2)}s</div>
                      </div>
                    </div>
                  </div>
                ) : selectedNode.type.includes('llm') ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">LLM Processing:</div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                          <Brain className="w-3 h-3 text-blue-400" />
                        </div>
                        <div className="flex-1 text-slate-300">Invoked language model <span className="font-mono text-blue-400">{selectedNode.model || 'default'}</span></div>
                      </div>
                      {selectedNode.prompts && selectedNode.prompts.length > 0 && (
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                            <CheckCircle className="w-3 h-3 text-blue-400" />
                          </div>
                          <div className="flex-1 text-slate-300">Sent {selectedNode.prompts.length} prompt{selectedNode.prompts.length > 1 ? 's' : ''} for processing</div>
                        </div>
                      )}
                      {selectedNode.tokens && selectedNode.tokens.total > 0 ? (
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                            <Hash className="w-3 h-3 text-blue-400" />
                          </div>
                          <div className="flex-1 text-slate-300">Processed {selectedNode.tokens.total.toLocaleString()} tokens ({selectedNode.tokens.input?.toLocaleString() || 0} in, {selectedNode.tokens.output?.toLocaleString() || 0} out)</div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                            <AlertCircle className="w-3 h-3 text-yellow-400" />
                          </div>
                          <div className="flex-1 text-slate-300">No token usage data captured</div>
                        </div>
                      )}
                      {selectedNode.response && (
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          </div>
                          <div className="flex-1 text-slate-300">Generated response in {(selectedNode.latency / 1000).toFixed(2)}s</div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-xs">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                          <DollarSign className="w-3 h-3 text-purple-400" />
                        </div>
                        <div className="flex-1 text-slate-300">Cost: <span className="font-mono text-purple-400">${selectedNode.cost.toFixed(6)}</span></div>
                      </div>
                    </div>
                  </div>
                ) : selectedNode.type.includes('chain') ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">Chain Processing:</div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                          <GitBranch className="w-3 h-3 text-purple-400" />
                        </div>
                        <div className="flex-1 text-slate-300">Executed chain <span className="font-mono text-purple-400">{selectedNode.chainName || selectedNode.label}</span></div>
                      </div>
                      {selectedNode.chainInputs && (
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                            <CheckCircle className="w-3 h-3 text-purple-400" />
                          </div>
                          <div className="flex-1 text-slate-300">Processed chain inputs</div>
                        </div>
                      )}
                      {selectedNode.chainOutputs && (
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          </div>
                          <div className="flex-1 text-slate-300">Generated chain outputs in {(selectedNode.latency / 1000).toFixed(2)}s</div>
                        </div>
                      )}
                      {selectedNode.reasoning && selectedNode.reasoning.length > 50 && (
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                            <Brain className="w-3 h-3 text-blue-400" />
                          </div>
                          <div className="flex-1 text-slate-300">Chain reasoning captured</div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-xs">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                          <DollarSign className="w-3 h-3 text-purple-400" />
                        </div>
                        <div className="flex-1 text-slate-300">Cost: <span className="font-mono text-purple-400">${selectedNode.cost?.toFixed(6) || '0.000000'}</span></div>
                      </div>
                    </div>
              </div>
            ) : (
                  <div className="text-xs text-slate-500 italic">
                    No detailed reasoning captured for this step
                  </div>
                )}

                {/* Alternatives Considered */}
                {selectedNode.alternatives && selectedNode.alternatives.length > 0 && (
                  <div className="pt-3 border-t border-slate-700">
                    <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3 text-red-400" />
                      Alternatives Considered:
                    </div>
                    <div className="space-y-2">
                      {selectedNode.alternatives.map((alt, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs bg-slate-750 rounded p-2">
                          <div className="flex-shrink-0 text-slate-500">•</div>
                          <div className="flex-1">
                            <div className="text-slate-300 font-medium">{alt.option}</div>
                            <div className="text-slate-500 text-xs mt-0.5">
                              → {alt.reasoning}
                            </div>
                            {alt.confidence && (
                              <div className="text-slate-600 text-xs mt-1">
                                Confidence: {(alt.confidence * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Decision Context */}
        {selectedNode.decisionContext && (
          <div className="border-b border-slate-700">
            <button
              onClick={() => toggleSection('decision')}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-800 transition-colors"
            >
              <span className="font-semibold text-white">Decision Context</span>
              {expandedSections.has('decision') ? 
                <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                <ChevronRight className="w-4 h-4 text-slate-400" />
              }
            </button>
            
            {expandedSections.has('decision') && (
              <div className="px-4 pb-4 space-y-3">
                {selectedNode.decisionContext.previousSteps && (
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Previous Steps</div>
                    <div className="text-sm text-white">{selectedNode.decisionContext.previousSteps.length} steps</div>
                  </div>
                )}
                
                {selectedNode.decisionContext.availableOptions && (
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Available Options</div>
                    <div className="space-y-1">
                      {selectedNode.decisionContext.availableOptions.map((option, index) => (
                        <div key={index} className="text-sm text-white bg-slate-800 rounded p-2">
                          {option}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedNode.decisionContext.goals && (
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Goals</div>
                    <div className="text-sm text-white">{selectedNode.decisionContext.goals.join(', ')}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alternatives */}
        {selectedNode.alternatives && selectedNode.alternatives.length > 0 && (
          <div className="border-b border-slate-700">
            <button
              onClick={() => toggleSection('alternatives')}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-800 transition-colors"
            >
              <span className="font-semibold text-white">Alternatives</span>
              {expandedSections.has('alternatives') ? 
                <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                <ChevronRight className="w-4 h-4 text-slate-400" />
              }
            </button>
            
            {expandedSections.has('alternatives') && (
              <div className="px-4 pb-4 space-y-2">
                {selectedNode.alternatives.map((alt, index) => (
                  <div key={index} className="bg-slate-800 rounded-lg p-3">
                    <div className="text-sm text-white font-medium mb-1">{alt.option}</div>
                    <div className="text-xs text-slate-400 mb-2">{alt.reasoning}</div>
                    <div className="text-xs text-slate-500">
                      Confidence: {(alt.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tool Details */}
        {selectedNode.toolName && (
          <div className="border-b border-slate-700">
            <button
              onClick={() => toggleSection('tool')}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-800 transition-colors"
            >
              <span className="font-semibold text-white">Tool Details</span>
              {expandedSections.has('tool') ? 
                <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                <ChevronRight className="w-4 h-4 text-slate-400" />
              }
            </button>
            
            {expandedSections.has('tool') && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Tool Name</div>
                  <div className="text-white font-medium">{selectedNode.toolName}</div>
                </div>
                
                {selectedNode.toolInput && (
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Input</div>
                    <div className="bg-slate-800 rounded-lg p-3">
                      <div className="text-sm text-white whitespace-pre-wrap">{selectedNode.toolInput}</div>
                    </div>
                  </div>
                )}
                
                {selectedNode.toolOutput && (
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Output</div>
                    <div className="bg-slate-800 rounded-lg p-3">
                      <div className="text-sm text-white whitespace-pre-wrap">{selectedNode.toolOutput}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* State Changes */}
        {selectedNode.stateChanges && selectedNode.stateChanges.length > 0 && (
          <div className="border-b border-slate-700">
            <button
              onClick={() => toggleSection('state')}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-800 transition-colors"
            >
              <span className="font-semibold text-white">State Changes</span>
              {expandedSections.has('state') ? 
                <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                <ChevronRight className="w-4 h-4 text-slate-400" />
              }
            </button>
            
            {expandedSections.has('state') && (
              <div className="px-4 pb-4 space-y-2">
                {selectedNode.stateChanges.map((change, index) => (
                  <div key={index} className="bg-slate-800 rounded-lg p-3">
                    <div className="text-sm text-white font-medium mb-1">{change.key}</div>
                    <div className="text-xs text-slate-400 mb-1">Reason: {change.reason}</div>
                    <div className="text-xs text-slate-500">
                      {JSON.stringify(change.oldValue)} → {JSON.stringify(change.newValue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Performance Metrics */}
        {selectedNode.performance && (
          <div className="border-b border-slate-700">
            <button
              onClick={() => toggleSection('performance')}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-800 transition-colors"
            >
              <span className="font-semibold text-white">Performance</span>
              {expandedSections.has('performance') ? 
                <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                <ChevronRight className="w-4 h-4 text-slate-400" />
              }
            </button>
            
            {expandedSections.has('performance') && (
              <div className="px-4 pb-4 space-y-2">
                {selectedNode.performance.memoryUsage && (
                  <div className="text-sm text-slate-400">
                    Memory: {(selectedNode.performance.memoryUsage / 1024 / 1024).toFixed(1)}MB
                  </div>
                )}
                {selectedNode.performance.cpuTime && (
                  <div className="text-sm text-slate-400">
                    CPU: {selectedNode.performance.cpuTime}ms
                  </div>
                )}
                {selectedNode.performance.cacheHit !== undefined && (
                  <div className="text-sm text-slate-400">
                    Cache: {selectedNode.performance.cacheHit ? 'Hit' : 'Miss'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
          </>
        ) : (
          /* Replay Tab Content */
          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="bg-cyan-500/20 p-3 rounded-lg">
                  <Play className="w-8 h-8 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">Replay from this Node</h3>
                  <p className="text-sm text-slate-300 mb-4">
                    Time-travel debug your agent by replaying execution from this point. Modify prompts, 
                    override tool responses, or test different models.
                  </p>
                  <button
                    onClick={() => {
                      // Navigate to the replay view in the main dashboard
                      // We'll need to add this functionality
                      window.dispatchEvent(new CustomEvent('openReplay', { detail: { nodeId: selectedNode.id } }));
                    }}
                    className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/20"
                  >
                    <Play className="w-5 h-5" />
                    Go to Replay Mode
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Replay Features</h4>
              
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-500/20 p-2 rounded">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-white mb-1">Modify Prompts</h5>
                    <p className="text-xs text-slate-400">
                      Change system instructions, user messages, or context variables to test different scenarios
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-start gap-3">
                  <div className="bg-green-500/20 p-2 rounded">
                    <Wrench className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-white mb-1">Override Tool Responses</h5>
                    <p className="text-xs text-slate-400">
                      Simulate different tool outputs to see how your agent reacts
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-500/20 p-2 rounded">
                    <Brain className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-white mb-1">Switch Models</h5>
                    <p className="text-xs text-slate-400">
                      Compare results across different AI models (GPT-4, Claude, etc.)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-500/20 p-2 rounded">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-white mb-1">Safe Testing</h5>
                    <p className="text-xs text-slate-400">
                      Side effect detection, mock mode, and circuit breaker suggestions
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-semibold text-white mb-3">Current Node Context</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Node ID:</span>
                  <span className="text-white font-mono">{selectedNode.id.substring(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Type:</span>
                  <span className="text-white">{selectedNode.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-white">{selectedNode.status}</span>
                </div>
                {selectedNode.model && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Model:</span>
                    <span className="text-white">{selectedNode.model}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReplaySidebar;
