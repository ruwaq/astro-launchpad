/**
 * Health Check Endpoint - Vercel Serverless Function
 *
 * Provides comprehensive health status including:
 * - Database connectivity
 * - Cache availability
 * - Token statistics (for soft-delete debugging)
 *
 * Endpoints:
 * - GET /health - Full health check
 * - GET /health?quick=true - Quick check (no DB)
 * - GET /health?detailed=true - Include token stats
 *
 * @version 2.1.0
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../src/lib/prisma.js';
import { getCacheStats } from '../src/lib/cache.js';
import { logger } from '../src/lib/logger.js';

const API_VERSION = '2.1.0';
const startTime = Date.now();

async function checkDatabase() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.error({ error }, '[Health] Database check failed');
    return { connected: false };
  }
}

interface CountResult {
  count: number;
}

interface NameResult {
  name: string;
}

async function getTokenStats() {
  try {
    const [totalResult, activeResult, deletedResult] = await Promise.all([
      prisma.$queryRaw<CountResult[]>`SELECT COUNT(*)::int as count FROM "Token"`,
      prisma.$queryRaw<CountResult[]>`SELECT COUNT(*)::int as count FROM "Token" WHERE "deletedAt" IS NULL`,
      prisma.$queryRaw<NameResult[]>`SELECT name FROM "Token" WHERE "deletedAt" IS NOT NULL LIMIT 10`,
    ]);

    const totalTokens = totalResult[0]?.count || 0;
    const activeTokens = activeResult[0]?.count || 0;

    return {
      totalTokens,
      activeTokens,
      deletedTokens: totalTokens - activeTokens,
      deletedTokenNames: deletedResult.map((r) => r.name),
    };
  } catch (error) {
    logger.error({ error }, '[Health] Token stats check failed');
    return null;
  }
}

export default async function healthHandler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const quick = req.query?.quick === 'true';
  const detailed = req.query?.detailed === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  const errors = [];

  try {
    if (quick) {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: API_VERSION,
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        database: { connected: true },
        cache: { available: false, type: 'none' },
      });
      return;
    }

    const [dbStatus, cacheStats] = await Promise.all([
      checkDatabase(),
      getCacheStats().catch(() => ({ available: false, type: 'none' })),
    ]);

    let tokenStats = null;
    if (detailed || !isProduction) {
      tokenStats = await getTokenStats();
    }

    let status = 'healthy';

    if (!dbStatus.connected) {
      status = 'unhealthy';
      errors.push('Database connection failed');
    } else if (!cacheStats.available) {
      status = 'degraded';
      errors.push('Cache unavailable');
    }

    const response = {
      status,
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: dbStatus,
      cache: cacheStats,
      ...(tokenStats && { tokenStats }),
      ...(errors.length > 0 && { errors }),
    };

    const statusCode = status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(response);

  } catch (error) {
    logger.error({ error }, '[Health] Health check failed');

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: { connected: false },
      cache: { available: false, type: 'none' },
      errors: [error.message],
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
