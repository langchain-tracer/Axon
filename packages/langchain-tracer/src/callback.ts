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

export class TracingCallbackHandler extends BaseCallbackHandler {
  name = "agent_trace_handler";

  private client: TraceClient;
  private traceId: string;
  private runDataMap: Map<string, RunData> = new Map();
  private config: TraceConfig;

  constructor(config?: Partial<TraceConfig>) {
    super();

    this.config = {
      endpoint: config?.endpoint || "http://localhost:8000",
      projectName: config?.projectName || "default",
      debug: config?.debug || false,
      ...config
    };

    this.client = new TraceClient(this.config);
    this.traceId = uuidv4();

    if (this.config.debug) {
      console.log(`[AgentTrace] Started trace: ${this.traceId}`);
    }
  }

  /**
   * Called when LLM starts running
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
   * Called when LLM ends running
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
   * Called when tool starts running
   */
  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const serialized = EventSerializer.serializeSerialized(tool);
    const toolName = serialized.name;
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
   * Called when tool ends running
   */
  async handleToolEnd(output: string, runId: string): Promise<void> {
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
    const event: ToolEndEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      runId,
      parentRunId: runData.parentRunId,
      timestamp: endTime,
      type: "tool_end",
      toolName: runData.data.toolName,
      output,
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
