import { TraceNode, TraceEdge, TraceNodeData } from '../types';

// Core replay types
export interface ReplayModifications {
  promptChanges?: Map<string, string>;
  toolResponseOverrides?: Map<string, any>;
  systemInstructionUpdates?: Map<string, string>;
  contextVariableChanges?: Map<string, any>;
  modelChanges?: Map<string, string>;
}

export interface ReplayOptions {
  mode: ReplayMode;
  mockExternalCalls: boolean;
  useOriginalData: boolean;
  confirmEachSideEffect: boolean;
  maxReplayDepth: number;
}

export enum ReplayMode {
  SAFE = 'safe',
  SIMULATION = 'simulation', 
  WARNING = 'warning',
  BLOCKED = 'blocked'
}

export interface SideEffect {
  type: 'email' | 'api_call' | 'database_write' | 'notification' | 'payment' | 'external_service';
  severity: 'critical' | 'warning' | 'safe';
  reversible: boolean;
  externalDependency: boolean;
  description: string;
  nodeId: string;
}

export interface ReplayResult {
  success: boolean;
  executedNodes: string[];
  skippedNodes: string[];
  sideEffects: SideEffect[];
  totalCost: number;
  totalLatency: number;
  newTraceId?: string;
  error?: string;
}

export interface StateSnapshot {
  nodeId: string;
  timestamp: number;
  conversationHistory: any[];
  toolOutputs: Map<string, any>;
  contextVariables: Map<string, any>;
  externalState?: any;
  checksums: Map<string, string>;
}

// Side Effect Detection
export class SideEffectDetector {
  private sideEffectPatterns = {
    email: [
      'send_email', 'email', 'notification', 'mail', 'smtp',
      'email sent', 'notification sent', 'mail delivered'
    ],
    api_call: [
      'api', 'http', 'request', 'fetch', 'call', 'endpoint',
      'external', 'third_party', 'webhook'
    ],
    database_write: [
      'insert', 'update', 'delete', 'save', 'write', 'create',
      'database', 'db', 'persist', 'store'
    ],
    payment: [
      'payment', 'charge', 'billing', 'invoice', 'transaction',
      'stripe', 'paypal', 'credit_card', 'debit'
    ],
    external_service: [
      'aws', 'azure', 'gcp', 'slack', 'discord', 'teams',
      'github', 'gitlab', 'jira', 'confluence'
    ]
  };

  detectSideEffects(node: TraceNode): SideEffect[] {
    const effects: SideEffect[] = [];
    
    // Safety check for node.data
    if (!node.data) {
      return effects;
    }
    
    // Check tool name
    if (node.data.toolName) {
      const toolName = node.data.toolName.toLowerCase();
      for (const [type, patterns] of Object.entries(this.sideEffectPatterns)) {
        if (patterns.some(pattern => toolName.includes(pattern))) {
          effects.push({
            type: type as any,
            severity: this.getSeverity(type),
            reversible: this.isReversible(type),
            externalDependency: this.isExternalDependency(type),
            description: `Tool "${node.data.toolName}" may have side effects`,
            nodeId: node.id
          });
        }
      }
    }

    // Check response content
    if (node.data.response) {
      const response = node.data.response.toLowerCase();
      for (const [type, patterns] of Object.entries(this.sideEffectPatterns)) {
        if (patterns.some(pattern => response.includes(pattern))) {
          effects.push({
            type: type as any,
            severity: this.getSeverity(type),
            reversible: this.isReversible(type),
            externalDependency: this.isExternalDependency(type),
            description: `Response indicates ${type} operation`,
            nodeId: node.id
          });
        }
      }
    }

    // Check metadata
    if (node.data.metadata?.sideEffects) {
      effects.push(...node.data.metadata.sideEffects);
    }

    return effects;
  }

  private getSeverity(type: string): 'critical' | 'warning' | 'safe' {
    switch (type) {
      case 'payment': return 'critical';
      case 'email': return 'warning';
      case 'database_write': return 'warning';
      case 'api_call': return 'warning';
      case 'external_service': return 'warning';
      default: return 'safe';
    }
  }

  private isReversible(type: string): boolean {
    switch (type) {
      case 'payment': return false;
      case 'email': return false;
      case 'database_write': return true;
      case 'api_call': return false;
      case 'external_service': return false;
      default: return true;
    }
  }

