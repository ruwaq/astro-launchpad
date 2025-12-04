/**
 * Apollo Client Configuration
 * Connects to GraphQL API Gateway
 *
 * Features:
 * - Automatic retry on network failures (RetryLink)
 * - Error logging and handling
 * - Optimized caching policies
 */

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// GraphQL endpoint - ALWAYS use relative path for client-side requests
// Next.js rewrites in next.config.ts handle routing to the correct API
// This prevents localhost URLs from being baked into production builds
const GRAPHQL_URI = '/graphql';

const httpLink = new HttpLink({
  uri: GRAPHQL_URI,
  credentials: 'same-origin',
});

// RESILIENCE: Retry link for transient network failures
// Retries on network errors with exponential backoff
const retryLink = new RetryLink({
  delay: {
    initial: 300, // Start with 300ms delay
    max: 5000,    // Maximum delay of 5 seconds
    jitter: true, // Add randomness to prevent thundering herd
  },
  attempts: {
    max: 3, // Maximum 3 retry attempts
    retryIf: (error, _operation) => {
      // Only retry on network errors, not GraphQL errors
      const isNetworkError = !!error && !error.result;
      const isServerError = error?.statusCode >= 500;

      // Log retry attempts for debugging
      if (isNetworkError || isServerError) {
        console.warn('[Apollo Retry] Retrying request due to:', error?.message || 'Network error');
      }

      return isNetworkError || isServerError;
    },
  },
});

// Error handling link - logs errors for debugging
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}, Operation: ${operation.operationName}`
      )
    );
  }

  if (networkError) {
    // Provide user-friendly error context
    console.error(`[Network error]: ${networkError}`, {
      operation: operation.operationName,
      variables: operation.variables,
    });
  }
});

// Apollo Client instance
// Link chain: errorLink -> retryLink -> httpLink
// Errors are caught first, then retried, then sent to the server
export const apolloClient = new ApolloClient({
  link: from([errorLink, retryLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Token: {
        keyFields: ['address'],
      },
      Pool: {
        keyFields: ['address'],
      },
      User: {
        keyFields: ['address'],
      },
      Transaction: {
        keyFields: ['hash'],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      // PERFORMANCE: Show cached data immediately, update in background
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first', // Subsequent fetches use cache
      errorPolicy: 'all',
    },
    query: {
      // PERFORMANCE: Changed from 'network-only' to 'cache-first'
      // Reads from cache if available, fetches from network otherwise
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
