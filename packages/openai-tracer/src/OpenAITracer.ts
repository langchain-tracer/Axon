/**
 * OpenAI Function Calling Tracer
 * Tracks OpenAI function calling agents with detailed event logging
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface OpenAIFunctionCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface OpenAITraceEvent {
  eventId: string;
  traceId: string;
  timestamp: number;
  type: 'function_call_start' | 'function_call_end' | 'tool_selection' | 'conversation_turn' | 'error';
  data: any;
  metadata?: Record<string, any>;
}

export interface OpenAITraceConfig {
  projectName?: string;
  endpoint?: string;
  metadata?: Record<string, any>;
  autoConnect?: boolean;
}

/**
 * OpenAI Function Calling Tracer
 * 
 * This class provides comprehensive tracing capabilities for OpenAI function calling agents.
 * It tracks function calls, tool selections, conversation turns, and errors, sending
 * real-time events to the Agent Trace Visualizer backend via WebSocket.
 * 
 * Features:
 * - Real-time event queuing and flushing
 * - WebSocket connection management
 * - Cost calculation for different OpenAI models
 * - Error tracking and reporting
 * - Automatic reconnection handling
 */
export class OpenAITracer extends EventEmitter {
  private traceId: string;
  private projectName: string;
  private endpoint: string;
  private metadata: Record<string, any>;
  private eventQueue: OpenAITraceEvent[] = [];
  private isConnected: boolean = false;
  private client: any = null;
  private flushInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new OpenAI tracer instance
   * 
   * @param config - Configuration object for the tracer
   * @param config.projectName - Project name for organizing traces (default: 'openai-agent')
   * @param config.endpoint - Backend server endpoint (default: 'http://localhost:3000')
   * @param config.metadata - Additional metadata to include with all events
   * @param config.autoConnect - Whether to automatically connect to the server (default: true)
   */
  constructor(config: OpenAITraceConfig = {}) {
    super();
    
    this.traceId = uuidv4();
    this.projectName = config.projectName || 'openai-agent';
    this.endpoint = config.endpoint || 'http://localhost:3000';
    this.metadata = config.metadata || {};
    
    if (config.autoConnect !== false) {
      this.connect();
    }
  }

