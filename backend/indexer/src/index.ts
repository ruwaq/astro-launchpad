import { config } from 'dotenv';
import { resolve } from 'path';
import http from 'http';

// Load .env from backend/indexer directory with override
config({ path: resolve(process.cwd(), '.env'), override: true });

// ============================================================================
// Admin API Key Authentication Middleware
// ============================================================================

const ADMIN_API_KEY = process.env.INDEXER_ADMIN_API_KEY;

/**
 * Validates admin API key for protected endpoints
 * Returns true if authorized, false otherwise
 */
function validateAdminAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  // If no API key configured, log warning and allow (dev mode)
  if (!ADMIN_API_KEY) {
    console.warn('⚠️ INDEXER_ADMIN_API_KEY not set - admin endpoints unprotected!');
    return true;
  }

  const providedKey = req.headers['x-admin-api-key'] as string;

  if (!providedKey || providedKey !== ADMIN_API_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized - Invalid or missing X-Admin-API-Key header' }));
    return false;
  }

  return true;
}

import { prisma } from '@astroshibapop/shared/prisma';
import { logger } from './lib/logger.js';
import { OptimizedEventIndexer } from './services/optimized-event-indexer.js';
import { MetricsCalculator } from './services/metrics-calculator.js';
import { createBootstrapService } from './services/bootstrap-service.js';
import { createBlockchainSyncService } from './services/blockchain-sync.service.js';
import { createEventDeduplication } from './lib/event-deduplication.js';
import { wsBroadcaster } from './services/websocket-server.js';
import { createDLQMaintenance } from './services/dlq-maintenance.js';

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

    // Start DLQ maintenance service (cleanup, retries, health checks)
    const dlqMaintenance = createDLQMaintenance(prisma, eventIndexer.getDLQ());
    dlqMaintenance.start();
    logger.info('✓ DLQ maintenance service started');

    // Start HTTP server for metrics endpoint
    // Railway provides PORT, we also support METRICS_PORT for local dev
    const metricsPort = parseInt(process.env.PORT || process.env.METRICS_PORT || '9090', 10);
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
        const gapStats = await eventIndexer.getGapStats();

        // Health degrades if there are active gaps
        const hasActiveGaps = gapStats.detected > 0 || gapStats.recovering > 0;
        const hasAbandonedGaps = gapStats.abandoned > 0;

        const health = {
          status: indexerStatus.isRunning && syncMetrics.isHealthy && !hasAbandonedGaps ? 'healthy' : 'degraded',
          version: INDEXER_VERSION,
          uptime: process.uptime(),
          indexer: indexerStatus,
          blockchainSync: syncMetrics,
          deduplication: dedupMetrics,
          ledgerGaps: {
            ...gapStats,
            hasActiveGaps,
            hasAbandonedGaps,
          },
          memory: process.memoryUsage(),
        };

        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else if (req.url === '/sync/force' && req.method === 'POST') {
        // Force immediate blockchain sync - PROTECTED
        if (!validateAdminAuth(req, res)) return;
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
        // Sync single token - PROTECTED
        if (!validateAdminAuth(req, res)) return;
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
            gapStats: '/gaps/stats',
            gapList: '/gaps/list',
            gapRecover: 'POST /gaps/recover/{gapId}',
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
        // Retry failed event - PROTECTED
        if (!validateAdminAuth(req, res)) return;
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
      }
      // Gap Detection Endpoints
      else if (req.url === '/gaps/stats' && req.method === 'GET') {
        try {
          const stats = await eventIndexer.getGapStats();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(stats, null, 2));
        } catch (error) {
          logger.error('Failed to get gap stats:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to get gap stats' }));
        }
      } else if (req.url === '/gaps/list' && req.method === 'GET') {
        try {
          const gapDetector = eventIndexer.getGapDetector();
          const gaps = await gapDetector.listGaps({ limit: 100 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(gaps, null, 2));
        } catch (error) {
          logger.error('Failed to list gaps:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to list gaps' }));
        }
      } else if (req.url?.startsWith('/gaps/recover/') && req.method === 'POST') {
        // Trigger gap recovery - PROTECTED
        if (!validateAdminAuth(req, res)) return;
        try {
          const gapId = req.url.split('/gaps/recover/')[1];
          if (!gapId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing gap ID' }));
            return;
          }
          const gapDetector = eventIndexer.getGapDetector();
          const result = await gapDetector.triggerRecovery(gapId);
          res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result, null, 2));
        } catch (error) {
          logger.error('Failed to trigger gap recovery:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to trigger gap recovery' }));
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
        dlqMaintenance.stop();
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
    logger.error({ err: error }, 'Failed to start indexer');
    console.error('Startup error details:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
