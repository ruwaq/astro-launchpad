/**
 * Express Application Factory
 * Exports testable Express app without starting the server
 */

import express, { Application } from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { schema } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers/index.js';
import { createContext, GraphQLContext } from './graphql/context.js';
import { validationRules, createComplexityPlugin } from './graphql/validation.js';
import { logger } from './lib/logger.js';
import { env } from './config/env.js';
import { createRateLimitPlugin } from './lib/rate-limiter.js';
import { wsManager } from './websocket/server.js';
import {
  sentryRequestHandler,
  sentryErrorHandler,
  errorHandlerMiddleware,
} from './lib/sentry.js';

// SECURITY: Check production mode
const isProduction = env.NODE_ENV === 'production';

// SECURITY: Parse allowed origins from environment
const allowedOrigins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());

/**
 * Create and configure Express application with Apollo Server
 * @returns Configured Express app and Apollo Server instance
 */
export async function createApp(): Promise<{
  app: Application;
  server: ApolloServer<GraphQLContext>;
}> {
  // Create Express app
  const app = express();

  // MONITORING: Sentry request handler (must be first)
  app.use(sentryRequestHandler());

  // SECURITY: CORS configuration
  app.use(cors({
    origin: isProduction ? allowedOrigins : '*',
    credentials: true,
  }));

  app.use(express.json());

  // Create Apollo Server
  const server = new ApolloServer<GraphQLContext>({
    typeDefs: schema,
    resolvers: resolvers as any,
    formatError: (formattedError, error) => {
      // SECURITY: Don't leak internal errors in production
      if (isProduction) {
        logger.error({ error }, 'GraphQL Error');
        return {
          message: formattedError.message,
          path: formattedError.path,
          extensions: {
            code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR',
          },
        };
      }
      logger.error({ error }, 'GraphQL Error');
      return formattedError;
    },
    includeStacktraceInErrorResponses: !isProduction,
    introspection: env.GRAPHQL_INTROSPECTION,
    validationRules,
    plugins: [
      createComplexityPlugin(),
      createRateLimitPlugin(),
    ],
  });

  // Start Apollo Server
  await server.start();

  // Apply Apollo middleware to Express
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => createContext(req as any),
  }));

  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'Astro Shiba Pop API Gateway V2',
      version: '0.2.0',
      graphql: '/graphql',
      health: '/health',
      metrics: '/metrics',
    });
  });

  // WebSocket stats endpoint
  app.get('/ws/stats', (req, res) => {
    if (wsManager) {
      res.json(wsManager.getStats());
    } else {
      res.status(503).json({ error: 'WebSocket not initialized' });
    }
  });

  // Metrics endpoint (Prometheus compatible)
  app.get('/metrics', async (req, res) => {
    try {
      const { register } = await import('prom-client');
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.send(metrics);
    } catch (error) {
      logger.error({ error }, 'Error generating metrics');
      res.status(500).json({ error: 'Failed to generate metrics' });
    }
  });

  // MONITORING: Sentry error handler (must be after all routes)
  app.use(sentryErrorHandler());

  // MONITORING: Custom error handler
  app.use(errorHandlerMiddleware);

  return { app, server };
}
