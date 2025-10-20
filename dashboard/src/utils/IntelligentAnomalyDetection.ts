import { Anomaly } from './AnomalyDetection';

// Re-export AnomalyDetectionResult for compatibility
export interface AnomalyDetectionResult {
  anomalies: IntelligentAnomaly[];
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    totalCostImpact: number;
    totalLatencyImpact: number;
  };
}

// Enhanced interfaces for intelligent detection
export interface DecisionNode {
  id: string;
  timestamp: number;
  decision: string;
  context: string;
  confidence: number;
  parameters: Record<string, any>;
}

export interface LoopPattern {
  toolName: string;
  parameters: Record<string, any>;
  frequency: number;
  totalCost: number;
  firstOccurrence: number;
  lastOccurrence: number;
  variations: Array<{
    parameters: Record<string, any>;
    timestamp: number;
    cost: number;
  }>;
}

export interface CostStatistics {
  mean: number;
  stdDev: number;
  recentRuns: number[];
  outlierThreshold: number;
}

export interface TimeoutPrediction {
  estimatedTotalCost: number;
  estimatedTotalTime: number;
  confidence: number;
  recommendation: 'continue' | 'terminate' | 'monitor';
  reason: string;
}

export interface IntelligentAnomaly extends Anomaly {
  // Enhanced fields for intelligent detection
  loopPattern?: LoopPattern;
  conflictingDecisions?: DecisionNode[];
  costStatistics?: CostStatistics;
  timeoutPrediction?: TimeoutPrediction;
  semanticSimilarity?: number;
  circuitBreakerTriggered?: boolean;
}

export class IntelligentAnomalyDetector {
  private nodes: any[];
  private edges: any[];
  private decisionGraph: Map<string, DecisionNode[]> = new Map();
  private loopPatterns: Map<string, LoopPattern> = new Map();
  private costHistory: number[] = [];
  private semanticCache: Map<string, number> = new Map();