  private isExternalDependency(type: string): boolean {
    return ['api_call', 'external_service', 'payment'].includes(type);
  }
}

// State Snapshot Manager
export class StateSnapshotManager {
  private snapshots: Map<string, StateSnapshot> = new Map();

  captureSnapshot(nodeId: string, trace: any): StateSnapshot {
    const snapshot: StateSnapshot = {
      nodeId,
      timestamp: Date.now(),
      conversationHistory: this.extractConversationHistory(trace, nodeId),
      toolOutputs: this.extractToolOutputs(trace, nodeId),
      contextVariables: this.extractContextVariables(trace, nodeId),
      externalState: this.captureExternalState(),
      checksums: this.calculateChecksums(trace, nodeId)
    };

    this.snapshots.set(nodeId, snapshot);
    return snapshot;
  }

  getSnapshot(nodeId: string): StateSnapshot | undefined {
    return this.snapshots.get(nodeId);
  }

  private extractConversationHistory(trace: any, upToNodeId: string): any[] {
    // Extract conversation history up to the specified node
    const history: any[] = [];
    const nodes = trace.nodes || [];
    
    for (const node of nodes) {
      if (node.id === upToNodeId) break;
      
      if (node.type?.includes('llm')) {
        history.push({
          role: 'user',
          content: node.prompt || node.input
        });
        if (node.response) {
          history.push({
            role: 'assistant', 
            content: node.response
          });
        }
      }
    }
    
    return history;
  }

  private extractToolOutputs(trace: any, upToNodeId: string): Map<string, any> {
    const outputs = new Map<string, any>();
    const nodes = trace.nodes || [];
    
    for (const node of nodes) {
      if (node.id === upToNodeId) break;
      
      if (node.type?.includes('tool') && node.toolName) {
        outputs.set(node.toolName, {
          input: node.toolInput,
          output: node.response,
          timestamp: node.timestamp
        });
      }
    }
    
    return outputs;
  }

  private extractContextVariables(trace: any, upToNodeId: string): Map<string, any> {
    const variables = new Map<string, any>();
    const nodes = trace.nodes || [];
    
    for (const node of nodes) {
      if (node.id === upToNodeId) break;
      
      if (node.metadata?.context) {
        Object.entries(node.metadata.context).forEach(([key, value]) => {
          variables.set(key, value);
        });
      }
    }
    
    return variables;
  }

  private captureExternalState(): any {
    // In a real implementation, this would capture current external state
    // For now, return a placeholder
    return {
      timestamp: Date.now(),
      note: 'External state capture not implemented in demo'
    };
  }

  private calculateChecksums(trace: any, upToNodeId: string): Map<string, string> {
    const checksums = new Map<string, string>();
    
    // Simple checksum calculation for demo
    const relevantData = JSON.stringify({
      nodes: trace.nodes?.slice(0, trace.nodes.findIndex((n: any) => n.id === upToNodeId) + 1),
      edges: trace.edges
    });
    
    checksums.set('trace_data', this.simpleHash(relevantData));
    return checksums;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}

// Mock Manager for Simulation Mode
export class MockManager {
  private mockResponses: Map<string, any> = new Map();
  private originalResponses: Map<string, any> = new Map();

  setupMocks(node: TraceNode, sideEffects: SideEffect[]): void {
    for (const effect of sideEffects) {
      if (effect.severity !== 'critical') {
        this.createMockResponse(node, effect);
      }
    }
  }

  private createMockResponse(node: TraceNode, effect: SideEffect): void {
    const mockResponse = this.generateMockResponse(effect.type, node);
    this.mockResponses.set(node.id, mockResponse);
    
    // Store original response for restoration
    if (node.data?.response) {
      this.originalResponses.set(node.id, node.data.response);
    }
  }

