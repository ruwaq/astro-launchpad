/**
 * Professional Logging System
 * 
 * Provides structured logging with different levels and
 * integration with monitoring services (Sentry, LogRocket, etc.)
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
     */
    private log(level: LogLevel, message: string, context?: LogContext): void {
        // Check if level is enabled
        if (this.levels[level] < this.levels[this.config.minLevel]) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
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
     */
    private serializeError(error: unknown): Record<string, unknown> {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack,
                ...(error as any), // Capture custom properties
            };
        }
        return { error };
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
