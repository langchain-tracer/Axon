/**
 * WebSocket event handler
 */

import { Server, Socket } from "socket.io";
import { TraceProcessor } from "../services/trace-processor.js";
import { AnomalyDetector } from "../services/anomaly-detector.js";
import { NodeModel } from "../database/models.js";
import { TraceEvent } from "../types/index";
import { logger } from "../utils/logger.js";

export class SocketHandler {
  private io: Server;
  private traceProcessor: TraceProcessor;
  private anomalyDetector: AnomalyDetector;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.traceProcessor = new TraceProcessor();
    this.anomalyDetector = new AnomalyDetector();
    this.setupHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: Socket): void {
    const clientId = socket.id;
    this.connectedClients.set(clientId, socket);

    logger.info("Client connected:", {
      clientId,
      totalClients: this.connectedClients.size
    });

    // Handle trace events from agent
    socket.on("trace_events", async (events: TraceEvent[]) => {
      await this.handleTraceEvents(socket, events);
    });

    // Handle client subscription
    socket.on("subscribe_trace", (traceId: string) => {
      socket.join(`trace:${traceId}`);
      logger.debug("Client subscribed to trace:", { clientId, traceId });
    });

    // Handle client unsubscription
    socket.on("unsubscribe_trace", (traceId: string) => {
      socket.leave(`trace:${traceId}`);
      logger.debug("Client unsubscribed from trace:", { clientId, traceId });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      this.connectedClients.delete(clientId);
      logger.info("Client disconnected:", {
        clientId,
        totalClients: this.connectedClients.size
      });
    });

    // Handle errors
    socket.on("error", (error) => {
      logger.error("Socket error:", { clientId, error });
    });
  }

  /**
   * Handle batch of trace events
   */
  private async handleTraceEvents(
    socket: Socket,
    events: TraceEvent[]
  ): Promise<void> {
    try {
      logger.debug("Received trace events:", {
        clientId: socket.id,
        count: events.length
      });

      for (const event of events) {
        await this.traceProcessor.processEvent(event);

        // Broadcast to dashboard clients
        this.io.to(`trace:${event.traceId}`).emit("trace_update", {
          traceId: event.traceId,
          event
        });

        // Check for anomalies on completion
        if (event.type === "llm_end" || event.type === "tool_end") {
          const node = NodeModel.findByRunId(event.runId);
          if (node) {
            const anomalies = await this.anomalyDetector.checkNode(
              event.traceId,
              node
            );

            if (anomalies.length > 0) {
              this.io.to(`trace:${event.traceId}`).emit("anomaly_detected", {
                traceId: event.traceId,
                anomalies
              });
            }
          }
        }
      }

      // Send acknowledgment
      socket.emit("trace_events_ack", {
        received: events.length,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error("Error handling trace events:", { error });
      socket.emit("trace_events_error", {
        error: "Failed to process events"
      });
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }
}
