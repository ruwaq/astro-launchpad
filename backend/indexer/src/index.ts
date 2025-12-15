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
import { wsBroadcaster } from './services/websocket-server.js';

async function main() {
  logger.info('🚀 Starting AstroShibaPop Indexer v2.0...');

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

    // Start optimized event indexer for real-time updates
    const eventIndexer = new OptimizedEventIndexer(prisma);
    await eventIndexer.start();

    // Start metrics calculator (runs every 60 seconds)
    const metricsCalculator = new MetricsCalculator(prisma);
    setInterval(() => {
      metricsCalculator.calculateAll().catch((error) => {
        logger.error('Error calculating metrics:', error);
      });
    }, 60000);

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
        const status = eventIndexer.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
      } else if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'AstroShibaPop Optimized Indexer',
          version: '0.2.0',
          metrics: '/metrics',
          health: '/health',
          dlq: {
            stats: '/dlq/stats',
            list: '/dlq/list',
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
      logger.info('Shutting down...');
      await wsBroadcaster.shutdown();
      server.close();
      await eventIndexer.stop();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Failed to start indexer:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
