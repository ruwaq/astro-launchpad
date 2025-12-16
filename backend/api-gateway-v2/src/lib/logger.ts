/**
 * Pino Logger Configuration
 * Optimized for development and production
 */

import pino from 'pino'
import { env, isDevelopment } from '../config/env.js'

/**
 * Create logger instance
 */
// Only use pino-pretty transport in development - it's a dev dependency
const usePrettyTransport = env.LOG_PRETTY && isDevelopment;

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: usePrettyTransport
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
          messageFormat: '{levelLabel} - {msg}',
        },
      }
    : undefined,
  // Redact sensitive information
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
})

/**
 * Child logger for specific contexts
 */
export function createChildLogger(context: string) {
  return logger.child({ context })
}
