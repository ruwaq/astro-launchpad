/**
 * DataLoader Implementations
 * Batches and caches database queries to prevent N+1 query problems
 *
 * How it works:
 * 1. Multiple resolver calls in a single request collect keys (e.g., token addresses)
 * 2. DataLoader batches all keys into a single database query
 * 3. Results are cached for the duration of the request
 * 4. Dramatically reduces database round-trips
 *
 * Example: Without DataLoader (N+1 problem)
 * - Query: tokens(limit: 10) { creatorUser { address } }
 * - Result: 1 query for tokens + 10 queries for users = 11 queries
 *
 * With DataLoader:
 * - Query: tokens(limit: 10) { creatorUser { address } }
 * - Result: 1 query for tokens + 1 batched query for users = 2 queries
 */
import DataLoader from 'dataloader';
import type { PrismaClientWithAdapter, Token, User, Pool, Achievement } from '../lib/prisma.js';
/**
 * DataLoaders interface
 * All loaders available in GraphQL context
 */
export interface DataLoaders {
    tokenLoader: DataLoader<string, Token | null>;
    userLoader: DataLoader<string, User | null>;
    userByIdLoader: DataLoader<string, User | null>;
    poolLoader: DataLoader<string, Pool | null>;
    tokensByCreatorLoader: DataLoader<string, Token[]>;
    poolsByTokenLoader: DataLoader<string, Pool[]>;
    achievementsByUserIdLoader: DataLoader<string, Achievement[]>;
    graduationEventLoader: DataLoader<string, string | null>;
}
/**
 * Create all DataLoaders for a request
 * Called once per GraphQL request
 *
 * @param prisma - Prisma client instance
 * @returns Object containing all DataLoaders
 */
export declare function createLoaders(prisma: PrismaClientWithAdapter): DataLoaders;
/**
 * Example usage in resolvers:
 *
 * ```typescript
 * // Before (N+1 problem)
 * Token: {
 *   creatorUser: async (parent, args, context) => {
 *     return context.prisma.user.findUnique({
 *       where: { address: parent.creator }
 *     })
 *   }
 * }
 *
 * // After (with DataLoader)
 * Token: {
 *   creatorUser: async (parent, args, context) => {
 *     return context.loaders.userLoader.load(parent.creator)
 *   }
 * }
 * ```
 */
//# sourceMappingURL=loaders.d.ts.map