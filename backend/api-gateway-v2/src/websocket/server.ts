/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { createServer } from 'http';
import { createRequire } from 'module';
import { logger } from '../lib/logger.js';

// Use CommonJS require for ws module (better type compatibility)
const require = createRequire(import.meta.url);
const ws = require('ws');
const WebSocketServer = ws.WebSocketServer || ws.Server;
const OPEN_STATE = ws.OPEN || 1;

interface Client {
  ws: any; // WebSocket instance
  subscriptions: Set<string>;
  lastPing: number;
}

interface TokenUpdate {
  tokenAddress?: string;
  [key: string]: unknown;
}

class WebSocketManager {
  private wss: any; // WebSocketServer instance
  private clients: Map<string, Client> = new Map();
  private tokenSubscribers: Map<string, Set<string>> = new Map();

  constructor(server: ReturnType<typeof createServer>) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupHandlers();
    this.startHeartbeat();
  }

  private setupHandlers() {
    this.wss.on('connection', (wsClient: any, req: any) => {
      const clientId = crypto.randomUUID();
      this.clients.set(clientId, {
        ws: wsClient,
        subscriptions: new Set(),
        lastPing: Date.now(),
      });

      logger.info({ clientId, ip: req.socket.remoteAddress }, 'WebSocket client connected');

      wsClient.on('message', (data: any) => this.handleMessage(clientId, data.toString()));
      wsClient.on('close', () => this.handleDisconnect(clientId));
      wsClient.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) client.lastPing = Date.now();
      });

      wsClient.send(JSON.stringify({ type: 'connected', clientId }));
    });
  }

  private handleMessage(clientId: string, message: string) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);
      if (!client) return;

      switch (data.type) {
        case 'subscribe':
          this.subscribe(clientId, data.channel);
          break;
        case 'unsubscribe':
          this.unsubscribe(clientId, data.channel);
          break;
        default:
          logger.warn({ type: data.type, clientId }, 'Unknown message type');
      }
    } catch (error) {
      logger.error({ error, clientId }, 'WebSocket message error');
    }
  }

  private subscribe(clientId: string, channel: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(channel);

    if (!this.tokenSubscribers.has(channel)) {
      this.tokenSubscribers.set(channel, new Set());
    }
    this.tokenSubscribers.get(channel)!.add(clientId);

    logger.debug({ clientId, channel }, 'Client subscribed to channel');
    client.ws.send(JSON.stringify({ type: 'subscribed', channel }));
  }

  private unsubscribe(clientId: string, channel: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);
    this.tokenSubscribers.get(channel)?.delete(clientId);

    logger.debug({ clientId, channel }, 'Client unsubscribed from channel');
    client.ws.send(JSON.stringify({ type: 'unsubscribed', channel }));
  }

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.forEach((channel) => {
      this.tokenSubscribers.get(channel)?.delete(clientId);
    });
    this.clients.delete(clientId);

    logger.info({ clientId }, 'WebSocket client disconnected');
  }

  broadcast(channel: string, data: unknown) {
    const subscribers = this.tokenSubscribers.get(channel);
    if (!subscribers) return;

    const message = JSON.stringify({ channel, data, timestamp: Date.now() });
    let sentCount = 0;

    subscribers.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client?.ws.readyState === OPEN_STATE) {
        try {
          client.ws.send(message);
          sentCount++;
        } catch (error) {
          logger.error({ error, clientId }, 'Failed to send message to client');
        }
      }
    });

    logger.debug({ channel, subscribers: sentCount }, 'Broadcast sent');
  }

  broadcastTokenUpdate(tokenAddress: string, update: TokenUpdate) {
    this.broadcast(`token:${tokenAddress}`, update);
    this.broadcast('tokens:all', { tokenAddress, ...update });
  }

  broadcastTrade(tokenAddress: string, trade: TokenUpdate) {
    this.broadcast(`trades:${tokenAddress}`, trade);
    this.broadcast('trades:all', { tokenAddress, ...trade });
  }

  broadcastPriceUpdate(tokenAddress: string, price: unknown) {
    this.broadcast(`price:${tokenAddress}`, price);
  }

  private startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      this.clients.forEach((client, clientId) => {
        if (now - client.lastPing > 60000) {
          logger.warn({ clientId }, 'Client ping timeout, terminating');
          client.ws.terminate();
          this.handleDisconnect(clientId);
        } else if (client.ws.readyState === OPEN_STATE) {
          client.ws.ping();
        }
      });
    }, 30000);
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      totalChannels: this.tokenSubscribers.size,
      channels: Array.from(this.tokenSubscribers.entries()).map(([channel, subscribers]) => ({
        channel,
        subscribers: subscribers.size,
      })),
    };
  }
}

export let wsManager: WebSocketManager;

export function initWebSocket(server: ReturnType<typeof createServer>) {
  wsManager = new WebSocketManager(server);
  logger.info('WebSocket server initialized');
  return wsManager;
}
