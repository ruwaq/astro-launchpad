// @ts-nocheck
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

const cors = Cors({
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  origin: '*',
});

let apolloServerHandler: any = null;

async function getServerHandler() {
  if (!apolloServerHandler) {
    console.log('[Apollo] Initializing server...');
    
    const apolloServer = new ApolloServer({
      typeDefs: schema,
      resolvers,
      introspection: true,
      context: async () => ({
        prisma,
        loaders: createLoaders(prisma),
      }),
    });

    await apolloServer.start();
    apolloServerHandler = apolloServer.createHandler({ path: '/api/graphql' });
    
    console.log('[Apollo] Server initialized');
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
