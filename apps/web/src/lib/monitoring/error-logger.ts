/**
 * Structured Error Logging Service
 *
 * Centralized error tracking with context, severity levels, and monitoring integration.
 * Production-ready with support for external services (Sentry, DataDog, etc.)
 *
 * Pattern: Singleton service with structured logging
 */

import { logger } from '../logger';
import * as Sentry from '@sentry/nextjs';

// Extend Window interface for Sentry
declare global {
  interface Window {
    Sentry: typeof Sentry;
  }
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  CONTRACT_CALL = 'contract_call',
  PARSING = 'parsing',
  VALIDATION = 'validation',
  NETWORK = 'network',
  USER_INPUT = 'user_input',
  CACHE = 'cache',
  BONDING_CURVE = 'bonding_curve',
  WALLET = 'wallet',
  SERVICE_WORKER = 'service_worker',
  UNKNOWN = 'unknown',
}

/**
 * Structured error context
 */
export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
  timestamp?: number;
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
}

/**
 * Error metrics for monitoring
 */
interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Map<ErrorCategory, number>;
  errorsBySeverity: Map<ErrorSeverity, number>;
  lastError?: ErrorContext;
}

/**
 * Error Logger Service
 *
 * Singleton service for centralized error tracking
 */
class ErrorLoggerService {
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByCategory: new Map(),
    errorsBySeverity: new Map(),
  };

  private sessionId: string;
  private isProduction: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Log an error with full context
   */
  log(context: ErrorContext): void {
    // Enrich context with session data
    const enrichedContext: ErrorContext = {
      ...context,
      timestamp: context.timestamp || Date.now(),
      sessionId: this.sessionId,
    };

    // Update metrics
    this.updateMetrics(enrichedContext);

    // Log to console based on severity
    this.logToConsole(enrichedContext);

    // Send to external monitoring (production only)
    if (this.isProduction) {
      this.sendToMonitoring(enrichedContext);
    }

    // Store in local storage for debugging (last 100 errors)
    this.storeInLocalStorage(enrichedContext);
  }

  /**
   * Log contract call error
   */
  logContractError(
    message: string,
    error: unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      category: ErrorCategory.CONTRACT_CALL,
      severity: ErrorSeverity.ERROR,
      message,
      error,
      metadata,
      component: 'ContractService',
    });
  }

  /**
   * Log parsing error
   */
  logParsingError(
    message: string,
    error: unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      category: ErrorCategory.PARSING,
      severity: ErrorSeverity.WARNING,
      message,
      error,
      metadata,
      component: 'Adapter',
    });
  }

  /**
   * Log validation error
   */
  logValidationError(
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.WARNING,
      message,
      metadata,
      component: 'Validator',
    });
  }

  /**
   * Log bonding curve calculation error
   */
  logBondingCurveError(
    message: string,
    error: unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      category: ErrorCategory.BONDING_CURVE,
      severity: ErrorSeverity.ERROR,
      message,
      error,
      metadata,
      component: 'BondingCurveUtils',
    });
  }

  /**
   * Log network error
   */
  logNetworkError(
    message: string,
    error: unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      message,
      error,
      metadata,
    });
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics {
    return {
      ...this.metrics,
      errorsByCategory: new Map(this.metrics.errorsByCategory),
      errorsBySeverity: new Map(this.metrics.errorsBySeverity),
    };
  }

  /**
   * Clear metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: new Map(),
      errorsBySeverity: new Map(),
    };
  }

  /**
   * Get recent errors from local storage
   */
  getRecentErrors(limit: number = 20): ErrorContext[] {
    try {
      const stored = localStorage.getItem('astro-shiba-errors');
      if (!stored) return [];

      const errors = JSON.parse(stored) as ErrorContext[];
      return errors.slice(0, limit);
    } catch {
      return [];
    }
  }

  // Private methods

  private updateMetrics(context: ErrorContext): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = context;

    // Update category count
    const categoryCount = this.metrics.errorsByCategory.get(context.category) || 0;
    this.metrics.errorsByCategory.set(context.category, categoryCount + 1);

    // Update severity count
    const severityCount = this.metrics.errorsBySeverity.get(context.severity) || 0;
    this.metrics.errorsBySeverity.set(context.severity, severityCount + 1);
  }

  private logToConsole(context: ErrorContext): void {
    const prefix = `[${context.category}]`;
    const data = {
      ...context,
      error: this.serializeError(context.error),
    };

    switch (context.severity) {
      case ErrorSeverity.DEBUG:
        logger.debug(`${prefix} ${context.message}`, data);
        break;
      case ErrorSeverity.INFO:
        logger.info(`${prefix} ${context.message}`, data);
        break;
      case ErrorSeverity.WARNING:
        logger.warn(`${prefix} ${context.message}`, data);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        logger.error(`${prefix} ${context.message}`, data);
        break;
    }
  }

  private sendToMonitoring(context: ErrorContext): void {
    // Integrate with Sentry for production monitoring
    if (typeof window !== 'undefined' && window.Sentry) {
      // Map error severity to Sentry level
      const sentryLevel = this.mapSeverityToSentryLevel(context.severity);

      if (context.error instanceof Error) {
        // Capture exception with full context
        window.Sentry.captureException(context.error, {
          level: sentryLevel,
          tags: {
            category: context.category,
            component: context.component || 'unknown',
            action: context.action || 'unknown',
          },
          extra: {
            ...context.metadata,
            message: context.message,
            sessionId: context.sessionId,
            userId: context.userId,
          },
          fingerprint: [
            context.category,
            context.component || 'unknown',
            context.message,
          ],
        });
      } else {
        // Capture message for non-Error objects
        window.Sentry.captureMessage(context.message, {
          level: sentryLevel,
          tags: {
            category: context.category,
            component: context.component || 'unknown',
            action: context.action || 'unknown',
          },
          extra: {
            ...context.metadata,
            error: this.serializeError(context.error),
            sessionId: context.sessionId,
            userId: context.userId,
          },
        });
      }
    }

    // Also log critical errors to console
    if (context.severity === ErrorSeverity.CRITICAL) {
      console.error('[Monitoring] Critical error detected:', context);
    }
  }

  /**
   * Map ErrorSeverity to Sentry severity level
   */
  private mapSeverityToSentryLevel(
    severity: ErrorSeverity
  ): 'debug' | 'info' | 'warning' | 'error' | 'fatal' {
    switch (severity) {
      case ErrorSeverity.DEBUG:
        return 'debug';
      case ErrorSeverity.INFO:
        return 'info';
      case ErrorSeverity.WARNING:
        return 'warning';
      case ErrorSeverity.ERROR:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'fatal';
      default:
        return 'error';
    }
  }

  private storeInLocalStorage(context: ErrorContext): void {
    try {
      const stored = localStorage.getItem('astro-shiba-errors');
      const errors: ErrorContext[] = stored ? JSON.parse(stored) : [];

      // Add new error at the beginning
      errors.unshift({
        ...context,
        error: this.serializeError(context.error),
      });

      // Keep only last 100 errors
      const trimmed = errors.slice(0, 100);

      localStorage.setItem('astro-shiba-errors', JSON.stringify(trimmed));
    } catch (error) {
      // Silent fail - don't break app if localStorage is full
      console.warn('[ErrorLogger] Failed to store error in localStorage:', error);
    }
  }

  private serializeError(error: unknown): unknown {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return error;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Singleton instance
 */
export const errorLogger = new ErrorLoggerService();

/**
 * Helper function to extract error message
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}
