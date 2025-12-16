// Load environment variables from .env file FIRST (before any other imports)
import 'dotenv/config';

// Initialize Sentry BEFORE other imports for error tracking
import { initializeSentry } from './lib/sentry.js';
initializeSentry();

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { schema } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers/index.js';
import { createContext, GraphQLContext } from './graphql/context.js';
import { validationRules, createComplexityPlugin } from './graphql/validation.js';
import { logger } from './lib/logger.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';
import { checkLiveness, checkReadiness, getHealthStatus } from './lib/health.js';
import { createRateLimitPlugin, getRateLimitHeaders } from './lib/rate-limiter.js';
import { initWebSocket, wsManager } from './websocket/server.js';
import {
  sentryRequestHandler,
  sentryErrorHandler,
  errorHandlerMiddleware,
  flush as flushSentry,
} from './lib/sentry.js';

// INFRASTRUCTURE: Track server instances for graceful shutdown
let serverInstance: ApolloServer<GraphQLContext> | null = null;
let httpServerInstance: http.Server | null = null;
let healthServerInstance: http.Server | null = null;
let isShuttingDown = false;

logger.info('Starting API Gateway...');

// SECURITY: Check production mode (used throughout for security settings)
const isProduction = env.NODE_ENV === 'production';
logger.info({ production: isProduction, introspection: env.GRAPHQL_INTROSPECTION }, 'Security configuration');

// SECURITY: Parse allowed origins from environment
const allowedOrigins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());

/**
 * INFRASTRUCTURE: Health Check HTTP Server
 * Kubernetes-compatible endpoints for liveness and readiness probes
 * Runs on a separate port (default: 4001) to not interfere with GraphQL
 */
async function startHealthServer(): Promise<http.Server> {
  const healthPort = env.HEALTH_PORT || 4001;

  const healthServer = http.createServer(async (req, res) => {
    // CORS headers for health endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const url = req.url || '';

    try {
      // Liveness probe - Kubernetes restarts pod if this fails
      if (url === '/health/live' || url === '/livez') {
        const result = await checkLiveness();
        res.statusCode = result.alive ? 200 : 503;
        res.end(JSON.stringify(result));
        return;
      }

      // Readiness probe - Kubernetes removes from LB if this fails
      if (url === '/health/ready' || url === '/readyz') {
        const result = await checkReadiness();
        res.statusCode = result.ready ? 200 : 503;
        res.end(JSON.stringify(result));
        return;
      }

      // Full health status for monitoring
      if (url === '/health' || url === '/healthz') {
        const status = await getHealthStatus();
        res.statusCode = status.status === 'unhealthy' ? 503 : 200;
        res.end(JSON.stringify(status));
        return;
      }

      // 404 for unknown paths
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      logger.error({ error }, 'Health endpoint error');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  return new Promise((resolve, reject) => {
    healthServer.listen(healthPort, () => {
      logger.info(`🏥 Health server running at http://localhost:${healthPort}`);
      logger.info(`   - Liveness:  http://localhost:${healthPort}/health/live`);
      logger.info(`   - Readiness: http://localhost:${healthPort}/health/ready`);
      logger.info(`   - Full:      http://localhost:${healthPort}/health`);
      resolve(healthServer);
    });
    healthServer.on('error', reject);
  });
}

async function startServer() {
    try {
        logger.info('Initializing Apollo Server...');

        // Create Express app and Apollo Server using factory
        const { app, server } = await import('./app.js').then(m => m.createApp());

        // Store server reference for graceful shutdown
        serverInstance = server;

        // Log introspection status for developers
        if (env.GRAPHQL_INTROSPECTION) {
            logger.info('📚 GraphQL Introspection ENABLED - Apollo Explorer available at endpoint');
        }

        // Create HTTP server
        const httpServer = http.createServer(app);
        httpServerInstance = httpServer;

        // Initialize WebSocket server
        initWebSocket(httpServer);
        logger.info('🔌 WebSocket server initialized at /ws');

        const port = env.API_PORT ? parseInt(env.API_PORT.toString()) : 4000;

        // Start HTTP server
        await new Promise<void>((resolve) => {
            httpServer.listen(port, () => {
                logger.info(`🚀 API Gateway running at http://localhost:${port}/graphql`);
                logger.info(`🔌 WebSocket server running at ws://localhost:${port}/ws`);
                logger.info(`   - CORS Origins: ${isProduction ? allowedOrigins.join(', ') : 'All (dev mode)'}`);
                resolve();
            });
        });

        // Start health check server
        healthServerInstance = await startHealthServer();

    } catch (error: any) {
        console.error('FATAL ERROR starting server:', error);
        logger.error({ error: error?.message || error, stack: error?.stack }, 'FATAL ERROR starting server');
        process.exit(1);
    }
}

/**
 * INFRASTRUCTURE: Graceful shutdown handler
 * Ensures clean disconnection of database and ongoing request completion
 */
async function gracefulShutdown(signal: string) {
    if (isShuttingDown) {
        logger.warn(`Shutdown already in progress, ignoring ${signal}`);
        return;
    }

    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    const shutdownTimeout = setTimeout(() => {
        logger.error('Graceful shutdown timed out (30s). Forcing exit.');
        process.exit(1);
    }, 30000);

    try {
        // Step 1: Stop accepting new connections
        if (serverInstance) {
            logger.info('Stopping Apollo Server...');
            await serverInstance.stop();
            logger.info('Apollo Server stopped');
        }

        // Step 1.5: Stop HTTP server (includes WebSocket)
        if (httpServerInstance) {
            logger.info('Stopping HTTP Server (Express + WebSocket)...');
            await new Promise<void>((resolve, reject) => {
                httpServerInstance!.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            logger.info('HTTP Server stopped');
        }

        // Step 1.6: Stop health check server
        if (healthServerInstance) {
            logger.info('Stopping Health Server...');
            await new Promise<void>((resolve, reject) => {
                healthServerInstance!.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            logger.info('Health Server stopped');
        }

        // Step 2: Wait for in-flight requests (give them 5 seconds)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 3: Disconnect database
        logger.info('Disconnecting from database...');
        await disconnectPrisma();
        logger.info('Database disconnected');

        // Step 4: Flush Sentry events
        logger.info('Flushing Sentry events...');
        await flushSentry(2000);
        logger.info('Sentry events flushed');

        clearTimeout(shutdownTimeout);
        logger.info('Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error({ error }, 'Error during graceful shutdown');
        clearTimeout(shutdownTimeout);
        process.exit(1);
    }
}

// INFRASTRUCTURE: Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// INFRASTRUCTURE: Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception');
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
    // Don't shutdown on unhandled rejection, just log
});

startServer();
