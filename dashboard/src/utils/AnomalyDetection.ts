export interface Anomaly {
  id: string;
  type: 'loop' | 'contradiction' | 'expensive_operation' | 'redundant_calls' | 'error_pattern' | 'performance_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedNodes: string[];
  cost?: number;
  latency?: number;
  suggestions: string[];
  confidence: number; // 0-1
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    totalCostImpact: number;
    totalLatencyImpact: number;
  };
}

export class AnomalyDetector {
  private nodes: any[];
  private edges: any[];

  constructor(nodes: any[], edges: any[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  detectAnomalies(): AnomalyDetectionResult {
    const anomalies: Anomaly[] = [];

    // Detect different types of anomalies
    anomalies.push(...this.detectLoops());
    anomalies.push(...this.detectContradictions());
    anomalies.push(...this.detectExpensiveOperations());
    anomalies.push(...this.detectRedundantCalls());
    anomalies.push(...this.detectErrorPatterns());
    anomalies.push(...this.detectPerformanceIssues());

    // Calculate summary
    const summary = this.calculateSummary(anomalies);

    return {
      anomalies,
      summary
    };
  }

  private detectLoops(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Find cycles in the graph
    const findCycles = (nodeId: string, path: string[]): string[][] => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        return [path.slice(cycleStart)];
      }

      if (visited.has(nodeId)) {
        return [];
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const cycles: string[][] = [];
      const outgoingEdges = this.edges.filter(edge => edge.source === nodeId);

      for (const edge of outgoingEdges) {
        const newPath = [...path, nodeId];
        cycles.push(...findCycles(edge.target, newPath));
      }

      recursionStack.delete(nodeId);
      return cycles;
    };

    // Check for cycles starting from each node
    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        const cycles = findCycles(node.id, []);
        for (const cycle of cycles) {
          if (cycle.length > 2) { // Only report cycles with more than 2 nodes
            anomalies.push({
              id: `loop-${cycle.join('-')}`,
              type: 'loop',
              severity: cycle.length > 5 ? 'high' : 'medium',
              title: `Infinite Loop Detected`,
              description: `A potential infinite loop detected involving ${cycle.length} nodes: ${cycle.join(' → ')}`,
              affectedNodes: cycle,
              suggestions: [
                'Add loop detection and break conditions',
                'Implement maximum iteration limits',
                'Review the decision logic that leads to this cycle',
                'Consider adding timeout mechanisms'
              ],
              confidence: 0.8
            });
          }
        }
      }
    }

    // Detect repeated tool calls with same input
    const toolCalls = this.nodes.filter(node => node.type?.includes('tool_start'));
    const toolCallGroups = new Map<string, any[]>();

    for (const call of toolCalls) {
      const key = `${call.toolName}-${call.toolInput}`;
      if (!toolCallGroups.has(key)) {
        toolCallGroups.set(key, []);
      }
      toolCallGroups.get(key)!.push(call);
    }

    for (const [key, calls] of toolCallGroups) {
      if (calls.length > 3) {
        const [toolName, toolInput] = key.split('-', 2);
        anomalies.push({
          id: `redundant-tool-${key}`,
          type: 'redundant_calls',
          severity: calls.length > 5 ? 'high' : 'medium',
          title: `Redundant Tool Calls`,
          description: `Tool "${toolName}" called ${calls.length} times with the same input: "${toolInput}"`,
          affectedNodes: calls.map(c => c.id),
          cost: calls.reduce((sum, c) => sum + (c.cost || 0), 0),
          suggestions: [
            'Implement result caching for this tool',
            'Add deduplication logic before tool calls',
            'Review why the same input is being processed multiple times',
            'Consider batching similar requests'
          ],
          confidence: 0.9
        });
      }
    }

