import { config } from 'dotenv';
import { resolve } from 'path';
import http from 'http';

// Load .env from backend/indexer directory with override
config({ path: resolve(process.cwd(), '.env'), override: true });

import { prisma } from '@astroshibapop/shared/prisma';
import { logger } from './lib/logger.js';
import { OptimizedEventIndexer } from './services/optimized-event-indexer.js';
import { MetricsCalculator } from './services/metrics-calculator.js';
import { createBootstrapService } from './services/bootstrap-service.js';
import { createBlockchainSyncService } from './services/blockchain-sync.service.js';
import { createEventDeduplication } from './lib/event-deduplication.js';
import { wsBroadcaster } from './services/websocket-server.js';

// ============================================================================
// Production Configuration
// ============================================================================

const INDEXER_VERSION = '2.1.0';
const SYNC_INTERVAL_MS = 60000; // 1 minute blockchain-DB sync
const METRICS_INTERVAL_MS = 60000; // 1 minute metrics calculation

async function main() {
  logger.info(`🚀 Starting AstroShibaPop Indexer v${INDEXER_VERSION}...`);

  // Check environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'STELLAR_RPC_URL',
    'TOKEN_FACTORY_CONTRACT_ID',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✓ Database connected');

    // Initialize event deduplication
    const eventDedup = createEventDeduplication(prisma, {
      cacheSize: 10000,
      cacheTtlMs: 3600000, // 1 hour
      enableDatabaseCheck: true,
    });
    logger.info('✓ Event deduplication initialized');

    // BOOTSTRAP: Sync all existing tokens from blockchain
    logger.info('📦 Running bootstrap sync...');
    const bootstrapService = createBootstrapService(prisma, {
      batchSize: 5,      // Process 5 tokens at a time
      concurrency: 2,    // 2 concurrent requests
      skipExisting: false, // Update existing tokens too
    });
    const bootstrapResult = await bootstrapService.bootstrap();

    if (bootstrapResult.success) {
      logger.info(`✓ Bootstrap complete: ${bootstrapResult.tokensCreated} created, ${bootstrapResult.tokensUpdated} updated`);
    } else {
      logger.warn('⚠ Bootstrap completed with errors');
    }

    // Start blockchain-DB sync service (ensures consistency)
    const blockchainSync = createBlockchainSyncService(prisma, {
      syncIntervalMs: SYNC_INTERVAL_MS,
      batchSize: 10,
      concurrency: 5,
      enableMetrics: true,
    });
    blockchainSync.start();
    logger.info('✓ Blockchain sync service started');

    // Start optimized event indexer for real-time updates
    const eventIndexer = new OptimizedEventIndexer(prisma);
    await eventIndexer.start();
    logger.info('✓ Event indexer started');

    // Start metrics calculator (runs every 60 seconds)
    const metricsCalculator = new MetricsCalculator(prisma);
    setInterval(() => {
      metricsCalculator.calculateAll().catch((error) => {
        logger.error('Error calculating metrics:', error);
      });
    }, METRICS_INTERVAL_MS);

    // Start HTTP server for metrics endpoint
    const metricsPort = parseInt(process.env.METRICS_PORT || '9090', 10);
    const server = http.createServer(async (req, res) => {
      if (req.url === '/metrics' && req.method === 'GET') {
        try {
          const metrics = await eventIndexer.getMetrics();
          res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
          res.end(metrics);
        } catch (error) {
          logger.error('Failed to get metrics:', error);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      } else if (req.url === '/health' && req.method === 'GET') {
        const indexerStatus = eventIndexer.getStatus();
        const syncMetrics = blockchainSync.getMetrics();
        const dedupMetrics = eventDedup.getMetrics();

        const health = {
          status: indexerStatus.isRunning && syncMetrics.isHealthy ? 'healthy' : 'degraded',
          version: INDEXER_VERSION,
          uptime: process.uptime(),
          indexer: indexerStatus,
          blockchainSync: syncMetrics,
          deduplication: dedupMetrics,
          memory: process.memoryUsage(),
        };

        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else if (req.url === '/sync/force' && req.method === 'POST') {
        // Force immediate blockchain sync
        logger.info('Manual sync triggered via API');
        blockchainSync.forcSync()
          .then((metrics) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, metrics }, null, 2));
          })
          .catch((error) => {
            logger.error('Manual sync failed:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Sync failed' }));
          });
        return;
      } else if (req.url?.startsWith('/sync/token/') && req.method === 'POST') {
        // Sync single token
        const tokenAddress = req.url.split('/sync/token/')[1];
        if (!tokenAddress || !tokenAddress.startsWith('C') || tokenAddress.length !== 56) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid token address' }));
          return;
        }

        blockchainSync.syncSingleToken(tokenAddress)
          .then((success) => {
            res.writeHead(success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success, tokenAddress }));
          })
          .catch((error) => {
            logger.error(`Failed to sync token ${tokenAddress}:`, error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to sync token' }));
          });
        return;
      } else if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'AstroShibaPop Indexer',
          version: INDEXER_VERSION,
          description: 'Production-grade blockchain indexer with hybrid architecture',
          endpoints: {
            metrics: '/metrics',
            health: '/health',
            syncForce: 'POST /sync/force',
            syncToken: 'POST /sync/token/{address}',
            dlqStats: '/dlq/stats',
            dlqList: '/dlq/list',
            dlqRetry: 'POST /dlq/retry/{eventId}',
          },
        }, null, 2));
      }
      // DLQ Endpoints
      else if (req.url === '/dlq/stats' && req.method === 'GET') {
        try {
          const stats = await eventIndexer.getDLQStats();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(stats, null, 2));
        } catch (error) {
          logger.error('Failed to get DLQ stats:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to get DLQ stats' }));
        }
      } else if (req.url === '/dlq/list' && req.method === 'GET') {
        try {
          const dlq = eventIndexer.getDLQ();
          const events = await dlq.listFailedEvents({ limit: 100 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(events, null, 2));
        } catch (error) {
          logger.error('Failed to list DLQ events:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to list DLQ events' }));
        }
      } else if (req.url?.startsWith('/dlq/retry/') && req.method === 'POST') {
        try {
          const eventId = req.url.split('/')[3];
          if (!eventId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing event ID' }));
            return;
          }
          const dlq = eventIndexer.getDLQ();
          const event = await dlq.getFailedEvent(eventId);
          if (!event) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Event not found' }));
            return;
          }
          // Mark for retry by resetting status to PENDING
          await prisma.failedEvent.update({
            where: { eventId },
            data: { status: 'PENDING', nextRetryAt: new Date() },
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Event queued for retry' }));
        } catch (error) {
          logger.error('Failed to retry DLQ event:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to retry event' }));
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(metricsPort, () => {
      logger.info(`✓ Metrics server listening on port ${metricsPort}`);
      logger.info(`📊 Metrics: http://localhost:${metricsPort}/metrics`);
      logger.info(`🏥 Health: http://localhost:${metricsPort}/health`);
      logger.info(`🔌 WebSocket: ws://localhost:${metricsPort}/ws`);
    });

    // Initialize WebSocket server for real-time updates
    wsBroadcaster.initialize(server);
    logger.info('✓ WebSocket broadcaster initialized');

    logger.info('✓ Optimized indexer running');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      try {
        await wsBroadcaster.shutdown();
        blockchainSync.stop();
        server.close();
        await eventIndexer.stop();
        await prisma.$disconnect();
        logger.info('✓ Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown();
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
    });
  } catch (error) {
    logger.error('Failed to start indexer:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
