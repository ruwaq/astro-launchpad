/**
 * Pino Logger Configuration
 * Optimized for development and production
 */
import pino from 'pino';
export declare const logger: pino.Logger<never, boolean>;
/**
 * Child logger for specific contexts
 */
export declare function createChildLogger(context: string): pino.Logger<never, boolean>;
//# sourceMappingURL=logger.d.ts.map