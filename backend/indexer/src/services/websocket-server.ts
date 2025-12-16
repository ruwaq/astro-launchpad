/**
 * WebSocket Server for Real-time Updates
 *
 * Broadcasts blockchain events to connected clients:
 * - Token creation/updates
 * - Trade executions (buy/sell)
 * - Graduation events
 * - Price updates
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../lib/logger.js';

// Event types for WebSocket messages
export type WSEventType =
  | 'token:created'
  | 'token:updated'
  | 'trade:executed'
  | 'token:graduated'
  | 'price:updated'
  | 'stats:updated'
  | 'connection:established'
  | 'subscription:confirmed'
  | 'error';

export interface WSMessage {
  type: WSEventType;
  payload: unknown;
  timestamp: number;
}

export interface WSSubscription {
  tokens?: string[];      // Subscribe to specific token addresses
  events?: WSEventType[]; // Subscribe to specific event types
  all?: boolean;          // Subscribe to all events
}

interface ClientInfo {
  id: string;
  subscriptions: WSSubscription;
  connectedAt: number;
}

export class WebSocketBroadcaster {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private messageBuffer: WSMessage[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private isShuttingDown = false;

  /**
   * Initialize WebSocket server attached to HTTP server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });

    logger.info('WebSocket server initialized on /ws');
  }

  /**
   * Handle new client connection
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = this.generateClientId();

    this.clients.set(ws, {
      id: clientId,
      subscriptions: { all: true }, // Default: subscribe to all
      connectedAt: Date.now()
    });

    logger.info(`WebSocket client connected: ${clientId} (total: ${this.clients.size})`);

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connection:established',
      payload: {
        clientId,
        serverTime: Date.now(),
        recentEvents: this.messageBuffer.slice(-10)
      },
      timestamp: Date.now()
    });

    // Handle incoming messages (subscriptions)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(ws, message);
      } catch {
        this.sendToClient(ws, {
          type: 'error',
          payload: { message: 'Invalid message format' },
          timestamp: Date.now()
        });
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      const client = this.clients.get(ws);
      if (client) {
        logger.info(`WebSocket client disconnected: ${client.id} (total: ${this.clients.size - 1})`);
      }
      this.clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket client error:`, error);
      this.clients.delete(ws);
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    ws.on('close', () => clearInterval(heartbeat));
  }

  /**
   * Handle client subscription messages
   */
  private handleClientMessage(ws: WebSocket, message: { action: string; subscriptions?: WSSubscription }): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.action) {
      case 'subscribe':
        if (message.subscriptions) {
          client.subscriptions = {
            ...client.subscriptions,
            ...message.subscriptions
          };
          this.sendToClient(ws, {
            type: 'subscription:confirmed',
            payload: client.subscriptions,
            timestamp: Date.now()
          });
          logger.debug(`Client ${client.id} updated subscriptions:`, client.subscriptions);
        }
        break;

      case 'unsubscribe':
        client.subscriptions = { all: false };
        this.sendToClient(ws, {
          type: 'subscription:confirmed',
          payload: client.subscriptions,
          timestamp: Date.now()
        });
        break;

      case 'ping':
        this.sendToClient(ws, {
          type: 'connection:established',
          payload: { pong: true, serverTime: Date.now() },
          timestamp: Date.now()
        });
        break;

      default:
        logger.warn(`Unknown client action: ${message.action}`);
    }
  }

  /**
   * Broadcast event to all subscribed clients
   */
  broadcast(type: WSEventType, payload: unknown, tokenAddress?: string): void {
    if (this.isShuttingDown || !this.wss) return;

    const message: WSMessage = {
      type,
      payload,
      timestamp: Date.now()
    };

    // Add to buffer for new clients
    this.messageBuffer.push(message);
    if (this.messageBuffer.length > this.MAX_BUFFER_SIZE) {
      this.messageBuffer.shift();
    }

    let sentCount = 0;

    this.clients.forEach((client, ws) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      // Check if client is subscribed to this event
      if (this.shouldReceive(client.subscriptions, type, tokenAddress)) {
        this.sendToClient(ws, message);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      logger.debug(`Broadcast ${type} to ${sentCount} clients`);
    }
  }

  /**
   * Check if client should receive this event
   */
  private shouldReceive(subs: WSSubscription, type: WSEventType, tokenAddress?: string): boolean {
    // Subscribe to all
    if (subs.all) return true;

    // Subscribe to specific events
    if (subs.events?.includes(type)) return true;

    // Subscribe to specific tokens
    if (tokenAddress && subs.tokens?.includes(tokenAddress)) return true;

    return false;
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: WSMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.error('Failed to send WebSocket message:', error);
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get connection stats
   */
  getStats(): { totalConnections: number; uptime: number } {
    return {
      totalConnections: this.clients.size,
      uptime: process.uptime()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Notify all clients
    this.clients.forEach((_, ws) => {
      try {
        ws.close(1001, 'Server shutting down');
      } catch {
        // Ignore close errors
      }
    });

    this.clients.clear();

    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          logger.info('WebSocket server closed');
          resolve();
        });
      });
    }
  }

  // Convenience methods for common broadcasts
  broadcastTokenCreated(token: { address: string; name: string; symbol: string; creator: string }): void {
    this.broadcast('token:created', token, token.address);
  }

  broadcastTradeExecuted(trade: {
    tokenAddress: string;
    type: 'buy' | 'sell';
    amount: string;
    price: string;
    trader: string;
    txHash: string;
  }): void {
    this.broadcast('trade:executed', trade, trade.tokenAddress);
  }

  broadcastTokenGraduated(token: { address: string; name: string; finalPrice: string }): void {
    this.broadcast('token:graduated', token, token.address);
  }

  broadcastPriceUpdate(update: { tokenAddress: string; price: string; change24h: number }): void {
    this.broadcast('price:updated', update, update.tokenAddress);
  }

  broadcastStatsUpdate(stats: {
    totalTokens: number;
    totalVolume24h: string;
    totalTrades24h: number;
  }): void {
    this.broadcast('stats:updated', stats);
  }
}

// Singleton instance
export const wsBroadcaster = new WebSocketBroadcaster();
