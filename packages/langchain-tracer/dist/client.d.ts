import { TraceConfig, TraceEvent } from './types';

export declare class TraceClient {
    private socket;
    private config;
    private connected;
    private eventQueue;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private batchTimer;
    constructor(config: Partial<TraceConfig>);
    /**
     * Connect to WebSocket server
     */
    private connect;
    /**
     * Send event to backend
     */
    sendEvent(event: TraceEvent): Promise<void>;
    /**
     * Start batch timer to flush events periodically
     */
    private startBatchTimer;
    /**
     * Flush queued events to server
     */
    private flushQueue;
    /**
     * Disconnect and cleanup
     */
    disconnect(): void;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get queue size
     */
    getQueueSize(): number;
    /**
     * Debug logging
     */
    private log;
}
//# sourceMappingURL=client.d.ts.map