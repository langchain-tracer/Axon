import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { LLMResult } from '@langchain/core/outputs';
import { Serialized } from '@langchain/core/load/serializable';
import { TraceConfig } from './types';

export declare class TracingCallbackHandler extends BaseCallbackHandler {
    name: string;
    private client;
    private traceId;
    private runDataMap;
    private config;
    constructor(config?: Partial<TraceConfig>);
    /**
     * Called when LLM starts running
     */
    handleLLMStart(llm: Serialized, prompts: string[], runId: string, parentRunId?: string, extraParams?: Record<string, any>, tags?: string[], metadata?: Record<string, any>): Promise<void>;
    /**
     * Called when LLM ends running
     */
    handleLLMEnd(output: LLMResult, runId: string): Promise<void>;
    /**
     * Called when tool starts running
     */
    handleToolStart(tool: Serialized, input: string, runId: string, parentRunId?: string, tags?: string[], metadata?: Record<string, any>): Promise<void>;
    /**
     * Called when tool ends running
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