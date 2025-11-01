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
  // NEW: live mode + injection points
  liveMode?: boolean;
  llm?: LLMCaller;
  temperature?: number;
  maxTokens?: number;
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

// ✨ NEW: type your LLM caller
export type LLMCaller = (args: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}) => Promise<string>;

// ------------------------- Side Effect Detection -------------------------
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
    if (!node.data) return effects;

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
      const response = String(node.data.response).toLowerCase();
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

// ------------------------- State Snapshot Manager -------------------------
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
    const history: any[] = [];
    const nodes = trace.nodes || [];

    for (const node of nodes) {
      if (node.id === upToNodeId) break;

      if (String(node.type || '').includes('llm')) {
        history.push({ role: 'user', content: node.prompt || node.input });
        if (node.response) {
          history.push({ role: 'assistant', content: node.response });
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
      if (String(node.type || '').includes('tool') && node.toolName) {
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
    return {
      timestamp: Date.now(),
      note: 'External state capture not implemented in demo'
    };
  }

  private calculateChecksums(trace: any, upToNodeId: string): Map<string, string> {
    const checksums = new Map<string, string>();
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
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// ------------------------- Mock Manager -------------------------
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

    if (node.data?.response) {
      this.originalResponses.set(node.id, node.data.response);
    }
  }

  private generateMockResponse(type: string, node: TraceNode): any {
    switch (type) {
      case 'email':
        return { success: true, messageId: `mock-email-${Date.now()}`, simulated: true, originalAction: 'email_send', mockNote: 'Email sending was mocked during replay' };
      case 'api_call':
        return { success: true, data: node.data?.response || 'Mock API response', simulated: true, originalAction: 'api_call', mockNote: 'API call was mocked during replay' };
      case 'database_write':
        return { success: true, recordId: `mock-record-${Date.now()}`, simulated: true, originalAction: 'database_write', mockNote: 'Database write was mocked during replay' };
      default:
        return { success: true, simulated: true, originalAction: type, mockNote: `${type} operation was mocked during replay` };
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

// ------------------------- Replay Engine -------------------------
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
    const { nodes: nodesToReplay } = this.getNodesFromPoint(startNodeId, trace);
    const allSideEffects: SideEffect[] = [];
    for (const node of nodesToReplay) {
      const effects = this.sideEffectDetector.detectSideEffects(node);
      allSideEffects.push(...effects);
    }

    const mode = this.determineReplayMode(allSideEffects);
    const warnings = this.generateWarnings(allSideEffects);
    const recommendations = this.generateRecommendations(allSideEffects, mode);

    return { mode, sideEffects: allSideEffects, warnings, recommendations };
  }

// private getNodesFromPoint(startNodeId: string, trace: any): TraceNode[] {
//   const startIndex = trace.nodes.findIndex((n: any) => n.id === startNodeId);
//   if (startIndex === -1) return [];
//   return trace.nodes.slice(startIndex);
// }

private resolveTraceNodes(trace: any): any[] {
  if (!trace) return [];
  // Expected outer shape: { trace, nodes, edges, ... }
  if (Array.isArray(trace.nodes)) return trace.nodes;

  // Sometimes callers accidentally pass the inner "trace" object (no nodes)
  // If your API ever nests nodes differently, normalize here as well.
  if (trace.trace && Array.isArray(trace.trace.nodes)) return trace.trace.nodes;
  if (trace.graph && Array.isArray(trace.graph.nodes)) return trace.graph.nodes;

  return [];
}

// 🔁 replace your existing getNodesFromPoint with this:
public getNodesFromPoint(startNodeId: string, trace: any) {
  const nodes = this.resolveTraceNodes(trace);

  if (!Array.isArray(nodes) || nodes.length === 0) {
    // Soft-fail instead of throwing — safety analysis can continue without nodes
    console.warn(
      'ReplayEngine.getNodesFromPoint(): nodes is undefined or not an array',
      trace && {
        hasOuterTrace: !!trace.trace,
        keys: Object.keys(trace || {}),
      }
    );
    return {
      nodes: [],
      currentIndex: -1,
      previousNodes: [],
      nextNodes: [],
    };
  }

  const currentIndex = nodes.findIndex((n: any) => n.id === startNodeId);

  // If not found, still return a safe structure
  if (currentIndex < 0) {
    return {
      nodes,
      currentIndex: -1,
      previousNodes: [],
      nextNodes: nodes,
    };
  }

  return {
    nodes,
    currentIndex,
    previousNodes: nodes.slice(0, currentIndex),
    nextNodes: nodes.slice(currentIndex + 1),
  };
}


  private determineReplayMode(sideEffects: SideEffect[]): ReplayMode {
    if (sideEffects.some(e => e.severity === 'critical' && !e.reversible)) return ReplayMode.BLOCKED;
    if (sideEffects.some(e => e.externalDependency)) return ReplayMode.WARNING;
    if (sideEffects.length > 0) return ReplayMode.SIMULATION;
    return ReplayMode.SAFE;
  }

  private generateWarnings(sideEffects: SideEffect[]): string[] {
    const warnings: string[] = [];
    for (const effect of sideEffects) {
      switch (effect.severity) {
        case 'critical': warnings.push(`🚫 CRITICAL: ${effect.description} - Replay may not be safe`); break;
        case 'warning': warnings.push(`⚠️ WARNING: ${effect.description} - External dependency detected`); break;
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

  // Fallback for Node environments without 'performance'
  private now(): number {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    // Node fallback (ms)
    // @ts-ignore
    return Number(process.hrtime.bigint() / BigInt(1e6));
  }

  private orderTopologically(nodes: any[], trace: any): any[] {
    // Basic Kahn’s algorithm over the subset of nodes provided
    if (!Array.isArray(nodes) || nodes.length === 0) return nodes;

    const within = new Set(nodes.map((n) => n.id));
    const idToNode = new Map<string, any>(trace.nodes.map((n: any) => [n.id, n]));

    const incoming = new Map<string, number>();
    for (const n of nodes) incoming.set(n.id, 0);

    for (const e of (trace.edges ?? [])) {
      if (within.has(e.source) && within.has(e.target)) {
        incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
      }
    }

    const adj = new Map<string, string[]>();
    for (const e of (trace.edges ?? [])) {
      if (within.has(e.source) && within.has(e.target)) {
        if (!adj.has(e.source)) adj.set(e.source, []);
        adj.get(e.source)!.push(e.target);
      }
    }

    const queue: any[] = nodes.filter((n) => (incoming.get(n.id) || 0) === 0);
    const out: any[] = [];

    while (queue.length) {
      const n = queue.shift()!;
      out.push(n);
      for (const nb of (adj.get(n.id) || [])) {
        incoming.set(nb, (incoming.get(nb) || 0) - 1);
        if ((incoming.get(nb) || 0) === 0) {
          const nbNode = idToNode.get(nb);
          if (nbNode) queue.push(nbNode);
        }
      }
    }

    return out.length ? out : nodes;
  }

  private syntheticLLMFromOriginal(node: any, modifications: ReplayModifications): string {
    const original = node.data?.response ?? node.response ?? "";
    const promptChanged = modifications.promptChanges?.has(node.id);
    const modelChanged  = modifications.modelChanges?.has(node.id);
    const tag = [promptChanged ? "prompt" : "", modelChanged ? "model" : ""].filter(Boolean).join("+");
    return tag ? `[simulated: ${tag} changed]\n${original}` : original;
  }

  private async replayToolNode(node: any, _mods: ReplayModifications, options: ReplayOptions): Promise<any> {
    if (options.mockExternalCalls) {
      const mock = this.mockManager.getMockResponse(node.id);
      if (mock) return mock;
    }
    return node.data?.response ?? node.response ?? null;
  }

  private replayGenericNode(node: any, _mods: ReplayModifications, _opts: ReplayOptions): any {
    return node.data?.response ?? node.response ?? null;
  }

  async executeReplay(
    startNodeId: string,
    trace: any,
    modifications: ReplayModifications,
    options: ReplayOptions
  ): Promise<ReplayResult> {
    try {
      // 1) Safety gate
      const safetyAnalysis = this.analyzeReplaySafety(startNodeId, trace);
      if (safetyAnalysis.mode === ReplayMode.BLOCKED) {
        return {
          success: false,
          executedNodes: [],
          skippedNodes: [],
          sideEffects: safetyAnalysis.sideEffects,
          totalCost: 0,
          totalLatency: 0,
          error: "Replay blocked due to critical side effects",
        };
      }

      // 2) Snapshot (for potential rollback/debug)
      const snapshot = this.stateSnapshotManager.captureSnapshot(startNodeId, trace);

      // 3) Determine nodes to run (topologically from start)
      const { nodes: nodesFromStart } = this.getNodesFromPoint(startNodeId, trace);
      const toRun = this.orderTopologically(nodesFromStart, trace);

      // 4) Setup mocks for external/tool calls if requested
      if (options.mockExternalCalls) {
        for (const node of toRun) {
          const effects = this.sideEffectDetector.detectSideEffects(node);
          this.mockManager.setupMocks(node, effects);
        }
      }

      const executedNodes: string[] = [];
      const skippedNodes: string[] = [];
      let totalCost = 0;
      let totalLatency = 0;

      const resolveSystemInstruction = (node: any) =>
        modifications.systemInstructionUpdates?.get(node.id) ?? node.system ?? "";
      const resolvePrompt = (node: any) =>
        modifications.promptChanges?.get(node.id) ?? node.prompt ?? node.input ?? "";
      const resolveModel = (node: any) =>
        modifications.modelChanges?.get(node.id) ?? node.model ?? "gpt-4o-mini";

      for (const node of toRun) {
        const t0 = this.now();
        const typeStr = String(node.type || "");
        const isLLM = typeStr.includes("llm");
        const isTool = typeStr.includes("tool");

        try {
          if (isLLM) {
            const sys = resolveSystemInstruction(node);
            const user = resolvePrompt(node);
            const model = resolveModel(node);

            if (options.liveMode && options.llm) {
              const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
                ...(sys ? [{ role: "system" as const, content: String(sys) }] : []),
                { role: "user" as const, content: String(user) },
              ];
              const text = await options.llm({
                model,
                messages,
                temperature: options.temperature ?? 0.7,
                maxTokens: options.maxTokens ?? 512,
              });
              node.simulatedOutput = text;
            } else {
              node.simulatedOutput = this.syntheticLLMFromOriginal(node, modifications);
            }
          } else if (isTool) {
            node.simulatedOutput = await this.replayToolNode(node, modifications, options);
          } else {
            node.simulatedOutput = this.replayGenericNode(node, modifications, options);
          }

          executedNodes.push(node.id);
        } catch (_err) {
          skippedNodes.push(node.id);
        } finally {
          const t1 = this.now();
          totalLatency += (t1 - t0);
        }
      }

      const result: ReplayResult = {
        success: true,
        executedNodes,
        skippedNodes,
        sideEffects: safetyAnalysis.sideEffects,
        totalCost,
        totalLatency,
        newTraceId: `replay-${Date.now()}`
      };

      return result;
    } catch (error) {
      return {
        success: false,
        executedNodes: [],
        skippedNodes: [],
        sideEffects: [],
        totalCost: 0,
        totalLatency: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // (Optional legacy helper you can remove if unused)
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
        const nodeEffects = sideEffects.filter(e => e.nodeId === node.id);
        const hasCriticalEffects = nodeEffects.some(e => e.severity === 'critical' && !e.reversible);

        if (hasCriticalEffects && !options.mockExternalCalls) {
          skippedNodes.push(node.id);
          continue;
        }

        // Legacy simulated path
        executedNodes.push(node.id);
        totalLatency += 0;
      } catch (_error) {
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

  cleanup(): void {
    this.mockManager.clearMocks();
  }
}
