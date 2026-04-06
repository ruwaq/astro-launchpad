/**
 * Explore Page - Server Component
 *
 * Server-side rendered token exploration with ISR for optimal performance.
 * Fetches initial data on the server and passes to client component.
 *
 * Benefits:
 * - Faster initial load with SSR data (24 tokens pre-loaded)
 * - Better SEO with pre-rendered token list
 * - Reduced bundle size
 * - ISR revalidation every 60 seconds
 */

import { ExploreClient } from './ExploreClient';
import type { Metadata } from 'next';
import type { TokenEdge, PageInfo } from '@/lib/graphql/types';
import { GRAPHQL_ENDPOINT } from '@/lib/constants/app';

const GRAPHQL_URL = GRAPHQL_ENDPOINT;

interface TokensConnection {
  edges: TokenEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

/**
 * Fetch initial tokens from GraphQL API
 * Uses ISR with 60-second revalidation
 */
async function getInitialTokens(): Promise<TokensConnection> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GetAllTokens($limit: Int!, $orderBy: TokenOrderBy!) {
            tokens(limit: $limit, orderBy: $orderBy) {
              edges {
                cursor
                node {
                  address
                  name
                  symbol
                  imageUrl
                  logoUrl
                  currentPrice
                  priceChange24h
                  volume24h
                  marketCap
                  circulatingSupply
                  xlmRaised
                  xlmReserve
                  graduated
                  createdAt
                }
              }
              pageInfo {
                hasNextPage
                hasPreviousPage
                endCursor
              }
              totalCount
            }
          }
        `,
        variables: {
          limit: 24,
          orderBy: 'CREATED_AT_DESC',
        },
      }),
      next: { revalidate: 60 }, // ISR: 1 minute
    });

    if (!res.ok) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null },
        totalCount: 0,
      };
    }

    const { data, errors } = await res.json();

    if (errors) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null },
        totalCount: 0,
      };
    }

    return {
      edges: data?.tokens?.edges || [],
      pageInfo: data?.tokens?.pageInfo || { hasNextPage: false, hasPreviousPage: false, endCursor: null },
      totalCount: data?.tokens?.totalCount || 0,
    };
  } catch {
    return {
      edges: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null },
      totalCount: 0,
    };
  }
}

/**
 * Generate static metadata for SEO
 */
export const metadata: Metadata = {
  title: 'Explore Tokens - Astro Shiba',
  description:
    'Discover and trade real SAC tokens on Stellar Testnet. Browse trending tokens, new launches, and graduated tokens on the Astro Shiba launchpad.',
  keywords: [
    'Stellar',
    'Soroban',
    'Token',
    'DeFi',
    'Trading',
    'Bonding Curve',
    'SAC',
    'Explore',
  ],
  openGraph: {
    title: 'Explore Tokens - Astro Shiba',
    description: 'Discover and trade real SAC tokens on Stellar.',
    type: 'website',
    siteName: 'Astro Shiba',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore Tokens - Astro Shiba',
    description: 'Discover and trade real SAC tokens on Stellar Testnet.',
  },
};

/**
 * Explore Page - Server Component
 *
 * This is an async Server Component that:
 * 1. Fetches initial 24 tokens on the server
 * 2. Passes data to ExploreClient for interactivity
 * 3. Benefits from ISR (Incremental Static Regeneration)
 */
export default async function ExplorePage() {
  // Fetch data on the server
  const initialTokens = await getInitialTokens();

  // Pass initial data to client component
  return <ExploreClient initialTokens={initialTokens} />;
}
