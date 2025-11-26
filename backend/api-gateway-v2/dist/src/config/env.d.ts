/**
 * Environment Configuration with Validation
 * Uses Zod for runtime type checking and validation
 */
import { z } from 'zod';
/**
 * Environment variable schema
 * Add all required environment variables here with validation rules
 */
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    DATABASE_URL: z.ZodDefault<z.ZodString>;
    DIRECT_DATABASE_URL: z.ZodOptional<z.ZodString>;
    STELLAR_NETWORK: z.ZodDefault<z.ZodEnum<["testnet", "mainnet"]>>;
    STELLAR_RPC_URL: z.ZodDefault<z.ZodString>;
    TOKEN_FACTORY_CONTRACT_ID: z.ZodDefault<z.ZodString>;
    AMM_FACTORY_CONTRACT_ID: z.ZodOptional<z.ZodString>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    KV_REST_API_URL: z.ZodOptional<z.ZodString>;
    KV_REST_API_TOKEN: z.ZodOptional<z.ZodString>;
    API_PORT: z.ZodDefault<z.ZodNumber>;
    API_HOST: z.ZodDefault<z.ZodString>;
    CORS_ORIGIN: z.ZodDefault<z.ZodString>;
    ADMIN_ADDRESSES: z.ZodOptional<z.ZodString>;
    RATE_LIMIT_WINDOW_MS: z.ZodDefault<z.ZodNumber>;
    RATE_LIMIT_MAX_REQUESTS: z.ZodDefault<z.ZodNumber>;
    GRAPHQL_MAX_DEPTH: z.ZodDefault<z.ZodNumber>;
    GRAPHQL_MAX_COMPLEXITY: z.ZodDefault<z.ZodNumber>;
    GRAPHQL_INTROSPECTION: z.ZodDefault<z.ZodBoolean>;
    GRAPHQL_PLAYGROUND: z.ZodDefault<z.ZodBoolean>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
    LOG_PRETTY: z.ZodDefault<z.ZodBoolean>;
    METRICS_ENABLED: z.ZodDefault<z.ZodBoolean>;
    METRICS_PORT: z.ZodDefault<z.ZodNumber>;
    PINATA_API_KEY: z.ZodOptional<z.ZodString>;
    PINATA_API_SECRET: z.ZodOptional<z.ZodString>;
    PINATA_JWT: z.ZodOptional<z.ZodString>;
    NUNA_API_KEY: z.ZodOptional<z.ZodString>;
    NUNA_API_URL: z.ZodOptional<z.ZodString>;
    GITHUB_TOKEN: z.ZodOptional<z.ZodString>;
    GITHUB_OWNER: z.ZodOptional<z.ZodString>;
    GITHUB_REPO: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV?: "production" | "test" | "development";
    ADMIN_ADDRESSES?: string;
    DATABASE_URL?: string;
    DIRECT_DATABASE_URL?: string;
    STELLAR_NETWORK?: "testnet" | "mainnet";
    STELLAR_RPC_URL?: string;
    TOKEN_FACTORY_CONTRACT_ID?: string;
    AMM_FACTORY_CONTRACT_ID?: string;
    REDIS_URL?: string;
    KV_REST_API_URL?: string;
    KV_REST_API_TOKEN?: string;
    API_PORT?: number;
    API_HOST?: string;
    CORS_ORIGIN?: string;
    RATE_LIMIT_WINDOW_MS?: number;
    RATE_LIMIT_MAX_REQUESTS?: number;
    GRAPHQL_MAX_DEPTH?: number;
    GRAPHQL_MAX_COMPLEXITY?: number;
    GRAPHQL_INTROSPECTION?: boolean;
    GRAPHQL_PLAYGROUND?: boolean;
    LOG_LEVEL?: "error" | "warn" | "info" | "fatal" | "debug" | "trace";
    LOG_PRETTY?: boolean;
    METRICS_ENABLED?: boolean;
    METRICS_PORT?: number;
    PINATA_API_KEY?: string;
    PINATA_API_SECRET?: string;
    PINATA_JWT?: string;
    NUNA_API_KEY?: string;
    NUNA_API_URL?: string;
    GITHUB_TOKEN?: string;
    GITHUB_OWNER?: string;
    GITHUB_REPO?: string;
}, {
    NODE_ENV?: "production" | "test" | "development";
    ADMIN_ADDRESSES?: string;
    DATABASE_URL?: string;
    DIRECT_DATABASE_URL?: string;
    STELLAR_NETWORK?: "testnet" | "mainnet";
    STELLAR_RPC_URL?: string;
    TOKEN_FACTORY_CONTRACT_ID?: string;
    AMM_FACTORY_CONTRACT_ID?: string;
    REDIS_URL?: string;
    KV_REST_API_URL?: string;
    KV_REST_API_TOKEN?: string;
    API_PORT?: number;
    API_HOST?: string;
    CORS_ORIGIN?: string;
    RATE_LIMIT_WINDOW_MS?: number;
    RATE_LIMIT_MAX_REQUESTS?: number;
    GRAPHQL_MAX_DEPTH?: number;
    GRAPHQL_MAX_COMPLEXITY?: number;
    GRAPHQL_INTROSPECTION?: boolean;
    GRAPHQL_PLAYGROUND?: boolean;
    LOG_LEVEL?: "error" | "warn" | "info" | "fatal" | "debug" | "trace";
    LOG_PRETTY?: boolean;
    METRICS_ENABLED?: boolean;
    METRICS_PORT?: number;
    PINATA_API_KEY?: string;
    PINATA_API_SECRET?: string;
    PINATA_JWT?: string;
    NUNA_API_KEY?: string;
    NUNA_API_URL?: string;
    GITHUB_TOKEN?: string;
    GITHUB_OWNER?: string;
    GITHUB_REPO?: string;
}>;
/**
 * Parsed and validated environment variables
 */
