/**
 * Prisma Client Access
 * 
 * DEPRECATED: This local implementation has been replaced by the centralized
 * implementation in @astroshibapop/shared.
 * 
 * We re-export everything from shared to maintain backward compatibility
 * with imports while ensuring consistent behavior across the monorepo.
 */

export {
  prisma,
  getPrismaClient,
  disconnectPrisma,
  checkDatabaseHealth,
  CACHE_STRATEGIES
} from '@astroshibapop/shared/prisma';

export type {
  PrismaClientWithAdapter,
  PrismaCacheStrategy
} from '@astroshibapop/shared/prisma';
