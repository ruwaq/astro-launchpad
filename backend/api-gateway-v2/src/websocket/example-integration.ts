/**
 * Example Integration: WebSocket Broadcaster with GraphQL Resolvers
 *
 * This file demonstrates how to integrate WebSocket broadcasts into your
 * GraphQL resolvers and indexer event handlers.
 */

import { WebSocketBroadcaster } from './broadcaster.js';
import { GraphQLContext } from '../graphql/context.js';

// =============================================================================
// EXAMPLE 1: GraphQL Mutation - Buy Tokens
// =============================================================================

export const buyTokensMutation = {
  async buyTokens(
    _: unknown,
    args: { tokenAddress: string; xlmAmount: string },
    context: GraphQLContext
  ) {
    const { tokenAddress, xlmAmount } = args;

    // 1. Execute the trade (your existing logic)
    const trade = await context.prisma.transaction.create({
      data: {
        tokenAddress,
        type: 'buy',
        xlmAmount,
        userAddress: context.userAddress || 'anonymous',
        // ... other fields
      },
      include: {
        token: true,
      },
    });

    // 2. Update token stats
    const updatedToken = await context.prisma.token.update({
      where: { address: tokenAddress },
      data: {
        volume24h: {
          increment: BigInt(xlmAmount),
        },
        transactions24h: {
          increment: 1,
        },
      },
    });

    // 3. Broadcast the trade event to WebSocket clients
    WebSocketBroadcaster.broadcastTrade({
      id: trade.id,
      tokenAddress,
      tokenSymbol: trade.token.symbol,
      type: 'buy',
      xlmAmount,
      tokenAmount: trade.tokenAmount,
      price: trade.price,
      user: trade.userAddress,
      timestamp: trade.createdAt.getTime(),
      txHash: trade.txHash,
    });

    // 4. Broadcast updated token stats
    WebSocketBroadcaster.broadcastTokenUpdate({
      tokenAddress,
      volume24h: updatedToken.volume24h.toString(),
      transactions24h: updatedToken.transactions24h,
    });

    return trade;
  },
};

// =============================================================================
// EXAMPLE 2: GraphQL Subscription - Token Price Updates
// =============================================================================

// Note: You can still use GraphQL subscriptions alongside WebSocket
// The WebSocket server handles the real-time transport, while GraphQL
// subscriptions provide the schema and type safety.

export const tokenPriceSubscription = {
  subscribe: (
    _: unknown,
    args: { tokenAddress: string },
    context: GraphQLContext
  ) => {
    // This is handled by your WebSocket server
    // GraphQL subscriptions can coexist with direct WebSocket
    return context.pubsub.asyncIterator([`PRICE_UPDATE_${args.tokenAddress}`]);
  },
};

// =============================================================================
// EXAMPLE 3: Indexer Event Handler - New Token Created
// =============================================================================

export async function handleTokenCreatedEvent(event: {
  tokenAddress: string;
  name: string;
  symbol: string;
  creator: string;
  imageUrl?: string;
  blockNumber: number;
}) {
  // 1. Save to database
  const token = await prisma.token.create({
    data: {
      address: event.tokenAddress,
      name: event.name,
      symbol: event.symbol,
      creator: event.creator,
      imageUrl: event.imageUrl,
      blockNumber: event.blockNumber,
      createdAt: new Date(),
    },
  });

  // 2. Broadcast to WebSocket clients
  WebSocketBroadcaster.broadcastNewToken({
    tokenAddress: token.address,
    name: token.name,
    symbol: token.symbol,
    creator: token.creator,
    imageUrl: token.imageUrl,
    timestamp: token.createdAt.getTime(),
  });

  // 3. Update global stats
  const totalTokens = await prisma.token.count();
  WebSocketBroadcaster.broadcastGlobalStats({
    totalTokens,
    totalVolume24h: '0', // Calculate from aggregations
    totalTrades24h: 0,
    activeUsers24h: 0,
  });

  return token;
}

// =============================================================================
// EXAMPLE 4: Indexer Event Handler - Token Graduation
// =============================================================================

