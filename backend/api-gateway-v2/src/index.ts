// Load environment variables from .env file FIRST (before any other imports)
import 'dotenv/config';

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { schema } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers/index.js';
import { createContext } from './graphql/context.js';
import { logger } from './lib/logger.js';
import { env } from './config/env.js';

import { GraphQLContext } from './graphql/context.js';

console.log('Starting API Gateway...');

async function startServer() {
    try {
        console.log('Initializing Apollo Server...');
        // Explicitly type the ApolloServer with our GraphQLContext
        const server = new ApolloServer<GraphQLContext>({
            typeDefs: schema,
            resolvers: resolvers as any, // Cast to any to avoid Mercurius/Apollo type conflicts
            formatError: (formattedError, error) => {
                logger.error({ error }, 'GraphQL Error');
                return formattedError;
            },
            includeStacktraceInErrorResponses: env.NODE_ENV === 'development',
        });

        console.log('Starting standalone server...');
        const { url } = await startStandaloneServer(server, {
            listen: { port: env.API_PORT ? parseInt(env.API_PORT.toString()) : 4000 },
            context: async ({ req }) => createContext(req),
        });

        console.log(`🚀 API Gateway running at ${url}`);
        logger.info(`🚀 API Gateway running at ${url}`);
        logger.info(`Health check: ${url}health`); // Note: Apollo standalone doesn't have /health by default, but we can query { health }

    } catch (error) {
        console.error('FATAL ERROR starting server:', error);
        logger.error({ error }, 'Failed to start API Gateway');
        process.exit(1);
    }
}

startServer();
