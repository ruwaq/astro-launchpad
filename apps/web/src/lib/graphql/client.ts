/**
 * Apollo Client Configuration
 * Configured for API Gateway V2 with caching and error handling
 */

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

// ============================================================================
// Configuration
// ============================================================================

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

// ============================================================================
// Error Link
// ============================================================================

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }: any) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
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
          keyArgs: ['orderBy', 'where'],
          merge(existing, incoming, { args }) {
            // Pagination merge strategy
            if (!existing) return incoming;
            if (!args?.after) return incoming;

            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            };
          },
        },
        pools: {
          keyArgs: ['orderBy', 'where'],
          merge(existing, incoming, { args }) {
            if (!existing) return incoming;
            if (!args?.after) return incoming;

            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            };
          },
        },
        transactions: {
          keyArgs: ['orderBy', 'where'],
          merge(existing, incoming, { args }) {
            if (!existing) return incoming;
            if (!args?.after) return incoming;

            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            };
          },
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
  link: from([errorLink, httpLink]),
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
