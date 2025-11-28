/**
 * Health Check Module
 *
 * Provides Kubernetes-compatible health check endpoints:
 * - Liveness: Is the service running? (restart if not)
 * - Readiness: Is the service ready to accept traffic?
 *
 * INFRASTRUCTURE: Critical for production deployments
 */

import { checkDatabaseHealth } from './prisma.js';
import { getCacheStats } from './cache.js';
import { logger } from './logger.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: boolean;
    cache: boolean;
  };
  details?: {
    databaseLatency?: number;
    cacheType?: string;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * Liveness Check
 * Returns true if the process is running and responsive
 * Kubernetes will restart the pod if this fails
 */
export async function checkLiveness(): Promise<{ alive: boolean }> {
  // Simple check - if we can execute this, we're alive
  return { alive: true };
}

/**
 * Readiness Check
 * Returns true if the service is ready to accept traffic
 * Kubernetes will remove from load balancer if this fails
 */
export async function checkReadiness(): Promise<{
  ready: boolean;
  checks: { database: boolean; cache: boolean };
}> {
  const startMs = Date.now();

  try {
    // Check database connectivity with timeout
    const dbPromise = Promise.race([
      checkDatabaseHealth(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('DB health check timeout')), 5000)
      ),
    ]).catch((err) => {
      logger.warn({ err }, 'Database health check failed');
      return false;
    });

    // Check cache connectivity with timeout
    const cachePromise = Promise.race([
      getCacheStats().then((stats) => stats.available),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Cache health check timeout')), 2000)
      ),
    ]).catch((err) => {
      logger.warn({ err }, 'Cache health check failed');
      return false;
    });

    const [dbHealthy, cacheHealthy] = await Promise.all([dbPromise, cachePromise]);

    const latency = Date.now() - startMs;
    if (latency > 1000) {
      logger.warn({ latency }, 'Slow readiness check');
    }

    // Service is ready if database is healthy
    // Cache is optional (service degrades gracefully without it)
    return {
      ready: dbHealthy,
      checks: {
        database: dbHealthy,
        cache: cacheHealthy,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Readiness check error');
    return {
      ready: false,
      checks: {
        database: false,
        cache: false,
      },
    };
  }
}

/**
 * Full Health Status
 * Returns detailed health information for monitoring
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const startMs = Date.now();

  try {
    const [dbHealthy, cacheStats] = await Promise.all([
      checkDatabaseHealth().catch(() => false),
      getCacheStats().catch(() => ({ available: false, type: 'none' as const })),
    ]);

    const databaseLatency = Date.now() - startMs;
    const memoryUsage = process.memoryUsage();

    const isHealthy = dbHealthy;
    const isDegraded = !cacheStats.available;

    return {
      status: isHealthy ? (isDegraded ? 'degraded' : 'healthy') : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: dbHealthy,
        cache: cacheStats.available,
      },
      details: {
        databaseLatency,
        cacheType: cacheStats.type,
        memoryUsage,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Health status check error');
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: false,
        cache: false,
      },
    };
  }
}
