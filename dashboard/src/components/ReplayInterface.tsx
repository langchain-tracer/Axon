import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Edit3,
  Zap,
  Shield,
  Clock,
  DollarSign,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  ReplayEngine, 
  ReplayModifications, 
  ReplayOptions, 
  ReplayMode, 
  SideEffect,
  StateSnapshot 
} from '../utils/ReplayEngine';

interface ReplayInterfaceProps {
  selectedNode: any;
  trace: any;
  onReplayComplete: (result: any) => void;
  onClose: () => void;
}

const ReplayInterface: React.FC<ReplayInterfaceProps> = ({
  selectedNode,
  trace,
  onReplayComplete,
  onClose
}) => {
  const [replayEngine] = useState(() => new ReplayEngine());
  const [safetyAnalysis, setSafetyAnalysis] = useState<any>(null);
  const [modifications, setModifications] = useState<ReplayModifications>({
    promptChanges: new Map(),
    toolResponseOverrides: new Map(),
    systemInstructionUpdates: new Map(),
    contextVariableChanges: new Map(),
    modelChanges: new Map()
  });
  const [options, setOptions] = useState<ReplayOptions>({
    mode: ReplayMode.SAFE,
    mockExternalCalls: true,
    useOriginalData: true,
    confirmEachSideEffect: false,
    maxReplayDepth: 10
  });
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'modifications' | 'options' | 'analysis'>('analysis');
  const [expandedSideEffects, setExpandedSideEffects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedNode && trace) {
      const analysis = replayEngine.analyzeReplaySafety(selectedNode.id, trace);
      setSafetyAnalysis(analysis);
      setOptions(prev => ({ ...prev, mode: analysis.mode }));
    }
  }, [selectedNode, trace, replayEngine]);

  const handleStartReplay = async () => {
    if (!selectedNode || !trace) return;
    
    setIsReplaying(true);
    try {
      const result = await replayEngine.executeReplay(
        selectedNode.id,
        trace,
        modifications,
        options
      );
      setReplayResult(result);
      onReplayComplete(result);
    } catch (error) {
      console.error('Replay failed:', error);
    } finally {
      setIsReplaying(false);
    }
  };

  const handleModificationChange = (type: keyof ReplayModifications, nodeId: string, value: any) => {
    setModifications(prev => {
      const newMods = { ...prev };
      if (!newMods[type]) {
        newMods[type] = new Map();
      }
      newMods[type].set(nodeId, value);
      return newMods;
    });
  };

  const getModeColor = (mode: ReplayMode) => {
    switch (mode) {
      case ReplayMode.SAFE: return 'text-green-400 bg-green-500/20 border-green-500';
      case ReplayMode.SIMULATION: return 'text-blue-400 bg-blue-500/20 border-blue-500';
      case ReplayMode.WARNING: return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      case ReplayMode.BLOCKED: return 'text-red-400 bg-red-500/20 border-red-500';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500';
    }
  };

  const getModeIcon = (mode: ReplayMode) => {
    switch (mode) {
      case ReplayMode.SAFE: return <CheckCircle className="w-4 h-4" />;
      case ReplayMode.SIMULATION: return <Zap className="w-4 h-4" />;
      case ReplayMode.WARNING: return <AlertTriangle className="w-4 h-4" />;
      case ReplayMode.BLOCKED: return <XCircle className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500';
      case 'warning': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      case 'safe': return 'text-green-400 bg-green-500/20 border-green-500';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500';
    }
  };

  const toggleSideEffectExpansion = (effectId: string) => {
    setExpandedSideEffects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(effectId)) {
        newSet.delete(effectId);
      } else {
        newSet.add(effectId);
      }
      return newSet;
    });
  };

  if (!selectedNode || !trace) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="text-center text-slate-400">
          <Play className="w-12 h-12 mx-auto mb-4" />
          <p>Select a node to start replay</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Play className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Replay & Experimentation</h3>
            <div className={`px-2 py-1 rounded text-xs border flex items-center gap-1 ${getModeColor(options.mode)}`}>
              {getModeIcon(options.mode)}
              {options.mode.toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Replay from: <span className="text-white font-medium">{selectedNode.label}</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {[
          { id: 'analysis', label: 'Safety Analysis', icon: Shield },
          { id: 'modifications', label: 'Modifications', icon: Edit3 },
          { id: 'options', label: 'Options', icon: Settings }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-auto">
        {activeTab === 'analysis' && safetyAnalysis && (
          <div className="space-y-4">
            {/* Mode Summary */}
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <h4 className="font-semibold text-white mb-2">Replay Safety Analysis</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-400">Mode</div>
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${getModeColor(safetyAnalysis.mode)}`}>
                    {getModeIcon(safetyAnalysis.mode)}
                    {safetyAnalysis.mode}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Side Effects</div>
                  <div className="text-white font-medium">{safetyAnalysis.sideEffects.length}</div>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {safetyAnalysis.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings
                </h4>
                <ul className="space-y-1">
                  {safetyAnalysis.warnings.map((warning: string, index: number) => (
                    <li key={index} className="text-sm text-yellow-300">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Side Effects */}
            {safetyAnalysis.sideEffects.length > 0 && (
              <div>
                <h4 className="font-semibold text-white mb-2">Detected Side Effects</h4>
                <div className="space-y-2">
                  {safetyAnalysis.sideEffects.map((effect: SideEffect, index: number) => (
                    <div key={index} className="bg-slate-700/50 p-3 rounded-lg">
                      <button
                        onClick={() => toggleSideEffectExpansion(effect.nodeId)}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`px-2 py-1 rounded text-xs border ${getSeverityColor(effect.severity)}`}>
                            {effect.severity}
                          </div>
                          <span className="text-white font-medium">{effect.type}</span>
                        </div>
                        <div className="text-slate-400">
                          {expandedSideEffects.has(effect.nodeId) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </div>
                      </button>
                      
                      {expandedSideEffects.has(effect.nodeId) && (
                        <div className="mt-2 pt-2 border-t border-slate-600">
                          <p className="text-sm text-slate-300 mb-2">{effect.description}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-400">Reversible:</span>
                              <span className={`ml-1 ${effect.reversible ? 'text-green-400' : 'text-red-400'}`}>
                                {effect.reversible ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">External:</span>
                              <span className={`ml-1 ${effect.externalDependency ? 'text-yellow-400' : 'text-green-400'}`}>
                                {effect.externalDependency ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {safetyAnalysis.recommendations.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-400 mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {safetyAnalysis.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="text-sm text-blue-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'modifications' && (
          <div className="space-y-4">
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <h4 className="font-semibold text-white mb-3">Modify Node Behavior</h4>
              
              {/* Prompt Modification */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Modify Prompt
                </label>
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">Original:</div>
                  <div className="text-xs text-slate-300 bg-slate-700/50 p-2 rounded border-l-2 border-slate-500">
                    {selectedNode.prompt || 'No prompt available'}
                  </div>
                  <div className="text-xs text-slate-400">Modified:</div>
                  <textarea
                    value={modifications.promptChanges?.get(selectedNode.id) || selectedNode.prompt || ''}
                    onChange={(e) => handleModificationChange('promptChanges', selectedNode.id, e.target.value)}
                    className="w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Enter modified prompt..."
                  />
                </div>
              </div>

              {/* Tool Response Override */}
              {selectedNode.toolName && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Override Tool Response
                  </label>
                  <div className="space-y-2">
                    <div className="text-xs text-slate-400">Original Response:</div>
                    <div className="text-xs text-slate-300 bg-slate-700/50 p-2 rounded border-l-2 border-slate-500">
                      {selectedNode.response || 'No response available'}
                    </div>
                    <div className="text-xs text-slate-400">Mock Response:</div>
                    <textarea
                      value={modifications.toolResponseOverrides?.get(selectedNode.id) || selectedNode.response || ''}
                      onChange={(e) => handleModificationChange('toolResponseOverrides', selectedNode.id, e.target.value)}
                      className="w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Enter mock tool response..."
                    />
                  </div>
                </div>
              )}

              {/* Model Change */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Change Model
                </label>
                <select
                  value={modifications.modelChanges?.get(selectedNode.id) || selectedNode.model || 'gpt-3.5-turbo'}
                  onChange={(e) => handleModificationChange('modelChanges', selectedNode.id, e.target.value)}
                  className="w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'options' && (
          <div className="space-y-4">
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <h4 className="font-semibold text-white mb-3">Replay Options</h4>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={options.mockExternalCalls}
                    onChange={(e) => setOptions(prev => ({ ...prev, mockExternalCalls: e.target.checked }))}
                    className="rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Mock external API calls</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={options.useOriginalData}
                    onChange={(e) => setOptions(prev => ({ ...prev, useOriginalData: e.target.checked }))}
                    className="rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Use original data for time-dependent operations</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={options.confirmEachSideEffect}
                    onChange={(e) => setOptions(prev => ({ ...prev, confirmEachSideEffect: e.target.checked }))}
                    className="rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Confirm each side effect individually</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Max Replay Depth
                  </label>
                  <input
                    type="number"
                    value={options.maxReplayDepth}
                    onChange={(e) => setOptions(prev => ({ ...prev, maxReplayDepth: parseInt(e.target.value) }))}
                    className="w-full bg-slate-600 border border-slate-500 rounded-md px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="50"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 bg-slate-700/30">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            {safetyAnalysis && (
              <>
                {safetyAnalysis.sideEffects.length} side effects detected
                {safetyAnalysis.mode === ReplayMode.BLOCKED && (
                  <span className="text-red-400 ml-2">• Replay blocked</span>
                )}
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartReplay}
              disabled={isReplaying || safetyAnalysis?.mode === ReplayMode.BLOCKED}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
            >
              {isReplaying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Replaying...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Replay
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplayInterface;