  private generateMockResponse(type: string, node: TraceNode): any {
    switch (type) {
      case 'email':
        return {
          success: true,
          messageId: `mock-email-${Date.now()}`,
          simulated: true,
          originalAction: 'email_send',
          mockNote: 'Email sending was mocked during replay'
        };
      
      case 'api_call':
        return {
          success: true,
          data: node.data?.response || 'Mock API response',
          simulated: true,
          originalAction: 'api_call',
          mockNote: 'API call was mocked during replay'
        };
      
      case 'database_write':
        return {
          success: true,
          recordId: `mock-record-${Date.now()}`,
          simulated: true,
          originalAction: 'database_write',
          mockNote: 'Database write was mocked during replay'
        };
      
      default:
        return {
          success: true,
          simulated: true,
          originalAction: type,
          mockNote: `${type} operation was mocked during replay`
        };
    }
  }

  getMockResponse(nodeId: string): any {
    return this.mockResponses.get(nodeId);
  }

  restoreOriginalResponse(nodeId: string): any {
    return this.originalResponses.get(nodeId);
  }

  clearMocks(): void {
    this.mockResponses.clear();
    this.originalResponses.clear();
  }
}

// Main Replay Engine
export class ReplayEngine {
  private sideEffectDetector: SideEffectDetector;
  private stateSnapshotManager: StateSnapshotManager;
  private mockManager: MockManager;

  constructor() {
    this.sideEffectDetector = new SideEffectDetector();
    this.stateSnapshotManager = new StateSnapshotManager();
    this.mockManager = new MockManager();
  }

  analyzeReplaySafety(startNodeId: string, trace: any): {
    mode: ReplayMode;
    sideEffects: SideEffect[];
    warnings: string[];
    recommendations: string[];
  } {
    const nodesToReplay = this.getNodesFromPoint(startNodeId, trace);
    const allSideEffects: SideEffect[] = [];
    
    for (const node of nodesToReplay) {
      const effects = this.sideEffectDetector.detectSideEffects(node);
      allSideEffects.push(...effects);
    }

    const mode = this.determineReplayMode(allSideEffects);
    const warnings = this.generateWarnings(allSideEffects);
    const recommendations = this.generateRecommendations(allSideEffects, mode);

    return {
      mode,
      sideEffects: allSideEffects,
      warnings,
      recommendations
    };
  }

  private getNodesFromPoint(startNodeId: string, trace: any): TraceNode[] {
    const nodes: TraceNode[] = [];
    const startIndex = trace.nodes.findIndex((n: any) => n.id === startNodeId);
    
    if (startIndex === -1) return nodes;
    
    // Get all nodes from start point onwards
    return trace.nodes.slice(startIndex);
  }

  private determineReplayMode(sideEffects: SideEffect[]): ReplayMode {
    if (sideEffects.some(e => e.severity === 'critical' && !e.reversible)) {
      return ReplayMode.BLOCKED;
    }
    
    if (sideEffects.some(e => e.externalDependency)) {
      return ReplayMode.WARNING;
    }
    
    if (sideEffects.length > 0) {
      return ReplayMode.SIMULATION;
    }
    
    return ReplayMode.SAFE;
  }

  private generateWarnings(sideEffects: SideEffect[]): string[] {
    const warnings: string[] = [];
    
    for (const effect of sideEffects) {
      switch (effect.severity) {
        case 'critical':
          warnings.push(`🚫 CRITICAL: ${effect.description} - Replay may not be safe`);
          break;
        case 'warning':
          warnings.push(`⚠️ WARNING: ${effect.description} - External dependency detected`);
          break;
      }
    }
    
    return warnings;
  }

  private generateRecommendations(sideEffects: SideEffect[], mode: ReplayMode): string[] {
    const recommendations: string[] = [];
    
    switch (mode) {
      case ReplayMode.BLOCKED:
        recommendations.push('Consider modifying the agent to avoid critical side effects');
        recommendations.push('Use simulation mode for testing without side effects');
        break;
      case ReplayMode.WARNING:
        recommendations.push('Enable mock mode to simulate external calls');
        recommendations.push('Review external dependencies before replay');
        break;
      case ReplayMode.SIMULATION:
        recommendations.push('Safe to replay with mocked side effects');
        break;
      case ReplayMode.SAFE:
        recommendations.push('Safe to replay - no side effects detected');
        break;
    }
    
    return recommendations;
  }

