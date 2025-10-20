/**
 * LangChain callback handler for tracing agent execution
 */

import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { LLMResult } from "@langchain/core/outputs";
import { Serialized } from "@langchain/core/load/serializable";
import { v4 as uuidv4 } from "uuid";
import { TraceClient } from "./client";
import { EventSerializer } from "./serializer";
import {
  TraceConfig,
  RunData,
  LLMStartEvent,
  LLMEndEvent,
  ToolStartEvent,
  ToolEndEvent,
  ChainStartEvent,
  ChainEndEvent,
  ErrorEvent
} from "./types";

/**
 * LangChain callback handler for tracing agent execution
 * 
 * This class extends LangChain's BaseCallbackHandler to automatically capture
 * and send trace events to the Agent Trace Visualizer backend. It tracks:
 * - LLM start/end events with prompts and responses
 * - Tool execution with inputs and outputs
 * - Chain execution flow
 * - Error events and debugging information
 * 
 * The handler maintains a map of run data to correlate start/end events
 * and provides real-time tracing capabilities for LangChain applications.
 */
export class TracingCallbackHandler extends BaseCallbackHandler {
  name = "agent_trace_handler";

  private client: TraceClient;
  private traceId: string;
  private runDataMap: Map<string, RunData> = new Map();
  private config: TraceConfig;

  /**
   * Creates a new TracingCallbackHandler instance
   * 
   * @param config - Optional configuration object
   * @param config.endpoint - Backend server endpoint (default: "http://localhost:8000")
   * @param config.projectName - Project name for organizing traces (default: "default")
   * @param config.debug - Enable debug logging (default: false)
   * @param config.metadata - Additional metadata to include with all events
   */
  constructor(config?: Partial<TraceConfig>) {
    super();

    // First: Initialize config with defaults
    this.config = {
      endpoint: config?.endpoint || "http://localhost:8000",
      projectName: config?.projectName || "default",
      debug: config?.debug || false,
      ...config
    };

    // Then: Add projectName to metadata
    this.config.metadata = {
      projectName: this.config.projectName,
      ...this.config.metadata
    };

    this.client = new TraceClient(this.config);
    this.traceId = uuidv4();

    if (this.config.debug) {
      console.log(`[AgentTrace] Started trace: ${this.traceId}`);
    }
  }

  /**
   * Called when an LLM starts running
   * 
   * This method is automatically invoked by LangChain when an LLM begins processing.
   * It captures the LLM configuration, prompts, and metadata, then sends a start
   * event to the backend for visualization.
   * 
   * @param llm - Serialized LLM configuration object
   * @param prompts - Array of input prompts being sent to the LLM
   * @param runId - Unique identifier for this LLM run
   * @param parentRunId - Optional parent run ID for nested operations
   * @param extraParams - Additional parameters passed to the LLM
   * @param tags - Optional tags for categorizing the run
   * @param metadata - Optional metadata to include with the event
   */
  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, any>,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const serialized = EventSerializer.serializeSerialized(llm);
    const model = EventSerializer.extractModelName(llm);
    console.log(
      llm,
      prompts,
      runId,
      parentRunId,
      extraParams,
      "handleLLMStart parameters"
    );
    // Store run data
    this.runDataMap.set(runId, {
      runId,
      parentRunId,
      nodeType: "llm",
      startTime: Date.now(),
      status: "running",
      data: {
        model,
        prompts,
        serialized
      }
    });

