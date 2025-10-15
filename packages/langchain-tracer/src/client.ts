/**
 * WebSocket client for sending trace events to backend
 */

import { io, Socket } from "socket.io-client";
import { TraceConfig, TraceEvent } from "./types";

export class TraceClient {
  private socket: Socket | null = null;
  private config: TraceConfig;
  private connected: boolean = false;
  private eventQueue: TraceEvent[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<TraceConfig>) {
    this.config = {
      batchInterval: 100,
      batchSize: 50,
      debug: false,
      projectName: "default",
      endpoint: "http://localhost:8000",
      ...config
    } as TraceConfig;

    this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  private connect(): void {
    try {
      this.socket = io(this.config.endpoint, {
        auth: {
          apiKey: this.config.apiKey,
          projectName: this.config.projectName
        },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      });

      this.socket.on("connect", () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.log("✅ Connected to trace backend");

        // Flush queued events
        this.flushQueue();
      });

      this.socket.on("disconnect", () => {
        this.connected = false;
        this.log("⚠️  Disconnected from trace backend");
      });

      this.socket.on("connect_error", (error) => {
        this.reconnectAttempts++;
        this.log(`❌ Connection error: ${error.message}`);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.log(
            "⚠️  Max reconnection attempts reached. Events will be queued."
          );
        }
      });

      this.socket.on("error", (error) => {
        this.log(`❌ Socket error: ${error}`);
      });

      // Start batch timer
      this.startBatchTimer();
    } catch (error) {
      this.log(`❌ Failed to create socket: ${error}`);
    }
  }

  /**
   * Send event to backend
   */
  public async sendEvent(event: TraceEvent): Promise<void> {
    this.eventQueue.push(event);

    // Send immediately if batch size reached
    if (this.eventQueue.length >= this.config.batchSize!) {
      this.flushQueue();
    }

    // Return immediately - actual sending happens asynchronously
    return Promise.resolve();
  }

  /**
   * Start batch timer to flush events periodically
   */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flushQueue();
      }
    }, this.config.batchInterval);
  }

  /**
   * Flush queued events to server
   */
  private flushQueue(): void {
    console.log("flushQueue is running");
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (this.connected && this.socket) {
      this.socket.emit("trace_events", events);
      this.log(`📤 Sent ${events.length} events`);
    } else {
      // Re-queue if not connected
      this.eventQueue.unshift(...events);
      this.log(`⏳ Queued ${events.length} events (not connected)`);
    }
  }

  /**
   * Disconnect and cleanup
   */
  public disconnect(): void {
    // Flush remaining events
    this.flushQueue();

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connected = false;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[AgentTrace] ${message}`);
    }
  }
}
