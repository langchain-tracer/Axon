/**
 * Process trace events and construct decision graph (DAG)
 * SQLite version
 */

import { v4 as uuidv4 } from "uuid";
import { TraceModel, NodeModel, EdgeModel } from "../database/models.js";
import { TraceEvent, Node } from "../types/index.js";
import { logger } from "../utils/logger.js";

/**
 * Trace Processor for handling and storing trace events
 * 
 * This class processes incoming trace events from various sources (LangChain, OpenAI, etc.)
 * and stores them in the SQLite database. It maintains the relationship between start/end
 * events and constructs the trace graph for visualization.
 * 
 * Features:
 * - Event correlation and validation
 * - Database storage with proper relationships
 * - Trace statistics calculation
 * - Error handling and logging
 */
export class TraceProcessor {
  private activeTraces: Map<string, string> = new Map();
  private pendingNodes: Map<string, Partial<Node>> = new Map();

  /**
   * Processes incoming trace events and routes them to appropriate handlers
   * 
   * This is the main entry point for all trace events. It validates the event
   * type and delegates to the appropriate handler method.
   * 
   * @param event - The trace event to process
   * @throws Error if event processing fails
   */
  async processEvent(event: TraceEvent): Promise<void> {
    try {
      switch (event.type) {
        case "llm_start":
          await this.handleLLMStart(event as any);
          break;
        case "llm_end":
          await this.handleLLMEnd(event as any);
          break;
        case "tool_start":
          await this.handleToolStart(event as any);
          break;
        case "tool_end":
          await this.handleToolEnd(event as any);
          break;
        case "chain_start": // NEW
          await this.handleChainStart(event as any);
          break;
        case "chain_end": // NEW
          await this.handleChainEnd(event as any);
          break;
        case "error": // NEW
          await this.handleError(event);
          break;
        case "custom": // OpenAI custom events
          await this.handleCustomEvent(event);
          break;
        default:
          logger.debug("Unhandled event type:", event.type);
      }
    } catch (error) {
      logger.error("Error processing event:", { event, error });
      throw error;
    }
  }

  /**
   * Handle LLM start event
   */
  private async handleLLMStart(event: any): Promise<void> {
    await this.ensureTraceExists(event);

    const partialNode: Partial<Node> = {
      id: uuidv4(),
      traceId: event.traceId,
      runId: event.runId,
      parentRunId: event.parentRunId,
      type: "llm",
      status: "running",
      startTime: event.timestamp,
      data: {
        model: event.model,
        prompts: event.prompts,
        invocationParams: event.invocationParams
      }
    };

    this.pendingNodes.set(event.runId, partialNode);
    NodeModel.create(partialNode as Node);

    if (event.parentRunId) {
      await this.createEdge(event.traceId, event.parentRunId, event.runId);
    }

    logger.debug("LLM start processed:", event.runId);
  }

  /**
   * Handle LLM end event
   */
  private async handleLLMEnd(event: any): Promise<void> {
    const partialNode = this.pendingNodes.get(event.runId);

    if (!partialNode) {
      logger.warn("No pending node for LLM end:", event.runId);
      return;
    }

    NodeModel.update(event.runId, {
      status: "complete",
      endTime: event.timestamp,
      cost: event.cost,
      tokens: event.tokens,
      latency: event.latency
    });

    await this.updateTraceStats(event.traceId);
    this.pendingNodes.delete(event.runId);

    logger.debug("LLM end processed:", event.runId);
  }

  /**
   * Handle tool start event
   */
  private async handleToolStart(event: any): Promise<void> {
    await this.ensureTraceExists(event);

    const partialNode: Partial<Node> = {
      id: uuidv4(),
      traceId: event.traceId,
      runId: event.runId,
      parentRunId: event.parentRunId,
      type: "tool",
      status: "running",
      startTime: event.timestamp,
      data: {
        toolName: event.toolName,
        input: event.input
      }
    };

    this.pendingNodes.set(event.runId, partialNode);
    NodeModel.create(partialNode as Node);

    if (event.parentRunId) {
      await this.createEdge(event.traceId, event.parentRunId, event.runId);
    }

    logger.debug("Tool start processed:", event.runId);
  }

  /**
   * Handle tool end event
   */
  private async handleToolEnd(event: any): Promise<void> {
    const partialNode = this.pendingNodes.get(event.runId);

    if (!partialNode) {
      logger.warn("No pending node for tool end:", event.runId);
      return;
    }

    NodeModel.update(event.runId, {
      status: "complete",
      endTime: event.timestamp,
      latency: event.latency
    });

    await this.updateTraceStats(event.traceId);
    this.pendingNodes.delete(event.runId);

    logger.debug("Tool end processed:", event.runId);
  }

