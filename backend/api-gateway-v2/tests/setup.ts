/**
 * Test Setup
 * Configures test environment and mocks
 */

import { beforeAll, afterAll, vi } from 'vitest'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'error'
process.env.LOG_PRETTY = 'false'
process.env.API_PORT = '0' // Random port
process.env.API_HOST = '127.0.0.1'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.DIRECT_DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.TOKEN_FACTORY_CONTRACT_ID = 'CBGTG6EKTQ3T2AKZJSQ2CDKUUATWRKGCQXVP6QWXXXXXXXXXXXXXXXXXXX'

// Mock Prisma Client
vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    token: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pool: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  }

  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
  }
})

// Mock shared config
vi.mock('@astroshibapop/shared/config', () => ({
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    LOG_PRETTY: false,
    API_PORT: 0,
    API_HOST: '127.0.0.1',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    TOKEN_FACTORY_CONTRACT_ID: 'CBGTG6EKTQ3T2AKZJSQ2CDKUUATWRKGCQXVP6QWXXXXXXXXXXXXXXXXXXX',
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}))

// Mock shared Prisma utilities
vi.mock('@astroshibapop/shared/prisma', () => ({
  CACHE_STRATEGIES: {
    NO_CACHE: { ttl: 0 },
    SHORT_TTL: { ttl: 60, swr: 30 },
    MEDIUM_TTL: { ttl: 300, swr: 150 },
    LONG_TTL: { ttl: 1800, swr: 900 },
  },
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
}))

beforeAll(() => {
  // Global test setup
})

afterAll(() => {
  // Global test cleanup
  vi.clearAllMocks()
})
