import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, Lightbulb, Calculator, AlertTriangle, CheckCircle, Activity } from 'lucide-react';

interface CostProjection {
  scenario: string;
  description: string;
  currentCost: number;
  projectedCost: number;
  savings: number;
  savingsPercentage: number;
  implementation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  impact: 'low' | 'medium' | 'high';
}

interface OptimizationSuggestion {
  id: string;
  title: string;
  description: string;
  category: 'model' | 'prompt' | 'tool' | 'architecture';
  currentCost: number;
  potentialSavings: number;
  implementation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  impact: 'low' | 'medium' | 'high';
  priority: number;
}

interface CostProjectionsProps {
  nodes: any[];
  traces?: any[];
}

const CostProjections: React.FC<CostProjectionsProps> = ({ nodes, traces: propTraces }) => {
  const [projections, setProjections] = useState<CostProjection[]>([]);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [allTraces, setAllTraces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all traces if not provided
  useEffect(() => {
    if (!propTraces || propTraces.length === 0) {
      fetchAllTraces();
    } else {
      setAllTraces(propTraces);
    }
  }, [propTraces]);

  const fetchAllTraces = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/traces');
      if (response.ok) {
        const data = await response.json();
        setAllTraces(data.traces || []);
      }
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateProjections();
    generateOptimizationSuggestions();
  }, [nodes, allTraces, selectedTimeframe]);

  const calculateProjections = () => {
    const currentTotalCost = nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
    const avgCostPerTrace = allTraces.length > 0 ? allTraces.reduce((sum, trace) => sum + (trace.cost || 0), 0) / allTraces.length : currentTotalCost;
    
    // Calculate usage patterns
    const dailyTraces = allTraces.length; // Assuming traces are from recent period
    const weeklyTraces = dailyTraces * 7;
    const monthlyTraces = dailyTraces * 30;

    const timeframes = {
      daily: { multiplier: 1, label: 'Daily' },
      weekly: { multiplier: 7, label: 'Weekly' },
      monthly: { multiplier: 30, label: 'Monthly' }
    };

    const timeframe = timeframes[selectedTimeframe];
    const projectedTraces = dailyTraces * timeframe.multiplier;

    const newProjections: CostProjection[] = [
      {
        scenario: 'Current Usage Pattern',
        description: `Based on current ${timeframe.label.toLowerCase()} usage`,
        currentCost: avgCostPerTrace * projectedTraces,
        projectedCost: avgCostPerTrace * projectedTraces,
        savings: 0,
        savingsPercentage: 0,
        implementation: 'No changes required',
        difficulty: 'easy',
        impact: 'low'
      },
      {
        scenario: 'Model Optimization',
        description: 'Switch to more cost-effective models for simple tasks',
        currentCost: avgCostPerTrace * projectedTraces,
        projectedCost: avgCostPerTrace * projectedTraces * 0.6, // 40% savings
        savings: avgCostPerTrace * projectedTraces * 0.4,
        savingsPercentage: 40,
        implementation: 'Use GPT-3.5-turbo for simple tasks, GPT-4 only for complex reasoning',
        difficulty: 'medium',
        impact: 'high'
      },
      {
        scenario: 'Prompt Engineering',
        description: 'Optimize prompts to reduce token usage',
        currentCost: avgCostPerTrace * projectedTraces,
        projectedCost: avgCostPerTrace * projectedTraces * 0.75, // 25% savings
        savings: avgCostPerTrace * projectedTraces * 0.25,
        savingsPercentage: 25,
        implementation: 'Use more concise prompts, implement few-shot examples',
        difficulty: 'medium',
        impact: 'medium'
      },
      {
        scenario: 'Tool Usage Optimization',
        description: 'Reduce redundant tool calls and optimize tool selection',
        currentCost: avgCostPerTrace * projectedTraces,
        projectedCost: avgCostPerTrace * projectedTraces * 0.85, // 15% savings
        savings: avgCostPerTrace * projectedTraces * 0.15,
        savingsPercentage: 15,
        implementation: 'Cache tool results, implement smart tool selection',
        difficulty: 'hard',
        impact: 'medium'
      },
      {
        scenario: 'Architecture Optimization',
        description: 'Implement caching and result reuse strategies',
        currentCost: avgCostPerTrace * projectedTraces,
        projectedCost: avgCostPerTrace * projectedTraces * 0.5, // 50% savings
        savings: avgCostPerTrace * projectedTraces * 0.5,
        savingsPercentage: 50,
        implementation: 'Implement Redis caching, result deduplication, and smart routing',
        difficulty: 'hard',
        impact: 'high'
      }
    ];

    setProjections(newProjections);
  };

  const generateOptimizationSuggestions = () => {
    const currentTotalCost = nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
    
    // Analyze node patterns
    const llmNodes = nodes.filter(node => node.type?.includes('llm'));
    const toolNodes = nodes.filter(node => node.type?.includes('tool'));
    const expensiveNodes = nodes.filter(node => (node.cost || 0) > currentTotalCost * 0.1);
    
    const newSuggestions: OptimizationSuggestion[] = [];

    // Model optimization suggestions
    if (llmNodes.length > 0) {
      const avgLLMCost = llmNodes.reduce((sum, node) => sum + (node.cost || 0), 0) / llmNodes.length;
      if (avgLLMCost > 0.0001) {
        newSuggestions.push({
          id: 'model-optimization',
          title: 'Switch to Cost-Effective Models',
          description: 'Use GPT-3.5-turbo for simple tasks instead of GPT-4',
          category: 'model',
          currentCost: avgLLMCost * llmNodes.length,
          potentialSavings: avgLLMCost * llmNodes.length * 0.4,
          implementation: 'Implement model selection logic based on task complexity',
          difficulty: 'medium',
          impact: 'high',
          priority: 1
        });
      }
    }

    // Prompt optimization suggestions
    const longPromptNodes = nodes.filter(node => 
      node.prompt && Array.isArray(node.prompt) && 
      node.prompt.some((p: string) => p.length > 500)
    );
    if (longPromptNodes.length > 0) {
      newSuggestions.push({
        id: 'prompt-optimization',
        title: 'Optimize Long Prompts',
        description: 'Reduce prompt length to decrease token usage',
        category: 'prompt',
        currentCost: longPromptNodes.reduce((sum, node) => sum + (node.cost || 0), 0),
        potentialSavings: longPromptNodes.reduce((sum, node) => sum + (node.cost || 0), 0) * 0.3,
        implementation: 'Use more concise prompts and implement prompt templates',
        difficulty: 'easy',
        impact: 'medium',
        priority: 2
      });
    }

    // Tool optimization suggestions
    if (toolNodes.length > 0) {
      const duplicateToolCalls = toolNodes.filter((node, index) => 
        toolNodes.findIndex(n => n.toolName === node.toolName && n.toolInput === node.toolInput) !== index
      );
      if (duplicateToolCalls.length > 0) {
        newSuggestions.push({
          id: 'tool-caching',
          title: 'Implement Tool Result Caching',
          description: 'Cache tool results to avoid duplicate calls',
          category: 'tool',
          currentCost: duplicateToolCalls.reduce((sum, node) => sum + (node.cost || 0), 0),
          potentialSavings: duplicateToolCalls.reduce((sum, node) => sum + (node.cost || 0), 0) * 0.8,
          implementation: 'Implement Redis cache with TTL for tool results',
          difficulty: 'medium',
          impact: 'high',
          priority: 1
        });
      }
    }

    // Architecture suggestions
    if (expensiveNodes.length > 0) {
      newSuggestions.push({
        id: 'architecture-optimization',
        title: 'Optimize Expensive Operations',
        description: 'Review and optimize the most expensive operations',
        category: 'architecture',
        currentCost: expensiveNodes.reduce((sum, node) => sum + (node.cost || 0), 0),
        potentialSavings: expensiveNodes.reduce((sum, node) => sum + (node.cost || 0), 0) * 0.5,
        implementation: 'Implement result caching, parallel processing, and smart routing',
        difficulty: 'hard',
        impact: 'high',
        priority: 1
      });
    }

    // Sort by priority and impact
    newSuggestions.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.impact === 'high' && b.impact !== 'high') return -1;
      if (b.impact === 'high' && a.impact !== 'high') return 1;
      return b.potentialSavings - a.potentialSavings;
    });

    setSuggestions(newSuggestions);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-500/20 border-green-500';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      case 'hard': return 'text-red-400 bg-red-500/20 border-red-500';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-500/20 border-red-500';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'model': return <Target className="w-4 h-4" />;
      case 'prompt': return <Lightbulb className="w-4 h-4" />;
      case 'tool': return <Calculator className="w-4 h-4" />;
      case 'architecture': return <TrendingUp className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-950 p-6 overflow-auto flex items-center justify-center">
        <div className="text-center text-slate-400">
          <Activity className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p>Loading cost projections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            Cost Projections & Optimization
          </h2>
          <p className="text-slate-400">
            Analyze usage patterns and discover cost optimization opportunities
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="mb-8">
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as const).map((timeframe) => (
              <button
                key={timeframe}
                onClick={() => setSelectedTimeframe(timeframe)}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  selectedTimeframe === timeframe
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Cost Projections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Cost Projections ({selectedTimeframe.charAt(0).toUpperCase() + selectedTimeframe.slice(1)})
            </h3>
            <div className="space-y-4">
              {projections.map((projection, index) => (
                <div key={index} className="p-4 bg-slate-900 rounded-lg border border-slate-600">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-white">{projection.scenario}</h4>
                    <div className={`px-2 py-1 rounded text-xs border ${getDifficultyColor(projection.difficulty)}`}>
                      {projection.difficulty}
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{projection.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-slate-500">Current Cost</div>
                      <div className="text-sm font-medium text-red-400">${projection.currentCost.toFixed(6)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Projected Cost</div>
                      <div className="text-sm font-medium text-green-400">${projection.projectedCost.toFixed(6)}</div>
                    </div>
                  </div>
                  
                  {projection.savings > 0 && (
                    <div className="flex items-center gap-2 text-green-400">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Save ${projection.savings.toFixed(6)} ({projection.savingsPercentage}%)
                      </span>
                    </div>
                  )}
                  
                  <div className="mt-3 text-xs text-slate-500">
                    <strong>Implementation:</strong> {projection.implementation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optimization Suggestions */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Optimization Suggestions
            </h3>
            <div className="space-y-4">
              {suggestions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
                  <p>No optimization opportunities found!</p>
                  <p className="text-sm">Your current setup is already well-optimized.</p>
                </div>
              ) : (
                suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="p-4 bg-slate-900 rounded-lg border border-slate-600">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(suggestion.category)}
                        <h4 className="font-medium text-white">{suggestion.title}</h4>
                      </div>
                      <div className="flex gap-1">
                        <div className={`px-2 py-1 rounded text-xs border ${getImpactColor(suggestion.impact)}`}>
                          {suggestion.impact}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs border ${getDifficultyColor(suggestion.difficulty)}`}>
                          {suggestion.difficulty}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-400 mb-3">{suggestion.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-slate-500">Current Cost</div>
                        <div className="text-sm font-medium text-red-400">${suggestion.currentCost.toFixed(6)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Potential Savings</div>
                        <div className="text-sm font-medium text-green-400">${suggestion.potentialSavings.toFixed(6)}</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-500">
                      <strong>Implementation:</strong> {suggestion.implementation}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Optimization Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                ${suggestions.reduce((sum, s) => sum + s.potentialSavings, 0).toFixed(6)}
              </div>
              <div className="text-sm text-slate-400">Total Potential Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{suggestions.length}</div>
              <div className="text-sm text-slate-400">Optimization Opportunities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {suggestions.filter(s => s.difficulty === 'easy').length}
              </div>
              <div className="text-sm text-slate-400">Easy Wins</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostProjections;