export type Env = z.infer<typeof envSchema>;
/**
 * Validated environment configuration
 * Import this in your application code
 */
export declare const env: {
    NODE_ENV?: "production" | "test" | "development";
    ADMIN_ADDRESSES?: string;
    DATABASE_URL?: string;
    DIRECT_DATABASE_URL?: string;
    STELLAR_NETWORK?: "testnet" | "mainnet";
    STELLAR_RPC_URL?: string;
    TOKEN_FACTORY_CONTRACT_ID?: string;
    AMM_FACTORY_CONTRACT_ID?: string;
    REDIS_URL?: string;
    KV_REST_API_URL?: string;
    KV_REST_API_TOKEN?: string;
    API_PORT?: number;
    API_HOST?: string;
    CORS_ORIGIN?: string;
    RATE_LIMIT_WINDOW_MS?: number;
    RATE_LIMIT_MAX_REQUESTS?: number;
    GRAPHQL_MAX_DEPTH?: number;
    GRAPHQL_MAX_COMPLEXITY?: number;
    GRAPHQL_INTROSPECTION?: boolean;
    GRAPHQL_PLAYGROUND?: boolean;
    LOG_LEVEL?: "error" | "warn" | "info" | "fatal" | "debug" | "trace";
    LOG_PRETTY?: boolean;
    METRICS_ENABLED?: boolean;
    METRICS_PORT?: number;
    PINATA_API_KEY?: string;
    PINATA_API_SECRET?: string;
    PINATA_JWT?: string;
    NUNA_API_KEY?: string;
    NUNA_API_URL?: string;
    GITHUB_TOKEN?: string;
    GITHUB_OWNER?: string;
    GITHUB_REPO?: string;
};
/**
 * Check if running in production
 */
export declare const isProduction: boolean;
/**
 * Check if running in development
 */
export declare const isDevelopment: boolean;
/**
 * Check if running in test
 */
export declare const isTest: boolean;
/**
 * Get database configuration for Prisma
 */
export declare function getDatabaseConfig(): {
    url: string;
    directUrl: string;
};
/**
 * Get Redis configuration
 */
export declare function getRedisConfig(): {
    type: "vercel-kv";
    url: string;
    token: string;
} | {
    type: "redis";
    url: string;
    token?: undefined;
};
/**
 * Get Stellar network configuration
 */
export declare function getStellarConfig(): {
    network: "testnet" | "mainnet";
    rpcUrl: string;
    contracts: {
        tokenFactory: string;
        ammFactory: string;
    };
};
/**
 * Get API server configuration
 */
export declare function getApiConfig(): {
    port: number;
    host: string;
    cors: {
        origin: string;
    };
    rateLimit: {
        windowMs: number;
        max: number;
    };
    graphql: {
        maxDepth: number;
        maxComplexity: number;
        introspection: boolean;
        playground: boolean;
    };
};
/**
 * Get logging configuration
 */
export declare function getLogConfig(): {
    level: "error" | "warn" | "info" | "fatal" | "debug" | "trace";
    pretty: boolean;
};
/**
 * Get Pinata configuration
 */
export declare function getPinataConfig(): {
    apiKey: string;
    apiSecret: string;
    jwt: string;
};
/**
 * Get Nuna Labs configuration
 */
export declare function getNunaConfig(): {
    apiKey: string;
    apiUrl: string;
};
/**
 * Get GitHub configuration
 */
export declare function getGitHubConfig(): {
    token: string;
    owner: string;
    repo: string;
};
export {};
//# sourceMappingURL=env.d.ts.map