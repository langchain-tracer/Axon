import { LLMResult } from '@langchain/core/outputs';
import { Serialized } from '@langchain/core/load/serializable';

export declare class EventSerializer {
    /**
     * Serialize LLM result
     */
    static serializeLLMResult(result: LLMResult): {
        response: string;
        tokens: {
            prompt: number;
            completion: number;
            total: number;
        };
    };
    /**
     * Serialize serialized object (model info, etc)
     */
    static serializeSerialized(serialized: Serialized): {
        type: string;
        name: string;
        params: Record<string, any>;
    };
    /**
     * Serialize tool input (can be string or object)
     */
    static serializeToolInput(input: string | Record<string, any>): string | Record<string, any>;
    /**
     * Calculate cost based on tokens and model
     */
    static calculateCost(model: string, tokens: {
        prompt: number;
        completion: number;
        total: number;
    }): number;
    /**
     * Extract model name from serialized data
     */
    static extractModelName(serialized: Serialized): string;
    /**
     * Safely stringify error
     */
    static serializeError(error: Error): {
        message: string;
        stack?: string;
    };
}
//# sourceMappingURL=serializer.d.ts.map