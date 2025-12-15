/**
 * Sentry Error Tracking Integration
 *
 * Provides centralized error tracking and monitoring for the API Gateway.
 * Integrates with Sentry for production error reporting.
 *
 * Pattern: Middleware-based error handling
 */

import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

/**
 * Initialize Sentry with configuration
 * Call this early in the application lifecycle
 */
export function initializeSentry(): void {
  const SENTRY_DSN = process.env.SENTRY_DSN;

  if (!SENTRY_DSN) {
    if (process.env.NODE_ENV === 'development') {
      logger.info('ℹ️ Sentry: DSN not configured - error tracking disabled');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Only enable in production
    enabled: process.env.NODE_ENV === 'production',

    // Filter out noisy errors
    ignoreErrors: [
      // GraphQL validation errors (expected)
      'GraphQLError',
      // Network errors users can't control
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
    ],

    beforeSend(event, hint) {
      // Don't send events in development
      if (process.env.NODE_ENV !== 'production') {
        return null;
      }

      // Log error before sending
      logger.error(
        {
          eventId: event.event_id,
          error: hint.originalException,
        },
        'Sentry event captured'
      );

      return event;
    },
  });

  logger.info('✅ Sentry initialized successfully');
}

/**
 * Express middleware to capture request context in Sentry
 * Note: This is a placeholder for Sentry v10+
 * Sentry SDK automatically instruments Express in v10+
 */
export function sentryRequestHandler() {
  // In Sentry v10+, request handling is automatic
  // Return a no-op middleware for compatibility
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

/**
 * Express middleware to capture errors and send to Sentry
 * Note: Updated for Sentry v10+ API
 */
export function sentryErrorHandler() {
  // In Sentry v10+, use setupExpressErrorHandler from index
  // For now, return custom error handler
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    // Capture error in Sentry
    Sentry.captureException(error, {
      tags: {
        path: req.path,
        method: req.method,
      },
      extra: {
        query: req.query,
        body: req.body,
      },
      user: {
        ip_address: req.ip,
      },
    });

    next(error);
  };
}

/**
 * Custom Express error handler with Sentry integration
 */
export function errorHandlerMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Capture error in Sentry with context
  Sentry.captureException(error, {
    tags: {
      path: req.path,
      method: req.method,
    },
    extra: {
      query: req.query,
      body: req.body,
      headers: req.headers,
    },
    user: {
      ip_address: req.ip,
    },
  });

  // Log error
  logger.error(
    {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    },
    'Express error handler caught error'
  );

  // Send error response
  const statusCode = (error as any).statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: error.stack,
    }),
  });
}

/**
 * Helper to capture a message to Sentry
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Helper to capture an exception to Sentry
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }
): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  Sentry.captureException(error, {
    level: context?.level || 'error',
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Set user context for Sentry
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
}): void {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Flush pending Sentry events
 * Useful before shutting down the server
 */
export async function flush(timeout: number = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}
