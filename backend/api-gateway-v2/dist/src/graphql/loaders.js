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
import { CACHE_STRATEGIES } from '@astroshibapop/shared/prisma';
/**
 * Token Loader
 * Batches token lookups by address
 */
function createTokenLoader(prisma) {
    return new DataLoader(async (addresses) => {
        const tokens = await prisma.token.findMany({
            where: { address: { in: [...addresses] } },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
        // Create a map for O(1) lookups
        const tokenMap = new Map(tokens.map((token) => [token.address, token]));
        // Return tokens in the same order as requested addresses
        return addresses.map((address) => tokenMap.get(address) || null);
    });
}
/**
 * User Loader
 * Batches user lookups by address
 */
function createUserLoader(prisma) {
    return new DataLoader(async (addresses) => {
        const users = await prisma.user.findMany({
            where: { address: { in: [...addresses] } },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
        const userMap = new Map(users.map((user) => [user.address, user]));
        return addresses.map((address) => userMap.get(address) || null);
    });
}
/**
 * User By ID Loader
 * Batches user lookups by ID
 */
function createUserByIdLoader(prisma) {
    return new DataLoader(async (ids) => {
        const users = await prisma.user.findMany({
            where: { id: { in: [...ids] } },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
        const userMap = new Map(users.map((user) => [user.id, user]));
        return ids.map((id) => userMap.get(id) || null);
    });
}
/**
 * Pool Loader
 * Batches pool lookups by address
 */
function createPoolLoader(prisma) {
    return new DataLoader(async (addresses) => {
        const pools = await prisma.pool.findMany({
            where: { address: { in: [...addresses] } },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
        const poolMap = new Map(pools.map((pool) => [pool.address, pool]));
        return addresses.map((address) => poolMap.get(address) || null);
    });
}
/**
 * Tokens By Creator Loader
 * Batches token lookups by creator address
 * Returns array of tokens for each creator
 */
function createTokensByCreatorLoader(prisma) {
    return new DataLoader(async (creatorAddresses) => {
        const tokens = await prisma.token.findMany({
            where: { creator: { in: [...creatorAddresses] } },
            orderBy: { createdAt: 'desc' },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
        // Group tokens by creator
        const tokensByCreator = new Map();
        for (const token of tokens) {
            const existing = tokensByCreator.get(token.creator) || [];
            existing.push(token);
            tokensByCreator.set(token.creator, existing);
        }
        // Return tokens in the same order as requested creators
        return creatorAddresses.map((creator) => tokensByCreator.get(creator) || []);
    });
}
/**
 * Pools By Token Loader
 * Batches pool lookups by token address
 * Returns array of pools that contain the token (as token0 or token1)
 */
function createPoolsByTokenLoader(prisma) {
    return new DataLoader(async (tokenAddresses) => {
        const pools = await prisma.pool.findMany({
            where: {
                OR: [
                    { token0Address: { in: [...tokenAddresses] } },
                    { token1Address: { in: [...tokenAddresses] } },
                ],
            },
            cacheStrategy: CACHE_STRATEGIES.MEDIUM_TTL,
        });
        // Group pools by token address
        const poolsByToken = new Map();
        for (const pool of pools) {
            // Add to token0
            const existing0 = poolsByToken.get(pool.token0Address) || [];
            existing0.push(pool);
            poolsByToken.set(pool.token0Address, existing0);
            // Add to token1
            const existing1 = poolsByToken.get(pool.token1Address) || [];
            existing1.push(pool);
            poolsByToken.set(pool.token1Address, existing1);
        }
        // Return pools in the same order as requested token addresses
        return tokenAddresses.map((address) => poolsByToken.get(address) || []);
    });
}
/**
 * Achievements By User ID Loader
 * Batches achievement lookups by user ID
 * Returns array of achievements for each user
 */
function createAchievementsByUserIdLoader(prisma) {
    return new DataLoader(async (userIds) => {
        const achievements = await prisma.achievement.findMany({
            where: { userId: { in: [...userIds] } },
            cacheStrategy: CACHE_STRATEGIES.LONG_TTL,
        });
        // Group achievements by user ID
        const achievementsByUser = new Map();
        for (const achievement of achievements) {
            const existing = achievementsByUser.get(achievement.userId) || [];
            existing.push(achievement);
            achievementsByUser.set(achievement.userId, existing);
        }
        // Return achievements in the same order as requested user IDs
        return userIds.map((userId) => achievementsByUser.get(userId) || []);
    });
}
/**
 * Create all DataLoaders for a request
 * Called once per GraphQL request
 *
 * @param prisma - Prisma client instance
 * @returns Object containing all DataLoaders
 */
export function createLoaders(prisma) {
    return {
        tokenLoader: createTokenLoader(prisma),
        userLoader: createUserLoader(prisma),
        userByIdLoader: createUserByIdLoader(prisma),
        poolLoader: createPoolLoader(prisma),
        tokensByCreatorLoader: createTokensByCreatorLoader(prisma),
        poolsByTokenLoader: createPoolsByTokenLoader(prisma),
        achievementsByUserIdLoader: createAchievementsByUserIdLoader(prisma),
    };
}
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
//# sourceMappingURL=loaders.js.map