    return anomalies;
  }

  private detectContradictions(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Look for contradictory LLM responses
    const llmResponses = this.nodes.filter(node => node.type === 'llm_end' && node.response);
    
    for (let i = 0; i < llmResponses.length - 1; i++) {
      for (let j = i + 1; j < llmResponses.length; j++) {
        const response1 = llmResponses[i].response.toLowerCase();
        const response2 = llmResponses[j].response.toLowerCase();
        
        // Simple contradiction detection based on keywords
        const contradictions = [
          ['yes', 'no'], ['true', 'false'], ['correct', 'incorrect'],
          ['valid', 'invalid'], ['success', 'failure'], ['pass', 'fail'],
          ['enable', 'disable'], ['allow', 'deny'], ['accept', 'reject']
        ];

        for (const [positive, negative] of contradictions) {
          if ((response1.includes(positive) && response2.includes(negative)) ||
              (response1.includes(negative) && response2.includes(positive))) {
            anomalies.push({
              id: `contradiction-${llmResponses[i].id}-${llmResponses[j].id}`,
              type: 'contradiction',
              severity: 'medium',
              title: `Contradictory Responses`,
              description: `LLM responses contain contradictory information: "${positive}" vs "${negative}"`,
              affectedNodes: [llmResponses[i].id, llmResponses[j].id],
              suggestions: [
                'Review the prompts to ensure consistency',
                'Add validation logic to catch contradictions',
                'Implement response comparison checks',
                'Consider using a single source of truth for decisions'
              ],
              confidence: 0.6
            });
            break;
          }
        }
      }
    }

    return anomalies;
  }

  private detectExpensiveOperations(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    if (this.nodes.length === 0) return anomalies;

    const totalCost = this.nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
    const avgCost = totalCost / this.nodes.length;
    const expensiveThreshold = avgCost * 3; // 3x average cost

    // Find expensive operations
    const expensiveNodes = this.nodes.filter(node => (node.cost || 0) > expensiveThreshold);
    
    for (const node of expensiveNodes) {
      anomalies.push({
        id: `expensive-${node.id}`,
        type: 'expensive_operation',
        severity: (node.cost || 0) > avgCost * 5 ? 'high' : 'medium',
        title: `Expensive Operation`,
        description: `Operation "${node.label || node.type}" costs $${(node.cost || 0).toFixed(6)}, which is ${((node.cost || 0) / avgCost).toFixed(1)}x the average cost`,
        affectedNodes: [node.id],
        cost: node.cost,
        suggestions: [
          'Consider using a more cost-effective model for this operation',
          'Optimize the prompt to reduce token usage',
          'Implement caching for similar operations',
          'Review if this operation is necessary'
        ],
        confidence: 0.8
      });
    }

    // Detect high token usage
    const highTokenNodes = this.nodes.filter(node => 
      node.tokens && (node.tokens.total || 0) > 1000
    );

    for (const node of highTokenNodes) {
      anomalies.push({
        id: `high-tokens-${node.id}`,
        type: 'expensive_operation',
        severity: (node.tokens?.total || 0) > 2000 ? 'high' : 'medium',
        title: `High Token Usage`,
        description: `Operation "${node.label || node.type}" uses ${node.tokens?.total || 0} tokens`,
        affectedNodes: [node.id],
        cost: node.cost,
        suggestions: [
          'Optimize prompts to be more concise',
          'Use few-shot examples instead of long explanations',
          'Consider breaking down complex operations',
          'Implement prompt templates for common patterns'
        ],
        confidence: 0.7
      });
    }

    return anomalies;
  }

  private detectRedundantCalls(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Group nodes by type and similar content
    const nodeGroups = new Map<string, any[]>();
    
    for (const node of this.nodes) {
      const key = `${node.type}-${this.normalizeContent(node.prompt || node.toolInput || '')}`;
      if (!nodeGroups.has(key)) {
        nodeGroups.set(key, []);
      }
      nodeGroups.get(key)!.push(node);
    }

    // Find groups with multiple similar operations
    for (const [key, nodes] of nodeGroups) {
      if (nodes.length > 2) {
        const [type, content] = key.split('-', 2);
        anomalies.push({
          id: `redundant-${key}`,
          type: 'redundant_calls',
          severity: nodes.length > 4 ? 'high' : 'medium',
          title: `Redundant Operations`,
          description: `${nodes.length} similar ${type} operations detected with similar content`,
          affectedNodes: nodes.map(n => n.id),
          cost: nodes.reduce((sum, n) => sum + (n.cost || 0), 0),
          suggestions: [
            'Implement operation deduplication',
            'Add result caching for similar operations',
            'Review the logic that triggers these operations',
            'Consider batching similar requests'
          ],
          confidence: 0.7
        });
      }
    }

    return anomalies;
  }

  private detectErrorPatterns(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Look for error patterns in responses
    const errorKeywords = ['error', 'failed', 'exception', 'timeout', 'invalid', 'unauthorized'];
    const errorNodes = this.nodes.filter(node => {
      const content = (node.response || node.toolOutput || '').toLowerCase();
      return errorKeywords.some(keyword => content.includes(keyword));
    });

    if (errorNodes.length > 0) {
      anomalies.push({
        id: 'error-pattern',
        type: 'error_pattern',
        severity: errorNodes.length > 2 ? 'high' : 'medium',
        title: `Error Pattern Detected`,
        description: `${errorNodes.length} operations resulted in errors or failures`,
        affectedNodes: errorNodes.map(n => n.id),
        suggestions: [
          'Review error handling mechanisms',
          'Add retry logic with exponential backoff',
          'Implement proper validation before operations',
          'Add monitoring and alerting for error rates'
        ],
        confidence: 0.8
      });
    }

    return anomalies;
  }

  private detectPerformanceIssues(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    if (this.nodes.length === 0) return anomalies;

    const totalLatency = this.nodes.reduce((sum, node) => sum + (node.latency || 0), 0);
    const avgLatency = totalLatency / this.nodes.length;
    const slowThreshold = avgLatency * 2; // 2x average latency

    // Find slow operations
    const slowNodes = this.nodes.filter(node => (node.latency || 0) > slowThreshold);
    
    for (const node of slowNodes) {
      anomalies.push({
        id: `slow-${node.id}`,
        type: 'performance_issue',
        severity: (node.latency || 0) > avgLatency * 3 ? 'high' : 'medium',
        title: `Slow Operation`,
        description: `Operation "${node.label || node.type}" took ${node.latency || 0}ms, which is ${((node.latency || 0) / avgLatency).toFixed(1)}x the average latency`,
        affectedNodes: [node.id],
        latency: node.latency,
        suggestions: [
          'Optimize the operation for better performance',
          'Consider using faster models or APIs',
          'Implement parallel processing where possible',
          'Add timeout mechanisms to prevent hanging'
        ],
        confidence: 0.7
      });
    }

    return anomalies;
  }

  private normalizeContent(content: string): string {
    // Normalize content for comparison (remove extra spaces, convert to lowercase)
    return content.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 50);
  }

  private calculateSummary(anomalies: Anomaly[]): AnomalyDetectionResult['summary'] {
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