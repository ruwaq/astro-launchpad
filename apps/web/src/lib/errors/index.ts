/**
 * Centralized Error Handling System
 * 
 * Provides custom error classes, error handling utilities,
 * and integration with monitoring services.
 */

import { logger } from '../logger';
import toast from 'react-hot-toast';

/**
 * Base error class for all custom errors
 */
export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: unknown
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            details: this.details,
        };
    }
}

/**
 * Stellar/Soroban specific errors
 */
export class StellarError extends AppError {
    constructor(message: string, code: string, details?: unknown) {
        super(message, code, 500, details);
    }
}

export class ContractCallError extends StellarError {
    constructor(method: string, contractId: string, details?: Record<string, unknown>) {
        super(
            `Contract call failed: ${method}`,
            'CONTRACT_CALL_FAILED',
            { method, contractId, ...(details || {}) }
        );
    }
}

export class TransactionError extends StellarError {
    constructor(message: string, txHash?: string, details?: Record<string, unknown>) {
        super(message, 'TRANSACTION_FAILED', { txHash, ...(details || {}) });
    }
}

export class InsufficientBalanceError extends StellarError {
    constructor(required: string, available: string) {
        super(
            `Insufficient balance. Required: ${required}, Available: ${available}`,
            'INSUFFICIENT_BALANCE',
            { required, available }
        );
    }
}

/**
 * Error when minimum output cannot be guaranteed due to race conditions.
 * Note: This is NOT slippage - bonding curves are deterministic.
 * This occurs when another trade executed between calculation and submission.
 */
export class MinOutputNotMetError extends StellarError {
    constructor(expected: string, actual: string) {
        super(
            `Minimum output not met. Expected: ${expected}, Actual: ${actual}. Another trade may have executed first.`,
            'MIN_OUTPUT_NOT_MET',
            { expected, actual }
        );
    }
}

/**
 * @deprecated Use MinOutputNotMetError instead. Kept for backwards compatibility.
 */
export const SlippageExceededError = MinOutputNotMetError;

/**
 * Validation errors
 */
export class ValidationError extends AppError {
    constructor(field: string, message: string) {
        super(`Validation failed: ${message}`, 'VALIDATION_ERROR', 400, { field });
    }
}

/**
 * Network errors
 */
export class NetworkError extends AppError {
    constructor(message: string, details?: unknown) {
        super(message, 'NETWORK_ERROR', 503, details);
    }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 'AUTHENTICATION_ERROR', 401);
    }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
    /**
     * Handle error with logging and user notification
     */
    static handle(error: unknown, context?: string): void {
        const errorInfo = this.parseError(error);

        // Log error
        logger.error(
            context ? `${context}: ${errorInfo.message}` : errorInfo.message,
            error,
            { code: errorInfo.code }
        );

        // Show user-friendly message
        this.showUserNotification(errorInfo);

        // Send to monitoring service
        this.reportToMonitoring(error, context);
    }

    /**
     * Parse error into standardized format
     */
    private static parseError(error: unknown): {
        message: string;
        code: string;
        userMessage: string;
    } {
        // Custom app errors
        if (error instanceof AppError) {
            return {
                message: error.message,
                code: error.code,
                userMessage: this.getUserMessage(error),
            };
        }

        // Stellar SDK errors
        if (error instanceof Error && error.name === 'NetworkError') {
            return {
                message: error.message,
                code: 'NETWORK_ERROR',
                userMessage: 'Network error. Please check your connection and try again.',
            };
        }

        // Generic errors
        if (error instanceof Error) {
            return {
                message: error.message,
                code: 'UNKNOWN_ERROR',
                userMessage: 'An unexpected error occurred. Please try again.',
            };
        }

        // Unknown error type
        return {
            message: String(error),
            code: 'UNKNOWN_ERROR',
            userMessage: 'An unexpected error occurred. Please try again.',
        };
    }

    /**
     * Get user-friendly error message
     */
    private static getUserMessage(error: AppError): string {
        const messages: Record<string, string> = {
            CONTRACT_CALL_FAILED: 'Failed to communicate with the blockchain. Please try again.',
            TRANSACTION_FAILED: 'Transaction failed. Please check your wallet and try again.',
            INSUFFICIENT_BALANCE: 'Insufficient balance to complete this transaction.',
            MIN_OUTPUT_NOT_MET: 'Another trade executed first. Please try again.',
            // Deprecated: keep for backwards compatibility
            SLIPPAGE_EXCEEDED: 'Another trade executed first. Please try again.',
            VALIDATION_ERROR: error.message,
            NETWORK_ERROR: 'Network error. Please check your connection.',
            AUTHENTICATION_ERROR: 'Please connect your wallet to continue.',
        };

        return messages[error.code] || error.message;
    }

    /**
     * Show notification to user
     */
    private static showUserNotification(errorInfo: {
        message: string;
        code: string;
        userMessage: string;
    }): void {
        // Don't show toast for authentication errors (handled by UI)
        if (errorInfo.code === 'AUTHENTICATION_ERROR') {
            return;
        }

        toast.error(errorInfo.userMessage, {
            duration: 5000,
            position: 'top-right',
        });
    }

    /**
     * Report error to monitoring service
     */
    private static reportToMonitoring(error: unknown, context?: string): void {
        // TODO: Integrate with Sentry
        // if (process.env.NODE_ENV === 'production') {
        //   Sentry.captureException(error, {
        //     tags: { context },
        //   });
        // }
    }

    /**
     * Async error wrapper
     */
    static async handleAsync<T>(
        fn: () => Promise<T>,
        context?: string
    ): Promise<T | null> {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, context);
            return null;
        }
    }

    /**
     * Sync error wrapper
     */
    static handleSync<T>(fn: () => T, context?: string): T | null {
        try {
            return fn();
        } catch (error) {
            this.handle(error, context);
            return null;
        }
    }
}

/**
 * Error boundary hook for React components
 */
export function useErrorHandler() {
    return {
        handleError: (error: unknown, context?: string) => {
            ErrorHandler.handle(error, context);
        },
        handleAsync: <T,>(fn: () => Promise<T>, context?: string) => {
            return ErrorHandler.handleAsync(fn, context);
        },
    };
}

/**
 * Retry logic for transient errors
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        delayMs?: number;
        backoff?: boolean;
    } = {}
): Promise<T> {
    const { maxRetries = 3, delayMs = 1000, backoff = true } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on validation or auth errors
            if (error instanceof ValidationError || error instanceof AuthenticationError) {
                throw error;
            }

            // Last attempt - throw error
            if (attempt === maxRetries - 1) {
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = backoff ? delayMs * Math.pow(2, attempt) : delayMs;

            logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, {
                delay,
                error: error instanceof Error ? error.message : String(error),
            });

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Type guard for checking error types
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

export function isStellarError(error: unknown): error is StellarError {
    return error instanceof StellarError;
}

export function isNetworkError(error: unknown): boolean {
    return (
        error instanceof NetworkError ||
        (error instanceof Error && error.name === 'NetworkError')
    );
}
