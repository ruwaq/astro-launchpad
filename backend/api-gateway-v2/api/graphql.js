/**
 * Apollo GraphQL Server for Vercel
 * Simplified implementation for serverless deployment
 */
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { PrismaClient } from '@prisma/client';
import gql from 'graphql-tag';

// Global Prisma instance for serverless
const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const isProduction = process.env.NODE_ENV === 'production';

// GraphQL Schema
const typeDefs = gql`
  type Query {
    health: HealthStatus!
    tokens(first: Int, skip: Int, orderBy: TokenOrderBy): TokenConnection!
    token(address: String!): Token
    globalStats: GlobalStats!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    database: Boolean!
  }

  type Token {
    id: ID!
    address: String!
    name: String!
    symbol: String!
    decimals: Int!
    creator: String!
    description: String
    imageUrl: String
    totalSupply: String!
    marketCap: String!
    price: String!
    priceChange24h: Float
    volume24h: String!
    holders: Int!
    isGraduated: Boolean!
    createdAt: String!
  }

  type TokenConnection {
    nodes: [Token!]!
    totalCount: Int!
    pageInfo: PageInfo!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  type GlobalStats {
    totalTokens: Int!
    totalVolume: String!
    totalUsers: Int!
    totalTransactions: Int!
  }

  enum TokenOrderBy {
    CREATED_AT_DESC
    CREATED_AT_ASC
    MARKET_CAP_DESC
    VOLUME_24H_DESC
  }
`;

// Resolvers
const resolvers = {
  Query: {
    health: async () => {
      let dbHealthy = false;
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
      } catch (e) {
        console.error('DB health check failed:', e);
      }
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbHealthy,
      };
    },
    tokens: async (_, { first = 20, skip = 0, orderBy = 'CREATED_AT_DESC' }) => {
      const orderByMap = {
        CREATED_AT_DESC: { createdAt: 'desc' },
        CREATED_AT_ASC: { createdAt: 'asc' },
        MARKET_CAP_DESC: { marketCap: 'desc' },
        VOLUME_24H_DESC: { volume24h: 'desc' },
      };

      const [tokens, totalCount] = await Promise.all([
        prisma.token.findMany({
          take: first,
          skip,
          orderBy: orderByMap[orderBy] || { createdAt: 'desc' },
        }),
        prisma.token.count(),
      ]);

      return {
        nodes: tokens.map(t => ({
          ...t,
          totalSupply: t.totalSupply?.toString() || '0',
          marketCap: t.marketCap?.toString() || '0',
          price: t.price?.toString() || '0',
          volume24h: t.volume24h?.toString() || '0',
          createdAt: t.createdAt?.toISOString() || new Date().toISOString(),
        })),
        totalCount,
        pageInfo: {
          hasNextPage: skip + first < totalCount,
          hasPreviousPage: skip > 0,
        },
      };
    },
    token: async (_, { address }) => {
      const token = await prisma.token.findUnique({ where: { address } });
      if (!token) return null;
      return {
        ...token,
        totalSupply: token.totalSupply?.toString() || '0',
        marketCap: token.marketCap?.toString() || '0',
        price: token.price?.toString() || '0',
        volume24h: token.volume24h?.toString() || '0',
        createdAt: token.createdAt?.toISOString() || new Date().toISOString(),
      };
    },
    globalStats: async () => {
      const [totalTokens, totalUsers, totalTransactions] = await Promise.all([
        prisma.token.count(),
        prisma.user.count(),
        prisma.transaction.count(),
      ]);

      // Calculate total volume from tokens (sum of volume24h)
      const volumeResult = await prisma.$queryRaw`
        SELECT COALESCE(SUM(CAST(NULLIF("volume24h", '') AS DECIMAL)), 0)::text as total
        FROM "Token"
      `;

      return {
        totalTokens,
        totalVolume: volumeResult[0]?.total || '0',
        totalUsers,
        totalTransactions,
      };
    },
  },
};

// Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: !isProduction || process.env.GRAPHQL_INTROSPECTION === 'true',
});

const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => ({
    prisma,
  }),
});

export default async function graphqlHandler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return handler(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
