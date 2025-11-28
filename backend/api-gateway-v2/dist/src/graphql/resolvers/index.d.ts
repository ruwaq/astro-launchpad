/**
 * GraphQL Resolvers
 * Handles all GraphQL queries and mutations
 */
type IResolvers = Record<string, any>;
/**
 * Combine all resolvers
 * IMPORTANT: Order matters - fieldResolvers and feeTypeResolvers contain
 * type-specific resolvers (Token, Pool, User, FeeCollection, etc.)
 * Query and Mutation must be explicitly combined, not spread from feeResolvers
 */
export declare const resolvers: IResolvers;
export {};
//# sourceMappingURL=index.d.ts.map