  constructor(nodes: any[], edges: any[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.initializeIntelligentDetection();
  }

  private initializeIntelligentDetection() {
    // Build decision graph from LLM responses
    this.buildDecisionGraph();
    
    // Initialize cost statistics
    this.initializeCostStatistics();
    
    // Detect existing loop patterns
    this.detectExistingLoopPatterns();
  }

  private buildDecisionGraph() {
    const llmResponses = this.nodes.filter(node => 
      node.type === 'llm_end' && node.response
    );

    for (const response of llmResponses) {
      const decisions = this.extractDecisions(response.response);
      for (const decision of decisions) {
        const decisionNode: DecisionNode = {
          id: `${response.id}-${Date.now()}`,
          timestamp: response.timestamp || Date.now(),
          decision: decision.text,
          context: decision.context,
          confidence: decision.confidence,
          parameters: decision.parameters
        };

        const key = this.getDecisionKey(decision.text);
        if (!this.decisionGraph.has(key)) {
          this.decisionGraph.set(key, []);
        }
        this.decisionGraph.get(key)!.push(decisionNode);
      }
    }
  }

  private extractDecisions(response: string): Array<{
    text: string;
    context: string;
    confidence: number;
    parameters: Record<string, any>;
  }> {
    const decisions = [];
    
    // Simple decision extraction patterns
    const decisionPatterns = [
      /(?:decided|chose|selected|recommended|suggested|will|should|going to)\s+([^.!?]+)/gi,
      /(?:user wants|user needs|user prefers|user likes)\s+([^.!?]+)/gi,
      /(?:restaurant|food|cuisine|type|category)\s*[:=]\s*([^.!?]+)/gi
    ];

    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        decisions.push({
          text: match[1].trim(),
          context: response.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50),
          confidence: 0.8, // Could be enhanced with ML confidence scoring
          parameters: this.extractParameters(match[1])
        });
      }
    }

    return decisions;
  }

  private extractParameters(text: string): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    // Extract common parameters
    const paramPatterns = {
      cuisine: /(?:cuisine|food|type)\s*[:=]\s*([^,.\s]+)/gi,
      price: /(?:price|cost|budget)\s*[:=]\s*([^,.\s]+)/gi,
      location: /(?:location|area|neighborhood)\s*[:=]\s*([^,.\s]+)/gi,
      preference: /(?:vegetarian|vegan|halal|kosher|gluten-free)/gi
    };

    for (const [key, pattern] of Object.entries(paramPatterns)) {
      const match = pattern.exec(text);
      if (match) {
        parameters[key] = match[1];
      }
    }

    return parameters;
  }

  private getDecisionKey(decision: string): string {
    // Normalize decision text for grouping
    return decision.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
  }

  private initializeCostStatistics() {
    const costs = this.nodes
      .filter(node => node.cost && node.cost > 0)
      .map(node => node.cost);

    if (costs.length > 0) {
      this.costHistory = costs;
    }
  }

  private detectExistingLoopPatterns() {
    const toolCalls = this.nodes.filter(node => 
      node.type?.includes('tool_start') && node.toolName
    );

    for (const call of toolCalls) {
      const key = `${call.toolName}-${this.normalizeParameters(call.toolInput || '')}`;
      
      if (!this.loopPatterns.has(key)) {
        this.loopPatterns.set(key, {
          toolName: call.toolName,
          parameters: this.parseParameters(call.toolInput || ''),
          frequency: 0,
          totalCost: 0,
          firstOccurrence: call.timestamp || Date.now(),
          lastOccurrence: call.timestamp || Date.now(),
          variations: []
        });
      }

      const pattern = this.loopPatterns.get(key)!;
      pattern.frequency++;
      pattern.totalCost += call.cost || 0;
      pattern.lastOccurrence = call.timestamp || Date.now();
      
      pattern.variations.push({
        parameters: this.parseParameters(call.toolInput || ''),
        timestamp: call.timestamp || Date.now(),
        cost: call.cost || 0
      });
    }
  }

  private normalizeParameters(input: string): string {
    // Normalize parameters for fuzzy matching
    return input.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseParameters(input: string): Record<string, any> {
    try {
      // Try to parse as JSON first
      return JSON.parse(input);
    } catch {
      // Fall back to simple parameter extraction
      const params: Record<string, any> = {};
      const pairs = input.split(/[,&]/);
      
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key.trim()] = value.trim();
        }
      }
      
      return params;
    }
  }

  private calculateSemanticSimilarity(text1: string, text2: string): number {
    const cacheKey = `${text1}|${text2}`;
    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey)!;
    }

    // Simple semantic similarity using word overlap and edit distance
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Add edit distance component
    const editDistance = this.calculateEditDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    const editSimilarity = maxLength > 0 ? 1 - (editDistance / maxLength) : 1;
    
    const similarity = (jaccardSimilarity * 0.7) + (editSimilarity * 0.3);
    
    this.semanticCache.set(cacheKey, similarity);
    return similarity;
  }

  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateCostStatistics(): CostStatistics {
    if (this.costHistory.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        recentRuns: [],
        outlierThreshold: 0
      };
    }

    const mean = this.costHistory.reduce((sum, cost) => sum + cost, 0) / this.costHistory.length;
    const variance = this.costHistory.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / this.costHistory.length;
    const stdDev = Math.sqrt(variance);
    
    // Use 3-sigma rule for outlier detection
    const outlierThreshold = mean + (3 * stdDev);
    
    return {
      mean,
      stdDev,
      recentRuns: this.costHistory.slice(-10), // Last 10 runs
      outlierThreshold
    };
  }

  private predictTimeout(): TimeoutPrediction {
    const currentCost = this.nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
    const currentTime = this.nodes.reduce((sum, node) => sum + (node.latency || 0), 0);
    
    const costStats = this.calculateCostStatistics();
    const avgCostPerNode = costStats.mean;
    const avgTimePerNode = this.nodes.length > 0 ? currentTime / this.nodes.length : 0;
    
    // Estimate remaining work based on typical patterns
    const estimatedRemainingNodes = Math.max(1, 5 - this.nodes.length); // Assume max 5 nodes typically
    const estimatedTotalCost = currentCost + (estimatedRemainingNodes * avgCostPerNode);
    const estimatedTotalTime = currentTime + (estimatedRemainingNodes * avgTimePerNode);
    
    // Determine recommendation
    let recommendation: 'continue' | 'terminate' | 'monitor' = 'continue';
    let reason = 'Execution within normal parameters';
    let confidence = 0.7;

    if (estimatedTotalCost > costStats.outlierThreshold * 2) {
      recommendation = 'terminate';
      reason = `Projected cost ($${estimatedTotalCost.toFixed(4)}) exceeds 2x outlier threshold`;
      confidence = 0.9;
    } else if (estimatedTotalCost > costStats.outlierThreshold) {
      recommendation = 'monitor';
      reason = `Projected cost ($${estimatedTotalCost.toFixed(4)}) exceeds outlier threshold`;
      confidence = 0.8;
    }

    return {
      estimatedTotalCost,
      estimatedTotalTime,
      confidence,
      recommendation,
      reason
    };
  }

  detectIntelligentAnomalies(): AnomalyDetectionResult {
    const anomalies: IntelligentAnomaly[] = [];

    // 1. Enhanced Loop Detection with Fuzzy Matching
    anomalies.push(...this.detectIntelligentLoops());

    // 2. Contradiction Detection with Semantic Similarity
    anomalies.push(...this.detectContradictions());

    // 3. Cost Anomaly Detection with Statistical Analysis
    anomalies.push(...this.detectCostAnomalies());

    // 4. Timeout Prediction
    anomalies.push(...this.detectTimeoutRisks());

    // Calculate summary
    const summary = this.calculateSummary(anomalies);

    return {
      anomalies,
      summary
    };
  }

  private detectIntelligentLoops(): IntelligentAnomaly[] {
    const anomalies: IntelligentAnomaly[] = [];

    for (const [key, pattern] of this.loopPatterns) {
      if (pattern.frequency >= 3) {
        // Check for circuit breaker
        const circuitBreakerTriggered = pattern.frequency >= 5;
        
        // Calculate parameter similarity across variations
        const avgSimilarity = this.calculateParameterSimilarity(pattern.variations);
        
        anomalies.push({
          id: `intelligent-loop-${key}`,
          type: 'loop',
          severity: circuitBreakerTriggered ? 'critical' : 'high',
          title: `Intelligent Loop Detection: ${pattern.toolName}`,
          description: `Tool "${pattern.toolName}" called ${pattern.frequency} times with ${(avgSimilarity * 100).toFixed(1)}% parameter similarity. Total cost: $${pattern.totalCost.toFixed(6)}`,
          affectedNodes: this.nodes
            .filter(node => node.toolName === pattern.toolName)
            .map(node => node.id),
          cost: pattern.totalCost,
          latency: pattern.lastOccurrence - pattern.firstOccurrence,
          suggestions: [
            'Implement circuit breaker: Stop after 3 identical calls',
            'Add parameter variation detection',
            'Cache results for identical parameters',
            'Add timeout mechanism for repeated calls',
            circuitBreakerTriggered ? 'URGENT: Circuit breaker should have triggered' : 'Monitor for circuit breaker threshold'
          ],
          confidence: 0.95,
          loopPattern: pattern,
          circuitBreakerTriggered,
          semanticSimilarity: avgSimilarity
        });
      }
    }

    return anomalies;
  }

  private calculateParameterSimilarity(variations: Array<{ parameters: Record<string, any> }>): number {
    if (variations.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < variations.length - 1; i++) {
      for (let j = i + 1; j < variations.length; j++) {
        const params1 = JSON.stringify(variations[i].parameters);
        const params2 = JSON.stringify(variations[j].parameters);
        totalSimilarity += this.calculateSemanticSimilarity(params1, params2);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1;
  }

  private detectContradictions(): IntelligentAnomaly[] {
    const anomalies: IntelligentAnomaly[] = [];

    for (const [key, decisions] of this.decisionGraph) {
      if (decisions.length < 2) continue;

      // Sort decisions by timestamp
      const sortedDecisions = decisions.sort((a, b) => a.timestamp - b.timestamp);

      for (let i = 0; i < sortedDecisions.length - 1; i++) {
        for (let j = i + 1; j < sortedDecisions.length; j++) {
          const decision1 = sortedDecisions[i];
          const decision2 = sortedDecisions[j];

          const similarity = this.calculateSemanticSimilarity(decision1.decision, decision2.decision);
          
          // Check for contradictions using semantic similarity and keyword analysis
          if (this.isContradiction(decision1.decision, decision2.decision, similarity)) {
            anomalies.push({
              id: `contradiction-${decision1.id}-${decision2.id}`,
              type: 'contradiction',
              severity: 'high',
              title: 'Intelligent Contradiction Detection',
              description: `Agent made conflicting decisions: "${decision1.decision.substring(0, 50)}..." vs "${decision2.decision.substring(0, 50)}..." (${(similarity * 100).toFixed(1)}% similarity)`,
              affectedNodes: [decision1.id, decision2.id],
              suggestions: [
                'Review decision logic for consistency',
                'Implement decision validation checks',
                'Add context awareness to prevent contradictions',
                'Consider decision caching for similar contexts',
                'Add contradiction detection in real-time'
              ],
              confidence: 0.85,
              conflictingDecisions: [decision1, decision2],
              semanticSimilarity: similarity
            });
          }
        }
      }
    }

    return anomalies;
  }

  private isContradiction(decision1: string, decision2: string, similarity: number): boolean {
    // High similarity but conflicting keywords indicates contradiction
    if (similarity < 0.3) return false; // Too different to be related

    const contradictionKeywords = [
      ['vegetarian', 'meat', 'steak', 'beef'],
      ['cheap', 'expensive', 'budget', 'luxury'],
      ['yes', 'no', 'accept', 'reject'],
      ['enable', 'disable', 'on', 'off'],
      ['allow', 'deny', 'permit', 'block']
    ];

    for (const group of contradictionKeywords) {
      const hasFirst = group.some(keyword => decision1.toLowerCase().includes(keyword));
      const hasSecond = group.some(keyword => decision2.toLowerCase().includes(keyword));
      
      if (hasFirst && hasSecond && similarity > 0.4) {
        return true;
      }
    }

    return false;
  }

  private detectCostAnomalies(): IntelligentAnomaly[] {
    const anomalies: IntelligentAnomaly[] = [];
    const costStats = this.calculateCostStatistics();

    if (costStats.recentRuns.length === 0) return anomalies;

    const currentCost = this.nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
    
    // Check if current cost is an outlier
    if (currentCost > costStats.outlierThreshold) {
      const zScore = (currentCost - costStats.mean) / costStats.stdDev;
      
      anomalies.push({
        id: `cost-anomaly-${Date.now()}`,
        type: 'expensive_operation',
        severity: zScore > 3 ? 'critical' : 'high',
        title: 'Cost Anomaly Detection',
        description: `Current run cost $${currentCost.toFixed(6)} is ${zScore.toFixed(1)} standard deviations above mean ($${costStats.mean.toFixed(6)}). Recent runs: ${costStats.recentRuns.map(c => `$${c.toFixed(4)}`).join(', ')}`,
        affectedNodes: this.nodes
          .filter(node => node.cost && node.cost > costStats.mean)
          .map(node => node.id),
        cost: currentCost,
        suggestions: [
          'Investigate why this run is significantly more expensive',
          'Check for infinite loops or excessive API calls',
          'Review token usage patterns',
          'Consider implementing cost limits',
          'Add real-time cost monitoring'
        ],
        confidence: 0.9,
        costStatistics: costStats
      });
    }

    return anomalies;
  }

  private detectTimeoutRisks(): IntelligentAnomaly[] {
    const anomalies: IntelligentAnomaly[] = [];
    const prediction = this.predictTimeout();

    if (prediction.recommendation !== 'continue') {
      anomalies.push({
        id: `timeout-prediction-${Date.now()}`,
        type: 'performance_issue',
        severity: prediction.recommendation === 'terminate' ? 'critical' : 'medium',
        title: 'Timeout Risk Prediction',
        description: `Based on current progress, estimated total cost: $${prediction.estimatedTotalCost.toFixed(6)}, time: ${prediction.estimatedTotalTime}ms. ${prediction.reason}`,
        affectedNodes: this.nodes.map(node => node.id),
        cost: prediction.estimatedTotalCost,
        latency: prediction.estimatedTotalTime,
        suggestions: [
          prediction.recommendation === 'terminate' ? 'Consider terminating this execution' : 'Monitor execution closely',
          'Implement early termination mechanisms',
          'Set cost and time budgets',
          'Add progress tracking',
          'Consider breaking down complex operations'
        ],
        confidence: prediction.confidence,
        timeoutPrediction: prediction
      });
    }

    return anomalies;
  }

  private calculateSummary(anomalies: IntelligentAnomaly[]): AnomalyDetectionResult['summary'] {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let totalCostImpact = 0;
    let totalLatencyImpact = 0;

    for (const anomaly of anomalies) {
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;
      totalCostImpact += anomaly.cost || 0;
      totalLatencyImpact += anomaly.latency || 0;
    }

    return {
      total: anomalies.length,
      byType,
      bySeverity,
      totalCostImpact,
      totalLatencyImpact
    };
  }
}
