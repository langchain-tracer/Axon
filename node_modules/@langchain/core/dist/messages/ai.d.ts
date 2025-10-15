import { BaseMessage, BaseMessageChunk, type MessageType, BaseMessageFields } from "./base.js";
import { InvalidToolCall, ToolCall, ToolCallChunk } from "./tool.js";
export type AIMessageFields = BaseMessageFields & {
    tool_calls?: ToolCall[];
    invalid_tool_calls?: InvalidToolCall[];
    usage_metadata?: UsageMetadata;
};
/**
 * Usage metadata for a message, such as token counts.
 */
export type UsageMetadata = {
    /**
     * The count of input (or prompt) tokens.
     */
    input_tokens: number;
    /**
     * The count of output (or completion) tokens
     */
    output_tokens: number;
    /**
     * The total token count
     */
    total_tokens: number;
};
/**
 * Represents an AI message in a conversation.
 */
export declare class AIMessage extends BaseMessage {
    tool_calls?: ToolCall[];
    invalid_tool_calls?: InvalidToolCall[];
    /**
     * If provided, token usage information associated with the message.
     */
    usage_metadata?: UsageMetadata;
    get lc_aliases(): Record<string, string>;
    constructor(fields: string | AIMessageFields, 
    /** @deprecated */
    kwargs?: Record<string, unknown>);
    static lc_name(): string;
    _getType(): MessageType;
    get _printableFields(): Record<string, unknown>;
}
export declare function isAIMessage(x: BaseMessage): x is AIMessage;
export declare function isAIMessageChunk(x: BaseMessageChunk): x is AIMessageChunk;
export type AIMessageChunkFields = AIMessageFields & {
    tool_call_chunks?: ToolCallChunk[];
};
/**
 * Represents a chunk of an AI message, which can be concatenated with
 * other AI message chunks.
 */
export declare class AIMessageChunk extends BaseMessageChunk {
    tool_calls?: ToolCall[];
    invalid_tool_calls?: InvalidToolCall[];
    tool_call_chunks?: ToolCallChunk[];
    /**
     * If provided, token usage information associated with the message.
     */
    usage_metadata?: UsageMetadata;
    constructor(fields: string | AIMessageChunkFields);
    get lc_aliases(): Record<string, string>;
    static lc_name(): string;
    _getType(): MessageType;
    get _printableFields(): Record<string, unknown>;
    concat(chunk: AIMessageChunk): AIMessageChunk;
}
