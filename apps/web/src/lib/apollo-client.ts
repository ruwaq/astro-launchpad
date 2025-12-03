/**
 * Apollo Client Configuration
 * Connects to GraphQL API Gateway
 */

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

// GraphQL endpoint - uses relative path in production (handled by Vercel rewrites)
// Falls back to environment variable or production API
const GRAPHQL_URI =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/graphql'
    : 'http://localhost:4000');

const httpLink = new HttpLink({
  uri: GRAPHQL_URI,
  credentials: 'same-origin',
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    );
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// Apollo Client instance
export const apolloClient = new ApolloClient({
  link: from([errorLink, httpLink]),
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
