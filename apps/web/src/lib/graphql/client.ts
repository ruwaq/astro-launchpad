/**
 * Apollo Client Configuration
 * Configured for API Gateway V2 with caching and error handling
 */

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// ============================================================================
// Configuration
// ============================================================================

// GraphQL endpoint - ALWAYS use relative path for client-side requests
// Next.js rewrites in next.config.ts handle routing to the correct API
// This prevents localhost URLs from being baked into production builds
const GRAPHQL_ENDPOINT = '/graphql';

// ============================================================================
// Authentication Headers Store
// ============================================================================

// Store for auth headers - updated by WalletContext
let authHeaders: Record<string, string> = {};

/**
 * Set authentication headers for API requests
 * Called by WalletContext when user connects/disconnects wallet
 */
export function setAuthHeaders(headers: Record<string, string>) {
  authHeaders = headers;
}

/**
 * Clear authentication headers
 * Called when user disconnects wallet
 */
export function clearAuthHeaders() {
  authHeaders = {};
}

/**
 * Reset Apollo Client cache
 * Called when user disconnects wallet to clear user-specific cached data
 */
export function resetApolloCache() {
  // Use clearStore for a complete cache reset (safer than resetStore)
  apolloClient.clearStore().catch((err) => {
    console.warn('Failed to clear Apollo cache:', err);
  });
}

// ============================================================================
// Error Link
// ============================================================================

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach((error) => {
      console.error(
        `[GraphQL error]: Message: ${error.message}, Location: ${error.locations}, Path: ${error.path}`
      );
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// ============================================================================
// Auth Link
// ============================================================================

const authLink = setContext((_, { headers }) => {
  return {
    headers: {
      ...headers,
      ...authHeaders,
    },
  };
});

// ============================================================================
// HTTP Link
// ============================================================================

const httpLink = new HttpLink({
  uri: GRAPHQL_ENDPOINT,
  credentials: 'same-origin',
});

// ============================================================================
// Cache Configuration
// ============================================================================

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        tokens: {
          // FIX: Match actual query parameters to prevent cache collisions
          keyArgs: ['orderBy', 'search', 'where'],
          merge(existing, incoming, { args }) {
            // Pagination merge strategy for cursor-based pagination
            if (!existing) return incoming;
            // Only merge if we're paginating (offset > 0 or cursor exists)
            if (!args?.offset && !args?.after) return incoming;

            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        pools: {
          keyArgs: ['orderBy', 'where'],
          merge(existing, incoming, { args }) {
            if (!existing) return incoming;
            if (!args?.offset && !args?.after) return incoming;

            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        transactions: {
          // FIX: Match actual query parameters - address, tokenAddress, type
          keyArgs: ['address', 'tokenAddress', 'type', 'orderBy'],
          merge(existing, incoming, { args }) {
            if (!existing) return incoming;
            // Only merge on pagination
            if (!args?.offset && !args?.after) return incoming;

            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        // Add token single query
        token: {
          keyArgs: ['address'],
        },
      },
    },
    Token: {
      keyFields: ['address'],
    },
    Pool: {
      keyFields: ['address'],
    },
    Transaction: {
      keyFields: ['id'],
    },
  },
});

// ============================================================================
// Apollo Client Instance
// ============================================================================

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clear Apollo cache
 */
export const clearCache = async () => {
  await apolloClient.clearStore();
};

/**
 * Refetch all active queries
 */
export const refetchQueries = async () => {
  await apolloClient.refetchQueries({ include: 'active' });
};

/**
 * Get the Apollo Client instance
 * Use this for standalone queries outside of React components
 */
export function getGraphQLClient() {
  return apolloClient;
}
