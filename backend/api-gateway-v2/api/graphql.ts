/**
 * GraphQL API Endpoint - Vercel Serverless Function
 *
 * This handler serves GraphQL requests on Vercel's serverless platform.
 * It imports directly from the TypeScript source files.
 *
 * Architecture:
 * - Schema & Resolvers: src/graphql/ (SINGLE SOURCE OF TRUTH)
 * - This file: Vercel serverless handler
 *
 * @version 2.1.0
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { schema } from '../src/graphql/schema.js';
import { resolvers } from '../src/graphql/resolvers/index.js';
import { createContext, type GraphQLContext } from '../src/graphql/context.js';
import { validationRules, createComplexityPlugin } from '../src/graphql/validation.js';
import { createRateLimitPlugin } from '../src/lib/rate-limiter.js';
import { logger } from '../src/lib/logger.js';
import { initializeSentry, captureException } from '../src/lib/sentry.js';

// ============================================================================
// Configuration
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';

const ALLOWED_ORIGINS: string[] = [
  'https://astroshiba.io',
  'https://app.astroshiba.io',
  'https://www.astroshiba.io',
  'https://staging.astroshiba.io',
  'https://astro-launchpad-topaz.vercel.app',
  ...(isProduction ? [] : [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  ]),
];

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

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
}

function setCorsHeaders(res: NextApiResponse, origin: string | undefined): void {
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
  }
}

function setSecurityHeaders(res: NextApiResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// ============================================================================
// Apollo Server
// ============================================================================

const server = new ApolloServer<GraphQLContext>({
  typeDefs: schema,
  resolvers: resolvers as any,
  introspection: !isProduction || process.env.GRAPHQL_INTROSPECTION === 'true',
  includeStacktraceInErrorResponses: !isProduction,
  validationRules,
  plugins: [
    createComplexityPlugin(),
    createRateLimitPlugin(),
  ],
  formatError: (formattedError, error) => {
    logger.error({
      message: formattedError.message,
      path: formattedError.path,
      code: formattedError.extensions?.code,
    }, 'GraphQL Error');

    if (error instanceof Error) {
      captureException(error, {
        tags: { component: 'graphql' },
        extra: {
          path: formattedError.path,
          code: formattedError.extensions?.code,
        },
      });
    }

    if (isProduction) {
      return {
        message: formattedError.message,
        path: formattedError.path,
        extensions: {
          code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR',
        },
      };
    }

    return formattedError;
  },
});

// ============================================================================
// Handler
// ============================================================================

const apolloHandler = startServerAndCreateNextHandler(server as any, {
  context: async (req) => {
    initializeSentry();
    return createContext(req as any);
  },
});

export default async function graphqlHandler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const startTime = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  const origin = req.headers.origin as string | undefined;

  setSecurityHeaders(res);
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    if (origin && isOriginAllowed(origin)) {
      res.status(204).end();
    } else {
      logger.warn({ origin, requestId }, 'CORS preflight rejected');
      res.status(403).json({ error: 'CORS origin not allowed' });
    }
    return;
  }

  logger.info({
    requestId,
    method: req.method,
    origin,
    userAgent: req.headers['user-agent'],
  }, 'GraphQL request started');

  try {
    await apolloHandler(req, res);

    const duration = Date.now() - startTime;
    logger.info({ requestId, duration }, 'GraphQL request completed');

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ requestId, duration, error }, 'GraphQL request failed');

    if (error instanceof Error) {
      captureException(error, {
        tags: { handler: 'vercel-graphql' },
        extra: { requestId },
      });
    }

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

export const config = {
  api: {
    bodyParser: false,
  },
};
