import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import { logger } from './lib/logger.js';
import { OptimizedEventIndexer } from './services/optimized-event-indexer.js';
import { MetricsCalculator } from './services/metrics-calculator.js';

const prisma = new PrismaClient();

async function main() {
  logger.info('🚀 Starting AstroShibaPop Optimized Indexer...');

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

    // Start optimized event indexer
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
        }, null, 2));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(metricsPort, () => {
      logger.info(`✓ Metrics server listening on port ${metricsPort}`);
      logger.info(`📊 Metrics: http://localhost:${metricsPort}/metrics`);
      logger.info(`🏥 Health: http://localhost:${metricsPort}/health`);
    });

    logger.info('✓ Optimized indexer running');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');
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