  /**
   * Establishes WebSocket connection to the trace server
   * 
   * This method creates a Socket.IO client connection to the backend server,
   * sets up event listeners for connection status, and starts the periodic
   * event flushing mechanism.
   * 
   * @throws Error if connection fails
   */
  async connect(): Promise<void> {
    try {
      // Import socket.io-client dynamically for browser compatibility
      const { io } = await import('socket.io-client');
      
      this.client = io(this.endpoint, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.emit('connected');
        console.log(`[OpenAI Tracer] Connected to ${this.endpoint}`);
      });

      this.client.on('disconnect', () => {
        this.isConnected = false;
        this.emit('disconnected');
        console.log('[OpenAI Tracer] Disconnected from server');
      });

      this.client.on('connect_error', (error: any) => {
        console.error('[OpenAI Tracer] Connection error:', error);
        this.emit('error', error);
      });
      
      // Start periodic flush
      this.flushInterval = setInterval(() => {
        this.flushQueue();
      }, 1000);
      
    } catch (error) {
      console.error('[OpenAI Tracer] Connection failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * Disconnect from the trace server
   */
  disconnect(): void {
    this.isConnected = false;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.emit('disconnected');
  }

  /**
   * Records the start of a function call execution
   * 
   * This method creates and queues a function call start event, capturing
   * the function name, arguments, model, messages, and available tools.
   * It returns an event ID that can be used to correlate with the end event.
   * 
   * @param functionName - Name of the function being called
   * @param functionArguments - Arguments passed to the function
   * @param model - OpenAI model being used (e.g., 'gpt-4', 'gpt-3.5-turbo')
   * @param messages - Array of conversation messages
   * @param tools - Optional array of available tools
   * @returns Event ID for correlating with the corresponding end event
   */
  traceFunctionCallStart(
    functionName: string,
    functionArguments: any,
    model: string,
    messages: OpenAIMessage[],
    tools?: OpenAITool[]
  ): string {
    const eventId = uuidv4();
    const event: OpenAITraceEvent = {
      eventId,
      traceId: this.traceId,
      timestamp: Date.now(),
      type: 'function_call_start',
      data: {
        functionName,
        arguments: JSON.stringify(functionArguments),
        model,
        messageCount: messages.length,
        availableTools: tools?.map(t => t.function.name) || [],
        conversationContext: this.extractConversationContext(messages)
      },
      metadata: {
        ...this.metadata,
        projectName: this.projectName
      }
    };

    this.addEvent(event);
    return eventId;
  }

  /**
   * Track function call end
   */
  traceFunctionCallEnd(
    eventId: string,
    result: any,
    cost: number,
    latency: number,
    tokens?: { prompt: number; completion: number; total: number }
  ): void {
    const event: OpenAITraceEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      timestamp: Date.now(),
      type: 'function_call_end',
      data: {
        originalEventId: eventId,
        result: typeof result === 'string' ? result : JSON.stringify(result),
        cost,
        latency,
        tokens: tokens || { prompt: 0, completion: 0, total: 0 },
        success: true
      },
      metadata: {
        ...this.metadata,
        projectName: this.projectName
      }
    };

    this.addEvent(event);
  }

  /**
   * Track tool selection
   */
  traceToolSelection(
    availableTools: OpenAITool[],
    selectedTool: OpenAITool,
    reasoning?: string,
    confidence?: number
  ): void {
    const event: OpenAITraceEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      timestamp: Date.now(),
      type: 'tool_selection',
      data: {
        availableTools: availableTools.map(t => ({
          name: t.function.name,
          description: t.function.description
        })),
        selectedTool: {
          name: selectedTool.function.name,
          description: selectedTool.function.description
        },
        reasoning,
        confidence,
        selectionTime: Date.now()
      },
      metadata: {
        ...this.metadata,
        projectName: this.projectName
      }
    };

    this.addEvent(event);
  }

  /**
   * Track conversation turn
   */
  traceConversationTurn(
    userMessage: string,
    assistantResponse: string,
    model: string,
    tokens?: { prompt: number; completion: number; total: number },
    cost?: number
  ): void {
    const event: OpenAITraceEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      timestamp: Date.now(),
      type: 'conversation_turn',
      data: {
        userMessage,
        assistantResponse,
        model,
        tokens: tokens || { prompt: 0, completion: 0, total: 0 },
        cost: cost || 0,
        turnNumber: this.getTurnNumber()
      },
      metadata: {
        ...this.metadata,
        projectName: this.projectName
      }
    };

