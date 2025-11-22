/**
 * Pino Logger Configuration
 * Optimized for development and production
 */

import pino from 'pino'
import { env, isDevelopment } from '@astroshibapop/shared/config'

/**
 * Create logger instance
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.LOG_PRETTY
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