  async executeReplay(
    startNodeId: string,
    trace: any,
    modifications: ReplayModifications,
    options: ReplayOptions
  ): Promise<ReplayResult> {
    try {
      // 1. Analyze safety
      const safetyAnalysis = this.analyzeReplaySafety(startNodeId, trace);
      
      if (safetyAnalysis.mode === ReplayMode.BLOCKED) {
        return {
          success: false,
          executedNodes: [],
          skippedNodes: [],
          sideEffects: safetyAnalysis.sideEffects,
          totalCost: 0,
          totalLatency: 0,
          error: 'Replay blocked due to critical side effects'
        };
      }

      // 2. Capture state snapshot
      const snapshot = this.stateSnapshotManager.captureSnapshot(startNodeId, trace);
      
      // 3. Setup mocks if needed
      if (options.mockExternalCalls) {
        const nodesToReplay = this.getNodesFromPoint(startNodeId, trace);
        for (const node of nodesToReplay) {
          const effects = this.sideEffectDetector.detectSideEffects(node);
          this.mockManager.setupMocks(node, effects);
        }
      }

      // 4. Execute replay
      const result = await this.executeReplayNodes(
        startNodeId,
        trace,
        modifications,
        options,
        safetyAnalysis.sideEffects
      );

      return result;
    } catch (error) {
      return {
        success: false,
        executedNodes: [],
        skippedNodes: [],
        sideEffects: [],
        totalCost: 0,
        totalLatency: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeReplayNodes(
    startNodeId: string,
    trace: any,
    modifications: ReplayModifications,
    options: ReplayOptions,
    sideEffects: SideEffect[]
  ): Promise<ReplayResult> {
    const executedNodes: string[] = [];
    const skippedNodes: string[] = [];
    let totalCost = 0;
    let totalLatency = 0;

    const nodesToReplay = this.getNodesFromPoint(startNodeId, trace);
    
    for (const node of nodesToReplay) {
      try {
        // Check if node should be skipped due to side effects
        const nodeEffects = sideEffects.filter(e => e.nodeId === node.id);
        const hasCriticalEffects = nodeEffects.some(e => e.severity === 'critical' && !e.reversible);
        
        if (hasCriticalEffects && !options.mockExternalCalls) {
          skippedNodes.push(node.id);
          continue;
        }

        // Apply modifications
        const modifiedNode = this.applyModifications(node, modifications);
        
        // Execute node (simulated)
        const executionResult = await this.simulateNodeExecution(modifiedNode, nodeEffects);
        
        executedNodes.push(node.id);
        totalCost += executionResult.cost || 0;
        totalLatency += executionResult.latency || 0;
        
      } catch (error) {
        console.error(`Failed to execute node ${node.id}:`, error);
        skippedNodes.push(node.id);
      }
    }

    return {
      success: true,
      executedNodes,
      skippedNodes,
      sideEffects,
      totalCost,
      totalLatency,
      newTraceId: `replay-${Date.now()}`
    };
  }

  private applyModifications(node: TraceNode, modifications: ReplayModifications): TraceNode {
    const modifiedNode = { ...node };
    
    // Safety check for node.data
    if (!modifiedNode.data) {
      return modifiedNode;
    }
    
    // Apply prompt changes
    if (modifications.promptChanges?.has(node.id)) {
      modifiedNode.data.prompt = modifications.promptChanges.get(node.id);
    }
    
    // Apply tool response overrides
    if (modifications.toolResponseOverrides?.has(node.id)) {
      modifiedNode.data.response = modifications.toolResponseOverrides.get(node.id);
    }
    
    // Apply model changes
    if (modifications.modelChanges?.has(node.id)) {
      modifiedNode.data.model = modifications.modelChanges.get(node.id);
    }
    
    return modifiedNode;
  }

  private async simulateNodeExecution(node: TraceNode, sideEffects: SideEffect[]): Promise<{
    cost: number;
    latency: number;
  }> {
    // Simulate execution time
    const latency = Math.random() * 1000 + 100; // 100-1100ms
    
    // Calculate cost based on node type and modifications
    let cost = node.data?.cost || 0;
    
    // If there are side effects, use mock responses
    if (sideEffects.length > 0) {
      const mockResponse = this.mockManager.getMockResponse(node.id);
      if (mockResponse) {
        // Mock execution is typically faster and cheaper
        cost *= 0.1; // 10% of original cost
      }
    }
    
    return { cost, latency };
  }

  cleanup(): void {
    this.mockManager.clearMocks();
  }
}
