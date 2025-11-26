/**
 * GraphQL Resolvers
 * Handles all GraphQL queries and mutations
 */
import type { IResolvers } from 'mercurius';
/**
 * Combine all resolvers
 * IMPORTANT: Order matters - fieldResolvers and feeTypeResolvers contain
 * type-specific resolvers (Token, Pool, User, FeeCollection, etc.)
 * Query and Mutation must be explicitly combined, not spread from feeResolvers
 */
export declare const resolvers: IResolvers;
//# sourceMappingURL=index.d.ts.map