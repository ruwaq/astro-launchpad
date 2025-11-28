/**
 * Apollo GraphQL Server for Vercel using apollo-server-micro
 * Production-ready, serverless-optimized implementation
 */
import { ApolloServer } from 'apollo-server-micro';
import { send } from 'micro';
import Cors from 'micro-cors';
import { schema } from '../dist/src/graphql/schema.js';
import { resolvers } from '../dist/src/graphql/resolvers/index.js';
import { prisma } from '../dist/src/lib/prisma.js';
import { createLoaders } from '../dist/src/graphql/loaders.js';

const isProduction = process.env.NODE_ENV === 'production';

const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['https://astroshiba.io', 'https://app.astroshiba.io', 'https://www.astroshiba.io'];

if (!isProduction) {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:4000');
}

const cors = Cors({
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  origin: (origin) => {
    if (!origin) return true;
    return ALLOWED_ORIGINS.includes(origin) ? origin : false;
  },
});

let apolloServerHandler = null;

async function getServerHandler() {
  if (!apolloServerHandler) {
    console.log('[Apollo] Initializing server...');

    const apolloServer = new ApolloServer({
      typeDefs: schema,
      resolvers,
      introspection: !isProduction || process.env.GRAPHQL_INTROSPECTION === 'true',
      context: async () => ({
        prisma,
        loaders: createLoaders(prisma),
      }),
    });

    await apolloServer.start();
    apolloServerHandler = apolloServer.createHandler({ path: '/api/graphql' });

    console.log('[Apollo] Server initialized (production mode:', isProduction, ')');
  }
  return apolloServerHandler;
}

export default cors(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 200, 'ok');
  }

  try {
    const handler = await getServerHandler();
    return handler(req, res);
  } catch (error) {
    console.error('[Apollo] Handler error:', error);
    return send(res, 500, { error: 'Internal Server Error' });
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};
