/**
 * Environment Configuration with Validation
 * Uses Zod for runtime type checking and validation
 */

import { z } from 'zod'

/**
 * Environment variable schema
 * Add all required environment variables here with validation rules
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  DIRECT_DATABASE_URL: z.string().url('DIRECT_DATABASE_URL must be a valid URL').optional(),

  // Stellar/Soroban
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  STELLAR_RPC_URL: z.string().url('STELLAR_RPC_URL must be a valid URL'),

  // Contracts
  TOKEN_FACTORY_CONTRACT_ID: z.string().min(1, 'TOKEN_FACTORY_CONTRACT_ID is required'),
  AMM_FACTORY_CONTRACT_ID: z.string().optional(),

  // Redis/Cache (Vercel KV or Upstash)
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),

  // API Configuration
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // GraphQL
  GRAPHQL_MAX_DEPTH: z.coerce.number().int().positive().default(10),
  GRAPHQL_MAX_COMPLEXITY: z.coerce.number().int().positive().default(1000),
  GRAPHQL_INTROSPECTION: z.coerce.boolean().default(true),
  GRAPHQL_PLAYGROUND: z.coerce.boolean().default(true),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),

  // Metrics
  METRICS_ENABLED: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().int().positive().default(9090),
})

/**
 * Parsed and validated environment variables
 */
export type Env = z.infer<typeof envSchema>

/**
 * Parse and validate environment variables
 * Throws error if validation fails
 */
function parseEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:')
      console.error(JSON.stringify(error.errors, null, 2))
      process.exit(1)
    }
    throw error
  }
}

/**
 * Validated environment configuration
 * Import this in your application code
 */
export const env = parseEnv()

/**
 * Check if running in production
 */
export const isProduction = env.NODE_ENV === 'production'

/**
 * Check if running in development
 */
export const isDevelopment = env.NODE_ENV === 'development'

/**
 * Check if running in test
 */
export const isTest = env.NODE_ENV === 'test'

/**
 * Get database configuration for Prisma
 */
export function getDatabaseConfig() {
  return {
    url: env.DATABASE_URL,
    directUrl: env.DIRECT_DATABASE_URL,
  }
}

/**
 * Get Redis configuration
 */
export function getRedisConfig() {
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    // Vercel KV (REST API)
    return {
      type: 'vercel-kv' as const,
      url: env.KV_REST_API_URL,
      token: env.KV_REST_API_TOKEN,
    }
  }

  if (env.REDIS_URL) {
    // Standard Redis or Upstash
    return {
      type: 'redis' as const,
      url: env.REDIS_URL,
    }
  }

  return null
}

/**
 * Get Stellar network configuration
 */
export function getStellarConfig() {
  return {
    network: env.STELLAR_NETWORK,
    rpcUrl: env.STELLAR_RPC_URL,
    contracts: {
      tokenFactory: env.TOKEN_FACTORY_CONTRACT_ID,
      ammFactory: env.AMM_FACTORY_CONTRACT_ID,
    },
  }
}

/**
 * Get API server configuration
 */
export function getApiConfig() {
  return {
    port: env.API_PORT,
    host: env.API_HOST,
    cors: {
      origin: env.CORS_ORIGIN,
    },
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REQUESTS,
    },
    graphql: {
      maxDepth: env.GRAPHQL_MAX_DEPTH,
      maxComplexity: env.GRAPHQL_MAX_COMPLEXITY,
      introspection: env.GRAPHQL_INTROSPECTION,
      playground: env.GRAPHQL_PLAYGROUND,
    },
  }
}

/**
 * Get logging configuration
 */
export function getLogConfig() {
  return {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY && isDevelopment,
  }
}