export async function handleGraduationEvent(event: {
  tokenAddress: string;
  pairAddress: string;
  blockNumber: number;
}) {
  // 1. Update token status
  const token = await prisma.token.update({
    where: { address: event.tokenAddress },
    data: {
      graduated: true,
      pairAddress: event.pairAddress,
      graduatedAt: new Date(),
    },
  });

  // 2. Broadcast graduation event
  WebSocketBroadcaster.broadcastGraduation({
    tokenAddress: token.address,
    tokenName: token.name,
    tokenSymbol: token.symbol,
    pairAddress: event.pairAddress,
    timestamp: Date.now(),
    finalMarketCap: token.marketCap.toString(),
  });

  return token;
}

// =============================================================================
// EXAMPLE 5: Scheduled Job - Price Updates
// =============================================================================

export async function updateTokenPrices() {
  // Run every 5 seconds to update prices for all active tokens

  const activeTokens = await prisma.token.findMany({
    where: {
      graduated: false,
      // Only tokens with recent activity
      updatedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
      },
    },
  });

  for (const token of activeTokens) {
    // Calculate new price (your bonding curve logic)
    const currentPrice = await calculateTokenPrice(token.address);
    const previousPrice = parseFloat(token.price);
    const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

    // Update database
    await prisma.token.update({
      where: { address: token.address },
      data: {
        price: currentPrice.toString(),
        priceChange24h: priceChange,
      },
    });

    // Broadcast price update
    WebSocketBroadcaster.broadcastPriceUpdate(
      token.address,
      currentPrice.toString(),
      priceChange
    );
  }
}

// =============================================================================
// EXAMPLE 6: GraphQL Query with Side Effect - Get Token Stats
// =============================================================================

export const getTokenQuery = {
  async token(
    _: unknown,
    args: { address: string },
    context: GraphQLContext
  ) {
    const token = await context.prisma.token.findUnique({
      where: { address: args.address },
      include: {
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!token) {
      throw new Error('Token not found');
    }

    // Optional: Broadcast view count increment
    const viewCount = await context.prisma.token.update({
      where: { address: args.address },
      data: {
        viewCount: {
          increment: 1,
        },
      },
      select: { viewCount: true },
    });

    // Broadcast updated view count (optional, for live viewer count)
    if (viewCount.viewCount % 10 === 0) {
      // Only broadcast every 10 views to reduce noise
      WebSocketBroadcaster.broadcastTokenUpdate({
        tokenAddress: args.address,
        // Add view count if you want to show it
      });
    }

    return token;
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

async function calculateTokenPrice(tokenAddress: string): Promise<number> {
  // Your bonding curve price calculation
  // This is just a placeholder
  return Math.random() * 0.001;
}

// Mock Prisma for examples
const prisma = {
  token: {
    create: async (args: any) => ({ id: '1', ...args.data }),
    update: async (args: any) => ({ id: '1', ...args.data }),
    findUnique: async (args: any) => ({ id: '1', address: args.where.address }),
    findMany: async (args: any) => [],
    count: async () => 100,
  },
  transaction: {
    create: async (args: any) => ({ id: '1', ...args.data }),
  },
} as any;

// =============================================================================
// Integration Checklist
// =============================================================================

/**
 * When integrating WebSocket broadcasts into your resolvers:
 *
 * 1. Import the broadcaster:
 *    import { WebSocketBroadcaster } from '../websocket/broadcaster';
 *
 * 2. After mutations that change state:
 *    - broadcastTrade() - after buy/sell
 *    - broadcastTokenUpdate() - after price/stats change
 *    - broadcastGraduation() - when token graduates
 *
 * 3. In indexer event handlers:
 *    - broadcastNewToken() - on token creation
 *    - broadcastGraduation() - on graduation event
 *
 * 4. In scheduled jobs:
 *    - broadcastPriceUpdate() - for regular price updates
 *    - broadcastGlobalStats() - for platform stats
 *
 * 5. Error handling:
 *    - Broadcasts are fire-and-forget (non-blocking)
 *    - If WebSocket is down, it logs a warning but doesn't fail
 *    - Always broadcast AFTER database updates (not before)
 *
 * 6. Testing:
 *    - Use /ws/stats endpoint to verify connections
 *    - Use wscat or browser DevTools to test subscriptions
 *    - Check server logs for broadcast confirmations
 */
