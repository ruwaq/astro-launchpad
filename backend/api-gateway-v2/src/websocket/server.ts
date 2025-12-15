import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { logger } from '../lib/logger';

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private tokenSubscribers: Map<string, Set<string>> = new Map();

  constructor(server: ReturnType<typeof createServer>) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupHandlers();
    this.startHeartbeat();
  }

  private setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientId = crypto.randomUUID();
      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        lastPing: Date.now(),
      });

      logger.info('WebSocket client connected', { clientId, ip: req.socket.remoteAddress });

      ws.on('message', (data) => this.handleMessage(clientId, data.toString()));
      ws.on('close', () => this.handleDisconnect(clientId));
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) client.lastPing = Date.now();
      });

      ws.send(JSON.stringify({ type: 'connected', clientId }));
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
          logger.warn('Unknown message type', { type: data.type, clientId });
      }
    } catch (error) {
      logger.error('WebSocket message error', { error, clientId });
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

    logger.debug('Client subscribed to channel', { clientId, channel });
    client.ws.send(JSON.stringify({ type: 'subscribed', channel }));
  }

  private unsubscribe(clientId: string, channel: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);
    this.tokenSubscribers.get(channel)?.delete(clientId);

    logger.debug('Client unsubscribed from channel', { clientId, channel });
    client.ws.send(JSON.stringify({ type: 'unsubscribed', channel }));
  }

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.forEach((channel) => {
      this.tokenSubscribers.get(channel)?.delete(clientId);
    });
    this.clients.delete(clientId);

    logger.info('WebSocket client disconnected', { clientId });
  }

  broadcast(channel: string, data: unknown) {
    const subscribers = this.tokenSubscribers.get(channel);
    if (!subscribers) return;

    const message = JSON.stringify({ channel, data, timestamp: Date.now() });
    let sentCount = 0;

    subscribers.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client?.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          sentCount++;
        } catch (error) {
          logger.error('Failed to send message to client', { error, clientId });
        }
      }
    });

    logger.debug('Broadcast sent', { channel, subscribers: sentCount });
  }

  broadcastTokenUpdate(tokenAddress: string, update: unknown) {
    this.broadcast(`token:${tokenAddress}`, update);
    this.broadcast('tokens:all', { tokenAddress, ...update });
  }

  broadcastTrade(tokenAddress: string, trade: unknown) {
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
          logger.warn('Client ping timeout, terminating', { clientId });
          client.ws.terminate();
          this.handleDisconnect(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
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
