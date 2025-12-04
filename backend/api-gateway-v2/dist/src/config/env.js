/**
 * Environment Configuration with Validation
 * Uses Zod for runtime type checking and validation
 */
import { z } from 'zod';
/**
 * Environment variable schema
 * Add all required environment variables here with validation rules
 */
const envSchema = z.object({
    // Node Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('postgresql://localhost:5432/astro'),
    DIRECT_DATABASE_URL: z.string().optional(),
    // Stellar/Soroban
    STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
    STELLAR_RPC_URL: z.string().default('https://soroban-testnet.stellar.org'),
    // Contracts
    TOKEN_FACTORY_CONTRACT_ID: z.string().default(''),
    AMM_FACTORY_CONTRACT_ID: z.string().optional(),
    // Redis/Cache (Vercel KV or Upstash)
    REDIS_URL: z.string().optional(),
    KV_REST_API_URL: z.string().optional(),
    KV_REST_API_TOKEN: z.string().optional(),
    // API Configuration
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_HOST: z.string().default('0.0.0.0'),
    // CORS - restrict to specific origins in production
    // Format: comma-separated list of allowed origins, e.g., "https://app.astroshiba.io,https://staging.astroshiba.io"
    // SECURITY: localhost origins should only be added in development via environment variable
    CORS_ORIGIN: z.string().default('https://astroshiba.io,https://app.astroshiba.io,https://www.astroshiba.io'),
    // Admin addresses (comma-separated list of Stellar addresses with admin privileges)
    ADMIN_ADDRESSES: z.string().optional(),
    // Admin API Key (required in production for admin mutations)
    ADMIN_API_KEY: z.string().min(32, 'ADMIN_API_KEY must be at least 32 characters').optional(),
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000), // 1 minute
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
    // GraphQL
    GRAPHQL_MAX_DEPTH: z.coerce.number().int().positive().default(10),
    GRAPHQL_MAX_COMPLEXITY: z.coerce.number().int().positive().default(5000),
    // SECURITY: Default to false in production - set GRAPHQL_INTROSPECTION=true for development
    GRAPHQL_INTROSPECTION: z.coerce.boolean().default(false),
    // SECURITY: Default to false in production - set GRAPHQL_PLAYGROUND=true for development
    GRAPHQL_PLAYGROUND: z.coerce.boolean().default(false),
    // Logging
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    LOG_PRETTY: z.coerce.boolean().default(true),
    // Health checks (Kubernetes-compatible)
    HEALTH_PORT: z.coerce.number().int().positive().default(4001),
    // Metrics
    METRICS_ENABLED: z.coerce.boolean().default(true),
    METRICS_PORT: z.coerce.number().int().positive().default(9090),
    // External APIs
    // Pinata (IPFS/File Storage)
    PINATA_API_KEY: z.string().optional(),
    PINATA_API_SECRET: z.string().optional(),
    PINATA_JWT: z.string().optional(),
    // Nuna Labs (AI/ML Services)
    NUNA_API_KEY: z.string().optional(),
    NUNA_API_URL: z.string().url().optional(),
    // GitHub (Source Control)
    GITHUB_TOKEN: z.string().optional(),
    GITHUB_OWNER: z.string().optional(),
    GITHUB_REPO: z.string().optional(),
});
/**
 * Parse and validate environment variables
 * Throws error if validation fails
 */
function parseEnv() {
    try {
        return envSchema.parse(process.env);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            console.error('⚠️  Environment validation warnings:');
            console.error(JSON.stringify(error.errors, null, 2));
            // In production build, use defaults instead of failing
            if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
                console.warn('⚠️  Using default values for missing env vars');
                return envSchema.parse({
                    ...process.env,
                    NODE_ENV: 'production',
                    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/astro',
                    STELLAR_RPC_URL: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
                    TOKEN_FACTORY_CONTRACT_ID: process.env.TOKEN_FACTORY_CONTRACT_ID || '',
                });
            }
            process.exit(1);
        }
        throw error;
    }
}
/**
 * Validated environment configuration
 * Import this in your application code
 */
export const env = parseEnv();
/**
 * Check if running in production
 */
export const isProduction = env.NODE_ENV === 'production';
/**
 * Check if running in development
 */
export const isDevelopment = env.NODE_ENV === 'development';
/**
 * Check if running in test
 */
export const isTest = env.NODE_ENV === 'test';
/**
 * Get database configuration for Prisma
 */
export function getDatabaseConfig() {
    return {
        url: env.DATABASE_URL,
        directUrl: env.DIRECT_DATABASE_URL,
    };
}
/**
 * Get Redis configuration
 */
export function getRedisConfig() {
    // Vercel KV (REST API) - validate URLs properly
    if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
        try {
            new URL(env.KV_REST_API_URL); // Validate URL
            return {
                type: 'vercel-kv',
                url: env.KV_REST_API_URL,
                token: env.KV_REST_API_TOKEN,
            };
        }
        catch {
            console.warn('Invalid KV_REST_API_URL, skipping Redis config');
        }
    }
    // Standard Redis or Upstash
    if (env.REDIS_URL) {
        try {
            new URL(env.REDIS_URL); // Validate URL
            return {
                type: 'redis',
                url: env.REDIS_URL,
            };
        }
        catch {
            console.warn('Invalid REDIS_URL, skipping Redis config');
        }
    }
    console.warn('⚠️  No Redis/KV configuration found - caching will be disabled');
    return null;
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
            ammFactory: env.AMM_FACTORY_CONTRACT_ID || '',
        },
    };
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
    };
}
/**
 * Get logging configuration
 */
export function getLogConfig() {
    return {
        level: env.LOG_LEVEL,
        pretty: env.LOG_PRETTY && isDevelopment,
    };
}
/**
 * Get Pinata configuration
 */
export function getPinataConfig() {
    return {
        apiKey: env.PINATA_API_KEY,
        apiSecret: env.PINATA_API_SECRET,
        jwt: env.PINATA_JWT,
    };
}
/**
 * Get Nuna Labs configuration
 */
export function getNunaConfig() {
    return {
        apiKey: env.NUNA_API_KEY,
        apiUrl: env.NUNA_API_URL,
    };
}
/**
 * Get GitHub configuration
 */
export function getGitHubConfig() {
    return {
        token: env.GITHUB_TOKEN,
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
    };
}
//# sourceMappingURL=env.js.map