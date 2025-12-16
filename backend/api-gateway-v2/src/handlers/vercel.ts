/**
 * Vercel Serverless Handler for GraphQL API
 *
 * This is the PRODUCTION handler that serves GraphQL requests on Vercel.
 * Uses @as-integrations/next for serverless compatibility while leveraging
 * all features from src/graphql/ (DataLoaders, rate limiting, validation).
 *
 * @module handlers/vercel
 * @version 2.1.0
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { schema } from '../graphql/schema.js';
import { resolvers } from '../graphql/resolvers/index.js';
import { createContext, type GraphQLContext } from '../graphql/context.js';
import { validationRules, createComplexityPlugin } from '../graphql/validation.js';
import { createRateLimitPlugin } from '../lib/rate-limiter.js';
import { logger } from '../lib/logger.js';
import { initializeSentry, captureException } from '../lib/sentry.js';

// ============================================================================
// Configuration
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';
export const API_VERSION = '2.1.0';

/**
 * Allowed CORS origins
 * Production: Only whitelisted domains
 * Development: Include localhost
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  // Production domains
  'https://astroshiba.io',
  'https://app.astroshiba.io',
  'https://www.astroshiba.io',
  'https://staging.astroshiba.io',
  'https://astro-launchpad-topaz.vercel.app',
  // Development (only in non-production)
  ...(isProduction ? [] : [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  ]),
] as const;

/**
 * Allowed headers for CORS
 */
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Request-ID',
  'X-Stellar-Address',
  'X-Stellar-Signature',
  'X-Stellar-Timestamp',
  'X-Admin-Key',
].join(', ');

// ============================================================================
// CORS Utilities
// ============================================================================

/**
 * Check if origin is allowed for CORS
 * Allows exact matches and any *.vercel.app subdomain
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  // Check exact match
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Allow Vercel preview deployments
  if (origin.endsWith('.vercel.app')) return true;

  return false;
}

/**
 * Set CORS headers on response
 */
function setCorsHeaders(
  res: NextApiResponse,
  origin: string | undefined
): void {
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.setHeader('Vary', 'Origin');
  }
}

/**
 * Set security headers on response
 */
function setSecurityHeaders(res: NextApiResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// ============================================================================
// Apollo Server Instance
// ============================================================================

/**
 * Create Apollo Server with all production features
 * - Uses schema and resolvers from src/graphql/
 * - Includes DataLoaders for N+1 prevention
 * - Includes rate limiting and query complexity validation
 */
export const server = new ApolloServer<GraphQLContext>({
  typeDefs: schema,
  resolvers: resolvers as any,

  // Introspection: disabled in production unless explicitly enabled
  introspection: !isProduction || process.env.GRAPHQL_INTROSPECTION === 'true',

  // Stack traces: only in development
  includeStacktraceInErrorResponses: !isProduction,

  // Validation rules (depth limit, complexity limit)
  validationRules,

  // Plugins
  plugins: [
    createComplexityPlugin(),
    createRateLimitPlugin(),
  ],

  // Error formatting
  formatError: (formattedError, error) => {
    // Log all errors
    logger.error({
      message: formattedError.message,
      path: formattedError.path,
      code: formattedError.extensions?.code,
      error,
    }, 'GraphQL Error');

    // Capture in Sentry
    if (error instanceof Error) {
      captureException(error, {
        tags: { component: 'graphql' },
        extra: {
          path: formattedError.path,
          code: formattedError.extensions?.code,
        },
      });
    }

    // Production: sanitize error response
    if (isProduction) {
      return {
        message: formattedError.message,
        path: formattedError.path,
        extensions: {
          code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR',
        },
      };
    }

    // Development: full error details
    return formattedError;
  },
});

// ============================================================================
// Handler Creation
// ============================================================================

/**
 * Create Next.js compatible handler
 * Uses @as-integrations/next for serverless compatibility
 */
// Note: Type assertion needed due to ESM/CJS module type mismatch in Apollo Server
const apolloHandler = startServerAndCreateNextHandler(server as any, {
  context: async (req) => {
    // Initialize Sentry for this request
    initializeSentry();

    // Create context with Prisma, DataLoaders, and auth
    return createContext(req as any);
  },
});

// ============================================================================
// Request Handler
// ============================================================================

/**
 * Main GraphQL handler for Vercel serverless functions
 *
 * Features:
 * - CORS with whitelist validation
 * - Security headers
 * - Preflight (OPTIONS) handling
 * - Request logging
 * - Error handling with Sentry
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function graphqlHandler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const startTime = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  const origin = req.headers.origin as string | undefined;

  // Set security headers on all responses
  setSecurityHeaders(res);

  // Set CORS headers
  setCorsHeaders(res, origin);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    if (origin && isOriginAllowed(origin)) {
      res.status(204).end();
    } else {
      logger.warn({ origin, requestId }, 'CORS preflight rejected');
      res.status(403).json({ error: 'CORS origin not allowed' });
    }
    return;
  }

  // Log request start
  logger.info({
    requestId,
    method: req.method,
    origin,
    userAgent: req.headers['user-agent'],
  }, 'GraphQL request started');

  try {
    // Delegate to Apollo handler
    await apolloHandler(req, res);

    // Log request completion
    const duration = Date.now() - startTime;
    logger.info({
      requestId,
      duration,
      status: 'completed',
    }, 'GraphQL request completed');

  } catch (error) {
    // Log and capture error
    const duration = Date.now() - startTime;
    logger.error({
      requestId,
      duration,
      error,
    }, 'GraphQL request failed');

    if (error instanceof Error) {
      captureException(error, {
        tags: { handler: 'vercel-graphql' },
        extra: { requestId },
      });
    }

    // Send error response if not already sent
    if (!res.writableEnded) {
      res.status(500).json({
        errors: [{
          message: isProduction ? 'Internal server error' : (error as Error).message,
          extensions: { code: 'INTERNAL_SERVER_ERROR', requestId },
        }],
      });
    }
  }
}

/**
 * Vercel/Next.js API route configuration
 * Disable body parser - Apollo handles it
 */
export const config = {
  api: {
    bodyParser: false,
  },
};
