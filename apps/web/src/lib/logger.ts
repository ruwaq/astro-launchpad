/**
 * Professional Logging System
 *
 * Provides structured logging with different levels and
 * integration with monitoring services (Sentry, LogRocket, etc.)
 *
 * SECURITY: Sanitizes sensitive data in production to prevent exposure
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: unknown;
}

interface LoggerConfig {
    minLevel: LogLevel;
    enableConsole: boolean;
    enableRemote: boolean;
    remoteEndpoint?: string;
}

// Keys that should be redacted in production logs
const SENSITIVE_KEYS = [
    'password', 'secret', 'token', 'apiKey', 'api_key', 'privateKey', 'private_key',
    'authorization', 'cookie', 'session', 'credentials', 'seed', 'mnemonic',
];

// Patterns that indicate sensitive data (like Stellar addresses, tx hashes)
const SENSITIVE_PATTERNS = [
    /^G[A-Z0-9]{55}$/,  // Stellar public key
    /^S[A-Z0-9]{55}$/,  // Stellar secret key (NEVER log these)
    /^[a-f0-9]{64}$/i,  // Transaction hash
];

class Logger {
    private config: LoggerConfig;
    private readonly levels: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
    };

    constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            enableConsole: true,
            enableRemote: process.env.NODE_ENV === 'production',
            ...config,
        };
    }

    /**
     * Debug level - Development only
     */
    debug(message: string, context?: LogContext): void {
        this.log('debug', message, context);
    }

    /**
     * Info level - General information
     */
    info(message: string, context?: LogContext): void {
        this.log('info', message, context);
    }

    /**
     * Warning level - Potential issues
     */
    warn(message: string, context?: LogContext): void {
        this.log('warn', message, context);
    }

    /**
     * Error level - Errors and exceptions
     */
    error(message: string, error?: unknown, context?: LogContext): void {
        const errorContext: LogContext = {
            ...context,
            error: this.serializeError(error),
        };
        this.log('error', message, errorContext);
    }

    /**
     * Core logging method
     * SECURITY: Sanitizes context in production
     */
    private log(level: LogLevel, message: string, context?: LogContext): void {
        // Check if level is enabled
        if (this.levels[level] < this.levels[this.config.minLevel]) {
            return;
        }

        const isProduction = process.env.NODE_ENV === 'production';

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: isProduction ? this.sanitizeMessage(message) : message,
            context: this.sanitizeContext(context),
            environment: process.env.NODE_ENV,
        };

        // Console logging
        if (this.config.enableConsole) {
            this.logToConsole(level, logEntry);
        }

        // Remote logging (Sentry, LogRocket, etc.)
        if (this.config.enableRemote) {
            this.logToRemote(level, logEntry);
        }
    }

    /**
     * Log to console with colors
     */
    private logToConsole(level: LogLevel, logEntry: unknown): void {
        const styles: Record<LogLevel, string> = {
            debug: 'color: #888',
            info: 'color: #0066cc',
            warn: 'color: #ff9900',
            error: 'color: #cc0000; font-weight: bold',
        };

        const consoleMethod = level === 'error' ? console.error :
            level === 'warn' ? console.warn :
                console.log;

        if (typeof window !== 'undefined') {
            // Browser
            consoleMethod(
                `%c[${level.toUpperCase()}]`,
                styles[level],
                logEntry
            );
        } else {
            // Server
            consoleMethod(`[${level.toUpperCase()}]`, logEntry);
        }
    }

    /**
     * Send logs to remote monitoring service
     */
    private logToRemote(level: LogLevel, logEntry: unknown): void {
        // TODO: Integrate with Sentry
        // if (level === 'error') {
        //   Sentry.captureException(logEntry);
        // } else {
        //   Sentry.captureMessage(JSON.stringify(logEntry));
        // }

        // TODO: Integrate with LogRocket
        // LogRocket.log(level, logEntry);

        // For now, just prepare the structure
        if (this.config.remoteEndpoint) {
            // Send to custom endpoint
            fetch(this.config.remoteEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logEntry),
            }).catch(() => {
                // Silently fail - don't break app due to logging
            });
        }
    }

    /**
     * Serialize error objects for logging
     * SECURITY: Sanitizes stack traces and messages in production
     */
    private serializeError(error: unknown): Record<string, unknown> {
        if (error instanceof Error) {
            const isProduction = process.env.NODE_ENV === 'production';

            return {
                name: error.name,
                message: isProduction ? this.sanitizeMessage(error.message) : error.message,
                // Only include stack traces in development
                ...(isProduction ? {} : { stack: error.stack }),
                // Don't spread unknown properties in production (could contain secrets)
                ...(isProduction ? {} : (error as any)),
            };
        }
        return { error: this.sanitizeValue(error) };
    }

    /**
     * Sanitize a log message to remove sensitive data
     */
    private sanitizeMessage(message: string): string {
        let sanitized = message;

        // Redact Stellar secret keys (CRITICAL - never log these)
        sanitized = sanitized.replace(/S[A-Z0-9]{55}/g, '[REDACTED_SECRET_KEY]');

        // Partially redact Stellar public keys (keep first 4 and last 4 chars)
        sanitized = sanitized.replace(
            /G([A-Z0-9]{4})[A-Z0-9]{47}([A-Z0-9]{4})/g,
            'G$1...$2'
        );

        // Redact transaction hashes
        sanitized = sanitized.replace(
            /[a-f0-9]{64}/gi,
            '[TX_HASH_REDACTED]'
        );

        return sanitized;
    }

    /**
     * Sanitize a value that might be sensitive
     */
    private sanitizeValue(value: unknown): unknown {
        if (typeof value === 'string') {
            // Check for secret keys
            if (/^S[A-Z0-9]{55}$/.test(value)) {
                return '[REDACTED_SECRET_KEY]';
            }
            // Truncate public keys
            if (/^G[A-Z0-9]{55}$/.test(value)) {
                return `${value.slice(0, 5)}...${value.slice(-4)}`;
            }
        }
        return value;
    }

    /**
     * Sanitize context object for production
     */
    private sanitizeContext(context: LogContext | undefined): LogContext | undefined {
        if (!context || process.env.NODE_ENV !== 'production') {
            return context;
        }

        const sanitized: LogContext = {};

        for (const [key, value] of Object.entries(context)) {
            // Check if key is sensitive
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
                sanitized[key] = '[REDACTED]';
                continue;
            }

            // Sanitize value
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeValue(value);
            } else if (typeof value === 'object' && value !== null) {
                // Recursively sanitize nested objects
                sanitized[key] = this.sanitizeContext(value as LogContext);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Create a child logger with context
     */
    child(context: LogContext): Logger {
        const childLogger = new Logger(this.config);
        const originalLog = childLogger.log.bind(childLogger);

        childLogger.log = (level: LogLevel, message: string, additionalContext?: LogContext) => {
            originalLog(level, message, { ...context, ...additionalContext });
        };

        return childLogger;
    }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Domain-specific loggers
 */
export const stellarLogger = logger.child({ domain: 'stellar' });
export const contractLogger = logger.child({ domain: 'contract' });
export const tradingLogger = logger.child({ domain: 'trading' });
export const authLogger = logger.child({ domain: 'auth' });

/**
 * Performance logging utility
 */
export function logPerformance(label: string, fn: () => void): void {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;

    if (duration > 100) {
        logger.warn(`Slow operation: ${label}`, { duration: `${duration.toFixed(2)}ms` });
    } else {
        logger.debug(`Performance: ${label}`, { duration: `${duration.toFixed(2)}ms` });
    }
}

/**
 * Async performance logging
 */
export async function logPerformanceAsync<T>(
    label: string,
    fn: () => Promise<T>
): Promise<T> {
    const start = performance.now();
    try {
        const result = await fn();
        const duration = performance.now() - start;

        if (duration > 1000) {
            logger.warn(`Slow async operation: ${label}`, { duration: `${duration.toFixed(2)}ms` });
        } else {
            logger.debug(`Async performance: ${label}`, { duration: `${duration.toFixed(2)}ms` });
        }

        return result;
    } catch (error) {
        const duration = performance.now() - start;
        logger.error(`Failed async operation: ${label}`, error, { duration: `${duration.toFixed(2)}ms` });
        throw error;
    }
}

export default logger;
