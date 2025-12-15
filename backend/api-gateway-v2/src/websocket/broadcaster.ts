import { wsManager } from './server.js';
import { logger } from '../lib/logger.js';

/**
 * WebSocket Broadcaster Service
 *
 * Provides high-level functions to broadcast events to WebSocket clients.
 * Used by GraphQL resolvers and the indexer to push real-time updates.
 */

export interface TokenUpdateEvent {
  tokenAddress: string;
  price?: string;
  priceChange24h?: number;
  volume24h?: string;
  marketCap?: string;
  holders?: number;
  transactions24h?: number;
}

export interface TradeEvent {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  type: 'buy' | 'sell';
  xlmAmount: string;
  tokenAmount: string;
  price: string;
  user: string;
  timestamp: number;
  txHash: string;
}

export interface GraduationEvent {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  pairAddress: string;
  timestamp: number;
  finalMarketCap: string;
}

export interface NewTokenEvent {
  tokenAddress: string;
  name: string;
  symbol: string;
  creator: string;
  imageUrl?: string;
  description?: string;
  timestamp: number;
}

export class WebSocketBroadcaster {
  /**
   * Broadcast token price/stats update
   */
  static broadcastTokenUpdate(update: TokenUpdateEvent) {
    if (!wsManager) {
      logger.warn('WebSocket manager not initialized, skipping broadcast');
      return;
    }

    try {
      wsManager.broadcastTokenUpdate(update.tokenAddress, {
        type: 'token_update',
        ...update,
        timestamp: Date.now(),
      });

      logger.debug({ tokenAddress: update.tokenAddress }, 'Broadcasted token update');
    } catch (error) {
      logger.error({ error, tokenAddress: update.tokenAddress }, 'Failed to broadcast token update');
    }
  }

  /**
   * Broadcast new trade
   */
  static broadcastTrade(trade: TradeEvent) {
    if (!wsManager) {
      logger.warn('WebSocket manager not initialized, skipping broadcast');
      return;
    }

    try {
      wsManager.broadcastTrade(trade.tokenAddress, {
        type: 'trade',
        ...trade,
      });

      logger.debug({
        tokenAddress: trade.tokenAddress,
        type: trade.type,
        txHash: trade.txHash,
      }, 'Broadcasted trade');
    } catch (error) {
      logger.error({ error, tokenAddress: trade.tokenAddress }, 'Failed to broadcast trade');
    }
  }

  /**
   * Broadcast token graduation (reached market cap threshold)
   */
  static broadcastGraduation(event: GraduationEvent) {
    if (!wsManager) {
      logger.warn('WebSocket manager not initialized, skipping broadcast');
      return;
    }

    try {
      // Broadcast to specific token subscribers
      wsManager.broadcast(`token:${event.tokenAddress}`, {
        type: 'graduation',
        ...event,
      });

      // Broadcast to global graduation channel
      wsManager.broadcast('graduations:all', {
        type: 'graduation',
        ...event,
      });

      logger.info({
        tokenAddress: event.tokenAddress,
        tokenSymbol: event.tokenSymbol,
      }, 'Broadcasted graduation event');
    } catch (error) {
      logger.error({ error, tokenAddress: event.tokenAddress }, 'Failed to broadcast graduation');
    }
  }

  /**
   * Broadcast new token launch
   */
  static broadcastNewToken(event: NewTokenEvent) {
    if (!wsManager) {
      logger.warn('WebSocket manager not initialized, skipping broadcast');
      return;
    }

    try {
      wsManager.broadcast('tokens:new', {
        type: 'new_token',
        ...event,
      });

      logger.info({
        tokenAddress: event.tokenAddress,
        symbol: event.symbol,
      }, 'Broadcasted new token');
    } catch (error) {
      logger.error({ error, tokenAddress: event.tokenAddress }, 'Failed to broadcast new token');
    }
  }

  /**
   * Broadcast price update for a specific token
   */
  static broadcastPriceUpdate(tokenAddress: string, price: string, priceChange?: number) {
    if (!wsManager) {
      logger.warn('WebSocket manager not initialized, skipping broadcast');
      return;
    }

    try {
      wsManager.broadcastPriceUpdate(tokenAddress, {
        type: 'price_update',
        tokenAddress,
        price,
        priceChange,
        timestamp: Date.now(),
      });

      logger.debug({ tokenAddress, price }, 'Broadcasted price update');
    } catch (error) {
      logger.error({ error, tokenAddress }, 'Failed to broadcast price update');
    }
  }

  /**
   * Broadcast global stats update
   */
  static broadcastGlobalStats(stats: {
    totalTokens: number;
    totalVolume24h: string;
    totalTrades24h: number;
    activeUsers24h: number;
  }) {
    if (!wsManager) {
      logger.warn('WebSocket manager not initialized, skipping broadcast');
      return;
    }

    try {
      wsManager.broadcast('stats:global', {
        type: 'global_stats',
        ...stats,
        timestamp: Date.now(),
      });

      logger.debug('Broadcasted global stats');
    } catch (error) {
      logger.error({ error }, 'Failed to broadcast global stats');
    }
  }

  /**
   * Get current WebSocket connection stats
   */
  static getStats() {
    if (!wsManager) {
      return {
        totalClients: 0,
        totalChannels: 0,
        channels: [],
      };
    }

    return wsManager.getStats();
  }
}

export default WebSocketBroadcaster;
