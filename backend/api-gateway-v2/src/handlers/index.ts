/**
 * Handlers Module - Centralized Exports
 *
 * This module exports all serverless handlers for the API Gateway.
 * Each handler is designed for a specific deployment target (Vercel, Express, etc.)
 *
 * @module handlers
 * @version 2.1.0
 */

// ============================================================================
// Vercel Serverless Handler
// ============================================================================

export {
  default as vercelHandler,
  server as apolloServer,
  isOriginAllowed,
  ALLOWED_ORIGINS,
  API_VERSION as GRAPHQL_API_VERSION,
  config as vercelConfig,
} from './vercel.js';

// ============================================================================
// Health Check Handler
// ============================================================================

export {
  default as healthHandler,
  checkDatabase,
  getTokenStats,
  API_VERSION as HEALTH_API_VERSION,
  config as healthConfig,
  type HealthResponse,
  type TokenStats,
} from './health.js';

// ============================================================================
// Handler Types
// ============================================================================

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Generic serverless handler type
 * Compatible with Vercel, Next.js, and other serverless platforms
 */
export type ServerlessHandler = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void>;

/**
 * Handler configuration type for Next.js/Vercel
 */
export interface HandlerConfig {
  api: {
    bodyParser: boolean;
    externalResolver?: boolean;
  };
}
