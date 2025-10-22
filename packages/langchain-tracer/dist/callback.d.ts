import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { LLMResult } from '@langchain/core/outputs';
import { Serialized } from '@langchain/core/load/serializable';
import { TraceConfig } from './types';

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
export declare class TracingCallbackHandler extends BaseCallbackHandler {
    name: string;
    private client;
    private traceId;
    private runDataMap;
    private config;
    /**
     * Creates a new TracingCallbackHandler instance
     *
     * @param config - Optional configuration object
     * @param config.endpoint - Backend server endpoint (default: "http://localhost:8000")
     * @param config.projectName - Project name for organizing traces (default: "default")
     * @param config.debug - Enable debug logging (default: false)
     * @param config.metadata - Additional metadata to include with all events
     */
    constructor(config?: Partial<TraceConfig>);
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
    handleLLMStart(llm: Serialized, prompts: string[], runId: string, parentRunId?: string, extraParams?: Record<string, any>, tags?: string[], metadata?: Record<string, any>): Promise<void>;
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
    handleLLMEnd(output: LLMResult, runId: string): Promise<void>;
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
    handleToolStart(tool: Serialized, input: string, runId: string, parentRunId?: string, tags?: string[], metadata?: Record<string, any>): Promise<void>;
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
    handleToolEnd(output: string, runId: string): Promise<void>;
    /**
     * Called when chain starts running
     */
    handleChainStart(chain: Serialized, inputs: Record<string, any>, runId: string, parentRunId?: string, tags?: string[], metadata?: Record<string, any>): Promise<void>;
    /**
     * Called when chain ends running
     */
    handleChainEnd(outputs: Record<string, any>, runId: string): Promise<void>;
    /**
     * Called when an error occurs
     */
    handleLLMError(error: Error, runId: string): Promise<void>;
    handleToolError(error: Error, runId: string): Promise<void>;
    handleChainError(error: Error, runId: string): Promise<void>;
    private handleError;
    /**
     * Called when text is emitted during execution
     *
     * This captures LLM thinking, agent reasoning, and intermediate text outputs
     */
    handleText(text: string, runId: string): Promise<void>;
    /**
     * Called when an agent takes an action
     *
     * This captures the agent's decision-making process, including:
     * - What tool the agent chose to use
     * - Why the agent made that choice
     * - The reasoning behind the decision
     */
    handleAgentAction(action: any, runId: string): Promise<void>;
    /**
     * Called when an agent completes execution
     */
    handleAgentEnd(output: any, runId: string): Promise<void>;
    /**
     * Called when a retriever starts (for RAG systems)
     */
    handleRetrieverStart(retriever: Serialized, query: string, runId: string, parentRunId?: string, tags?: string[], metadata?: Record<string, any>): Promise<void>;
    /**
     * Called when a retriever completes
     */
    handleRetrieverEnd(documents: any[], runId: string): Promise<void>;
    /**
     * Get trace ID
     */
    getTraceId(): string;
    /**
     * Check if connected to backend
     */
    isConnected(): boolean;
    /**
     * Cleanup and disconnect
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=callback.d.ts.map