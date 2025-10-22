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
   * Extract user-facing message from LLM prompts
   * Prompts often contain system messages, so we extract the actual user query
   */
  private extractUserMessage(prompts: string[]): string[] {
    if (!prompts || prompts.length === 0) return [];
    
    return prompts.map(prompt => {
      // Try to extract user message from chat format
      const userMatch = prompt.match(/Human: (.*?)(?:\nAI:|$)/s) || 
                       prompt.match(/User: (.*?)(?:\nAssistant:|$)/s) ||
                       prompt.match(/user:\s*(.*?)(?:\nassistant:|$)/si);
      
      if (userMatch && userMatch[1]) {
        return userMatch[1].trim();
      }
      
      // If no chat format, return the prompt as-is (might be the actual user input)
      return prompt;
    });
  }

  /**
   * Handle LLM start event
   */
  private async handleLLMStart(event: any): Promise<void> {
    await this.ensureTraceExists(event);

    // Debug logging
    logger.info("LLM Start Event Received:", {
      prompts: event.prompts,
      model: event.model,
      runId: event.runId,
      fullEvent: JSON.stringify(event, null, 2)
    });

    const userMessages = this.extractUserMessage(event.prompts || []);
    logger.info("Extracted User Messages:", userMessages);

    const partialNode: Partial<Node> = {
      id: uuidv4(),
      traceId: event.traceId,
      runId: event.runId,
      parentRunId: event.parentRunId,
      type: "llm",
      status: "running",
      startTime: event.timestamp,
      model: event.model, // Store model at top level
      data: {
        model: event.model,
        // Store both raw and user-facing prompts
        rawPrompts: event.prompts,
        // NORMALIZED: Store user-facing messages
        prompts: userMessages.length > 0 ? userMessages : (event.input ? [event.input] : event.prompts || []),
        invocationParams: event.invocationParams
      }
    };

    logger.info(`[DEBUG] Creating LLM node - model field value: "${partialNode.model}"`);
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

    // Get existing node data to merge with new data
    const existingNode = NodeModel.getByRunId(event.runId);
    const existingData = existingNode?.data || {};

    // Extract response from various possible fields
    let response = event.response || event.output || event.result;
    
    // If response is an object (LangChain generations format), extract text
    if (response && typeof response === 'object') {
      if (response.generations && Array.isArray(response.generations)) {
        // LangChain format: { generations: [[{ text: "..." }]] }
        response = response.generations[0]?.[0]?.text || JSON.stringify(response);
      } else if (response.text) {
        response = response.text;
      } else {
        response = JSON.stringify(response);
      }
    }

    NodeModel.update(event.runId, {
      status: "complete",
      endTime: event.timestamp,
      cost: event.cost,
      tokens: event.tokens,
      latency: event.latency,
      data: {
        ...existingData,
        // NORMALIZED: Always store as 'response' string (output)
        response: response,
        reasoning: event.reasoning || `LLM call completed with ${event.tokens?.total || 0} tokens`,
        agentActions: event.agentActions,
        generations: event.generations,
        llmOutput: event.llmOutput
      }
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

    // Normalize tool input to string format
    let inputStr = event.input;
    if (typeof inputStr === 'object') {
      inputStr = JSON.stringify(inputStr, null, 2);
    }

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
        // Store both original and normalized formats
        toolInput: event.input,
        // NORMALIZED: Store as 'prompts' for consistency (input)
        prompts: [`Tool: ${event.toolName}\nInput: ${inputStr}`]
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

    // Get existing node data to merge with new data
    const existingNode = NodeModel.getByRunId(event.runId);
    const existingData = existingNode?.data || {};

    // Normalize tool output to string format
    let outputStr = event.output || event.result;
    if (typeof outputStr === 'object') {
      outputStr = JSON.stringify(outputStr, null, 2);
    }

    NodeModel.update(event.runId, {
      status: "complete",
      endTime: event.timestamp,
      latency: event.latency,
      data: {
        ...existingData,
        // Store both original and normalized formats
        toolOutput: event.output || event.result,
        // NORMALIZED: Store as 'response' for consistency (output)
        response: outputStr,
        // Use actual reasoning from event, fall back to default message
        reasoning: event.reasoning || `Tool "${existingData.toolName || 'unknown'}" executed successfully`,
        agentActions: event.agentActions,
        error: event.error
      }
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

  /**
   * Extract user query from chain inputs
   * Chain inputs often contain the original user question
   */
  private extractUserQuery(inputs: any): string {
    if (!inputs) return "No input";
    
    // Common field names for user input
    if (typeof inputs === 'object') {
      const userQuery = inputs.question || inputs.input || inputs.query || 
                       inputs.text || inputs.prompt || inputs.message;
      if (userQuery) return String(userQuery);
      
      // If no standard field, return formatted object
      return JSON.stringify(inputs, null, 2);
    }
    
    return String(inputs);
  }

  private async handleChainStart(event: any): Promise<void> {
    await this.ensureTraceExists(event);

    // Debug logging
    logger.info("Chain Start Event Received:", {
      chainName: event.chainName,
      inputs: event.inputs,
      runId: event.runId
    });

    // Extract user-facing query from inputs
    const userQuery = this.extractUserQuery(event.inputs);
    logger.info("Extracted User Query:", userQuery);

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
        // Store both original and normalized formats
        inputs: event.inputs,
        // NORMALIZED: Store user-facing query as 'prompts' (this is what user asked)
        prompts: [userQuery]
      }
    };
    this.pendingNodes.set(event.runId, partialNode);
    NodeModel.create(partialNode as Node);
    if (event.parentRunId) {
      await this.createEdge(event.traceId, event.parentRunId, event.runId);
    }
    logger.debug("Chain start processed:", event.runId);
  }

  /**
   * Extract user-facing response from chain outputs
   * Chain outputs often contain the final answer to the user
   */
  private extractUserResponse(outputs: any): string {
    if (!outputs) return "No output";
    
    // Common field names for final response
    if (typeof outputs === 'object') {
      const userResponse = outputs.answer || outputs.output || outputs.result || 
                          outputs.response || outputs.text || outputs.message;
      if (userResponse) return String(userResponse);
      
      // If no standard field, return formatted object
      return JSON.stringify(outputs, null, 2);
    }
    
    return String(outputs);
  }

  private async handleChainEnd(event: any): Promise<void> {
    const partialNode = this.pendingNodes.get(event.runId);
    if (!partialNode) {
      logger.warn("No pending node for chain end:", event.runId);
      return;
    }

    // Get existing node data to merge with new data
    const existingNode = NodeModel.getByRunId(event.runId);
    const existingData = existingNode?.data || {};

    // Extract user-facing response from outputs
    const userResponse = this.extractUserResponse(event.outputs || event.output || event.result);

    NodeModel.update(event.runId, {
      status: "complete",
      endTime: event.timestamp,
      latency: event.latency,
      data: {
        ...existingData,
        // Store both original and normalized formats
        outputs: event.outputs || event.output || event.result,
        // NORMALIZED: Store user-facing response (this is what user sees)
        response: userResponse,
        // Use actual reasoning from event, fall back to default message
        reasoning: event.reasoning || `Chain "${existingData.chainName || 'unknown'}" completed successfully`,
        agentActions: event.agentActions
      }
    });
    await this.updateTraceStats(event.traceId);
    this.pendingNodes.delete(event.runId);
    logger.debug("Chain end processed:", event.runId);
  }

  private async handleError(event: any): Promise<void> {
    const partialNode = this.pendingNodes.get(event.runId);
    if (partialNode) {
      // Get existing node data to merge with new data
      const existingNode = NodeModel.getByRunId(event.runId);
      const existingData = existingNode?.data || {};

      NodeModel.update(event.runId, {
        status: "error",
        error: event.error,
        endTime: event.timestamp,
        data: {
          ...existingData,
          // NORMALIZED: Store error as 'response' for consistency (output)
          response: `ERROR: ${event.error}`,
          reasoning: `Error occurred: ${event.error}`,
          stackTrace: event.stackTrace || event.stack
        }
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

    // Normalize custom event data
    const eventData = event.data || {};
    let inputStr = eventData.input || eventData.prompts;
    let outputStr = eventData.output || eventData.response;

    if (typeof inputStr === 'object') {
      inputStr = JSON.stringify(inputStr, null, 2);
    }
    if (typeof outputStr === 'object') {
      outputStr = JSON.stringify(outputStr, null, 2);
    }

    const node: Partial<Node> = {
      id: uuidv4(),
      traceId: event.traceId,
      runId: event.runId,
      parentRunId: event.parentRunId,
      type: "custom",
      status: "complete",
      startTime: event.timestamp,
      endTime: event.timestamp,
      latency: 0,
      data: {
        ...eventData,
        metadata: event.metadata || {},
        // NORMALIZED: Ensure prompts and response exist
        prompts: eventData.prompts || (inputStr ? [inputStr] : ["Custom event"]),
        response: eventData.response || outputStr || "Custom event completed",
        reasoning: eventData.reasoning || "Custom event processed"
      }
    };

    await NodeModel.create(node as Node);
    logger.debug("Custom node created:", { nodeId: node.id, traceId: event.traceId });
  }
}