    // Send event
    const event: LLMStartEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      runId,
      parentRunId,
      timestamp: Date.now(),
      type: "llm_start",
      model,
      prompts,
      invocationParams: extraParams,
      metadata: {
        ...this.config.metadata,
        ...metadata,
        tags
      }
    };
    console.log(event, "event\n\n\n\n\n\n\n");

    await this.client.sendEvent(event);
  }

  /**
   * Called when an LLM finishes running
   * 
   * This method is automatically invoked by LangChain when an LLM completes processing.
   * It captures the output, calculates execution time, and sends an end event to the
   * backend. It correlates with the corresponding start event using the runId.
   * 
   * @param output - LLMResult containing the generated responses and token usage
   * @param runId - Unique identifier matching the corresponding start event
   */
  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    console.log(runId, "runID");
    const runData = this.runDataMap.get(runId);
    if (!runData) {
      console.error(`[AgentTrace] No run data found for ${runId}`);
      return;
    }

    const endTime = Date.now();
    const latency = endTime - runData.startTime;

    // Serialize output
    const { response, tokens } = EventSerializer.serializeLLMResult(output);
    const cost = EventSerializer.calculateCost(runData.data.model, tokens);

    // Update run data
    runData.endTime = endTime;
    runData.status = "complete";

    // Send event
    const event: LLMEndEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData.parentRunId,
      timestamp: endTime,
      type: "llm_end",
      response,
      tokens,
      cost,
      latency
    };

    await this.client.sendEvent(event);
  }

  /**
   * Called when a tool starts running
   * 
   * This method is automatically invoked by LangChain when a tool begins execution.
   * It captures the tool configuration, input parameters, and metadata, then sends
   * a tool start event to the backend for visualization.
   * 
   * @param tool - Serialized tool configuration or tool name string
   * @param input - Input parameters passed to the tool
   * @param runId - Unique identifier for this tool run
   * @param parentRunId - Optional parent run ID for nested operations
   * @param tags - Optional tags for categorizing the run
   * @param metadata - Optional metadata to include with the event
   */
  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    // Handle both string tool names and serialized tool objects
    let toolName: string;
    if (typeof tool === 'string') {
      toolName = tool;
    } else {
      const serialized = EventSerializer.serializeSerialized(tool);
      toolName = serialized.name;
    }
    console.log("handleToolStart is running");
    // Store run data
    this.runDataMap.set(runId, {
      runId,
      parentRunId,
      nodeType: "tool",
      startTime: Date.now(),
      status: "running",
      data: {
        toolName,
        input
      }
    });

    // Send event
    const event: ToolStartEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      runId,
      parentRunId,
      timestamp: Date.now(),
      type: "tool_start",
      toolName,
      input: EventSerializer.serializeToolInput(input),
      metadata: {
        ...this.config.metadata,
        ...metadata,
        tags
      }
    };

    await this.client.sendEvent(event);
  }

  /**
   * Called when a tool finishes running
   * 
   * This method is automatically invoked by LangChain when a tool completes execution.
   * It captures the output, calculates execution time, and sends a tool end event to
   * the backend. It correlates with the corresponding start event using the runId.
   * 
   * @param output - The output result from the tool execution
   * @param runId - Unique identifier matching the corresponding start event
   */
  async handleToolEnd(output: string, runId: string): Promise<void> {
    const runData = this.runDataMap.get(runId);
    if (!runData) {
      console.error(`[AgentTrace] No run data found for ${runId}`);
      return;
    }

    const endTime = Date.now();
    const latency = endTime - runData.startTime;

    // Calculate tool cost (tools typically have minimal execution costs)
    const toolCost = EventSerializer.calculateToolCost(runData.data.toolName, latency);

    // Update run data
    runData.endTime = endTime;
    runData.status = "complete";

    // Send event
    const event: ToolEndEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData.parentRunId,
      timestamp: endTime,
      type: "tool_end",
      toolName: runData.data.toolName,
      output,
      cost: toolCost,
      latency
    };

    await this.client.sendEvent(event);
  }

  /**
   * Called when chain starts running
   */
  async handleChainStart(
    chain: Serialized,
    inputs: Record<string, any>,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const serialized = EventSerializer.serializeSerialized(chain);
    const chainName = serialized.name;
    console.log(" handleChainStart is running");
    // Store run data
    this.runDataMap.set(runId, {
      runId,
      parentRunId,
      nodeType: "chain",
      startTime: Date.now(),
      status: "running",
      data: {
        chainName,
        inputs
      }
    });

    // Send event
    const event: ChainStartEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      runId,
      parentRunId,
      timestamp: Date.now(),
      type: "chain_start",
      chainName,
      inputs,
      metadata: {
        ...this.config.metadata,
        ...metadata,
        tags
      }
    };

    await this.client.sendEvent(event);
  }

  /**
   * Called when chain ends running
   */
  async handleChainEnd(
    outputs: Record<string, any>,
    runId: string
  ): Promise<void> {
    const runData = this.runDataMap.get(runId);
    if (!runData) {
      console.error(`[AgentTrace] No run data found for ${runId}`);
      return;
    }

    const endTime = Date.now();
    const latency = endTime - runData.startTime;

    // Update run data
    runData.endTime = endTime;
    runData.status = "complete";

    // Send event
    const event: ChainEndEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData.parentRunId,
      timestamp: endTime,
      type: "chain_end",
      chainName: runData.data.chainName,
      outputs,
      latency
    };

    this.client.sendEvent(event);
  }

  /**
   * Called when an error occurs
   */
  async handleLLMError(error: Error, runId: string): Promise<void> {
    await this.handleError(error, runId);
  }

  async handleToolError(error: Error, runId: string): Promise<void> {
    await this.handleError(error, runId);
  }

  async handleChainError(error: Error, runId: string): Promise<void> {
    await this.handleError(error, runId);
  }

  private async handleError(error: Error, runId: string): Promise<void> {
    const runData = this.runDataMap.get(runId);

    if (runData) {
      runData.status = "error";
    }

    const { message, stack } = EventSerializer.serializeError(error);

    const event: ErrorEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData?.parentRunId,
      timestamp: Date.now(),
      type: "error",
      error: message,
      stack
    };

    await this.client.sendEvent(event);
  }

  /**
   * Get trace ID
   */
  public getTraceId(): string {
    return this.traceId;
  }

  /**
   * Check if connected to backend
   */
  public isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * Cleanup and disconnect
   */
  public async cleanup(): Promise<void> {
    this.client.disconnect();
    this.runDataMap.clear();
  }
}