    this.addEvent(event);
  }

  /**
   * Track error
   */
  traceError(
    error: Error,
    context: string,
    functionName?: string,
    functionArguments?: any
  ): void {
    const event: OpenAITraceEvent = {
      eventId: uuidv4(),
      traceId: this.traceId,
      timestamp: Date.now(),
      type: 'error',
      data: {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context,
        functionName,
        arguments: functionArguments ? JSON.stringify(functionArguments) : undefined
      },
      metadata: {
        ...this.metadata,
        projectName: this.projectName
      }
    };

    this.addEvent(event);
  }

  /**
   * Add event to queue
   */
  private addEvent(event: OpenAITraceEvent): void {
    this.eventQueue.push(event);
    this.emit('event', event);
  }

  /**
   * Flush events to server
   */
  async flushQueue(): Promise<void> {
    if (this.eventQueue.length === 0 || !this.isConnected || !this.client) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      console.log(`[OpenAI Tracer] Flushing ${events.length} events`);
      
      // Send events to the backend server
      this.client.emit('openai_events', {
        traceId: this.traceId,
        projectName: this.projectName,
        events: events,
        metadata: this.metadata
      });
      
      this.emit('events_sent', events);
    } catch (error) {
      console.error('[OpenAI Tracer] Failed to flush events:', error);
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Extract conversation context from messages
   */
  private extractConversationContext(messages: OpenAIMessage[]): any {
    return {
      messageCount: messages.length,
      lastUserMessage: messages.filter(m => m.role === 'user').pop()?.content,
      hasSystemMessage: messages.some(m => m.role === 'system'),
      hasToolCalls: messages.some(m => m.tool_calls && m.tool_calls.length > 0)
    };
  }

  /**
   * Get current turn number
   */
  private getTurnNumber(): number {
    return this.eventQueue.filter(e => e.type === 'conversation_turn').length + 1;
  }

  /**
   * Calculate cost based on tokens and model
   */
  calculateCost(tokens: { prompt: number; completion: number; total: number }, model: string): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 },
      'gpt-3.5-turbo-16k': { prompt: 0.003, completion: 0.004 }
    };

    const prices = pricing[model] || pricing['gpt-3.5-turbo'];
    return (tokens.prompt * prices.prompt + tokens.completion * prices.completion) / 1000;
  }

  /**
   * Get trace ID
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * Check if connected
   */
  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  /**
   * Get current event queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Shutdown tracer
   */
  async shutdown(): Promise<void> {
    await this.flushQueue();
    this.disconnect();
  }
}

/**
 * Create a new OpenAI tracer instance
 */
export function createOpenAITracer(config?: OpenAITraceConfig): OpenAITracer {
  return new OpenAITracer(config);
}

/**
 * OpenAI Function Calling Wrapper
 * Wraps OpenAI API calls with automatic tracing
 */
export class TracedOpenAI {
  private openai: any;
  private tracer: OpenAITracer;

  constructor(openaiClient: any, tracer: OpenAITracer) {
    this.openai = openaiClient;
    this.tracer = tracer;
  }

  /**
   * Traced chat completion with function calling
   */
  async createChatCompletion(
    params: {
      model: string;
      messages: OpenAIMessage[];
      tools?: OpenAITool[];
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
      temperature?: number;
      max_tokens?: number;
    }
  ): Promise<any> {
    const startTime = Date.now();
    const eventId = this.tracer.traceFunctionCallStart(
      'createChatCompletion',
      params,
      params.model,
      params.messages,
      params.tools
    );

    try {
      const response = await this.openai.chat.completions.create(params);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Extract token usage
      const tokens = response.usage ? {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens
      } : { prompt: 0, completion: 0, total: 0 };

      // Calculate cost
      const cost = this.tracer.calculateCost(tokens, params.model);

      // Trace the completion
      this.tracer.traceFunctionCallEnd(eventId, response, cost, latency, tokens);

      // Trace tool selection if tools were used
      if (response.choices[0]?.message?.tool_calls) {
        const selectedTool = params.tools?.find(t => 
          t.function.name === response.choices[0].message.tool_calls[0].function.name
        );
        if (selectedTool) {
          this.tracer.traceToolSelection(
            params.tools || [],
            selectedTool,
            'Model selected tool based on user request',
            0.9 // High confidence for model selection
          );
        }
      }

      // Trace conversation turn
      const userMessage = params.messages.filter(m => m.role === 'user').pop()?.content || '';
      const assistantResponse = response.choices[0]?.message?.content || '';
      
      if (userMessage && assistantResponse) {
        this.tracer.traceConversationTurn(
          userMessage,
          assistantResponse,
          params.model,
          tokens,
          cost
        );
      }

      return response;
    } catch (error) {
      this.tracer.traceError(
        error as Error,
        'createChatCompletion',
        'createChatCompletion',
        params
      );
      throw error;
    }
  }
}

export default OpenAITracer;