  /**
   * Ensure trace exists in database
   */
  private async ensureTraceExists(event: TraceEvent): Promise<void> {
    if (this.activeTraces.has(event.traceId)) {
      return;
    }

    const existing = TraceModel.findById(event.traceId);

    if (!existing) {
      TraceModel.create({
        id: event.traceId,
        projectName: event.metadata?.projectName || "default",
        startTime: event.timestamp,
        metadata: event.metadata
      });

      logger.info("New trace created:", event.traceId);
    }

    this.activeTraces.set(
      event.traceId,
      event.metadata?.projectName || "default"
    );
  }

  /**
   * Create edge between nodes
   */
  private async createEdge(
    traceId: string,
    fromNodeRunId: string,
    toNodeRunId: string
  ): Promise<void> {
    try {
      EdgeModel.create({
        id: uuidv4(),
        traceId,
        fromNode: fromNodeRunId,
        toNode: toNodeRunId
      });
    } catch (error) {
      logger.warn("Failed to create edge:", {
        fromNodeRunId,
        toNodeRunId,
        error
      });
    }
  }

  /**
   * Update trace statistics
   */
  private async updateTraceStats(traceId: string): Promise<void> {
    const nodes = NodeModel.findByTraceId(traceId);

    const totalCost = nodes.reduce((sum, node) => sum + (node.cost || 0), 0);
    const totalNodes = nodes.length;

    const allComplete = nodes.every(
      (node) => node.status === "complete" || node.status === "error"
    );

    TraceModel.update(traceId, {
      totalCost,
      totalNodes,
      status: allComplete ? "complete" : "running",
      endTime: allComplete ? Date.now() : undefined
    });
  }

  /**
   * Get trace with nodes and edges
   */
  async getTraceGraph(traceId: string): Promise<{
    trace: any;
    nodes: Node[];
    edges: any[];
  }> {
    const trace = TraceModel.findById(traceId);
    const nodes = NodeModel.findByTraceId(traceId);
    const edges = EdgeModel.findByTraceId(traceId);

    return { trace, nodes, edges };
  }

  private async handleChainStart(event: any): Promise<void> {
    await this.ensureTraceExists(event);
    const partialNode: Partial<Node> = {
      id: uuidv4(),
      traceId: event.traceId,
      runId: event.runId,
      parentRunId: event.parentRunId,
      type: "chain",
      status: "running",
      startTime: event.timestamp,
      data: {
        chainName: event.chainName,
        inputs: event.inputs
      }
    };
    this.pendingNodes.set(event.runId, partialNode);
    NodeModel.create(partialNode as Node);
    if (event.parentRunId) {
      await this.createEdge(event.traceId, event.parentRunId, event.runId);
    }
    logger.debug("Chain start processed:", event.runId);
  }

  private async handleChainEnd(event: any): Promise<void> {
    const partialNode = this.pendingNodes.get(event.runId);
    if (!partialNode) {
      logger.warn("No pending node for chain end:", event.runId);
      return;
    }
    NodeModel.update(event.runId, {
      status: "complete",
      endTime: event.timestamp,
      latency: event.latency
    });
    await this.updateTraceStats(event.traceId);
    this.pendingNodes.delete(event.runId);
    logger.debug("Chain end processed:", event.runId);
  }

  private async handleError(event: any): Promise<void> {
    const partialNode = this.pendingNodes.get(event.runId);
    if (partialNode) {
      NodeModel.update(event.runId, {
        status: "error",
        error: event.error,
        endTime: event.timestamp
      });
      await this.updateTraceStats(event.traceId);
      this.pendingNodes.delete(event.runId);
    }
    logger.error("Error event processed:", {
      runId: event.runId,
      error: event.error
    });
  }

  private async handleCustomEvent(event: any): Promise<void> {
    await this.ensureTraceExists(event);

    const node: Node = {
      id: uuidv4(),
      traceId: event.traceId,
      runId: event.runId,
      parentRunId: event.parentRunId,
      type: "custom",
      status: "complete",
      startTime: event.timestamp,
      endTime: event.timestamp,
      latency: 0,
      data: event.data,
      metadata: event.metadata || {}
    };

    await NodeModel.create(node);
    logger.debug("Custom node created:", { nodeId: node.id, traceId: event.traceId });
  }
}
