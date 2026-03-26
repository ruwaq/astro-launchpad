/**
 * Health Check Handler for Vercel Serverless
 *
 * Provides comprehensive health status including:
 * - Database connectivity
 * - Cache availability
 * - Token statistics (for soft-delete debugging)
 * - System metrics
 *
 * @module handlers/health
 * @version 2.1.0
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../lib/prisma.js';
import { getCacheStats } from '../lib/cache.js';
import { logger } from '../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface TokenStats {
  totalTokens: number;
  activeTokens: number;
  deletedTokens: number;
  deletedTokenNames: string[];
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  database: {
    connected: boolean;
    latencyMs?: number;
  };
  cache: {
    available: boolean;
    type: string;
  };
  tokenStats?: TokenStats;
  errors?: string[];
}

// ============================================================================
// Configuration
// ============================================================================

export const API_VERSION = '2.1.1';
const startTime = Date.now();

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Check database health with latency measurement
 */
export async function checkDatabase(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  const dbUrl = process.env.DATABASE_URL || 'NOT_SET';
  const hasDbUrl = dbUrl !== 'NOT_SET' && dbUrl.length > 10;
  const isSupabase = dbUrl.includes('supabase.co');

  logger.info({
    hasDbUrl,
    isSupabase,
    dbUrlPrefix: hasDbUrl ? dbUrl.substring(0, 30) + '...' : 'N/A',
  }, '[Health] Database check starting');

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, hasDbUrl, isSupabase }, '[Health] Database check failed');
    return { connected: false, error: errorMessage };
  }
}

/**
 * Get token statistics for soft-delete debugging
 * Only included in non-production or when explicitly requested
 */
export async function getTokenStats(): Promise<TokenStats | null> {
  try {
    const [totalResult, activeResult, deletedResult] = await Promise.all([
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int as count FROM "Token"
      `,
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int as count FROM "Token" WHERE "deletedAt" IS NULL
      `,
      prisma.$queryRaw<{ name: string }[]>`
        SELECT name FROM "Token" WHERE "deletedAt" IS NOT NULL LIMIT 10
      `,
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

// ============================================================================
// Request Handler
// ============================================================================

/**
 * Health check handler for Vercel serverless
 *
 * Endpoints:
 * - GET /health - Full health check
 * - GET /health?quick=true - Quick check (no DB)
 * - GET /health?detailed=true - Include token stats
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function healthHandler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse | { error: string }>
): Promise<void> {
  // Set headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Parse query parameters
  const quick = req.query.quick === 'true';
  const detailed = req.query.detailed === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  const errors: string[] = [];

  try {
    // Quick check - no external dependencies
    if (quick) {
      const response: HealthResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: API_VERSION,
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        database: { connected: true }, // Assume healthy for quick check
        cache: { available: false, type: 'none' },
      };

      res.status(200).json(response);
      return;
    }

    // Full health check
    const [dbStatus, cacheStats] = await Promise.all([
      checkDatabase(),
      getCacheStats().catch(() => ({ available: false, type: 'none' as const })),
    ]);

    // Get token stats if detailed or non-production
    let tokenStats: TokenStats | null = null;
    if (detailed || !isProduction) {
      tokenStats = await getTokenStats();
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!dbStatus.connected) {
      status = 'unhealthy';
      const dbError = dbStatus.error ? `: ${dbStatus.error}` : '';
      errors.push(`Database connection failed${dbError}`);
    } else if (!cacheStats.available) {
      status = 'degraded';
      errors.push('Cache unavailable');
    }

    const response: HealthResponse = {
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

    // Set status code based on health
    const statusCode = status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(response);

  } catch (error) {
    logger.error({ error }, '[Health] Health check failed');

    const response: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: { connected: false },
      cache: { available: false, type: 'none' },
      errors: [(error as Error).message],
    };

    res.status(503).json(response);
  }
}

/**
 * Vercel/Next.js API route configuration
 */
export const config = {
  api: {
    bodyParser: false,
  },
};
