/**
 * Leaderboard Page - Server Component
 *
 * Server-side rendered leaderboard with ISR for optimal performance.
 * Fetches initial data on the server and passes to client component.
 *
 * Benefits:
 * - Faster initial load with SSR data
 * - Better SEO with pre-rendered content
 * - Reduced bundle size
 * - ISR revalidation every 2 minutes
 */

import { LeaderboardClient } from './LeaderboardClient';
import type { Metadata } from 'next';
import type { LeaderboardEntry, Token, GlobalStats } from '@/lib/graphql/types';

// GraphQL endpoint - use explicit GRAPHQL_ENDPOINT or fallback to production
const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ||
  (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/graphql` : null) ||
  'https://api-gateway-v2.vercel.app/graphql';

/**
 * Fetch leaderboard data from GraphQL API
 * Uses ISR with 2-minute revalidation
 */
async function getLeaderboardData(): Promise<{
  leaderboard: LeaderboardEntry[];
  stats: GlobalStats | null;
  topToken: Token | null;
}> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GetLeaderboardData($type: LeaderboardType!, $limit: Int!, $timeframe: TimeFrame!) {
            leaderboard(type: $type, limit: $limit, timeframe: $timeframe) {
              rank
              address
              volume24h
              trades24h
              tokensCreated
              totalVolumeGenerated
              totalLiquidity
              feesEarned24h
              user {
                level
              }
            }
            globalStats {
              totalTokens
              totalVolume24h
              totalUsers
              totalTVL
            }
            tokens(limit: 1, orderBy: VOLUME_DESC, status: BONDING) {
              edges {
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
                  holders
                  xlmRaised
                  graduated
                  createdAt
                }
              }
            }
          }
        `,
        variables: {
          type: 'TRADERS',
          limit: 50,
          timeframe: 'DAY',
        },
      }),
      next: { revalidate: 120 }, // ISR: 2 minutes
    });

    if (!res.ok) {
      console.error('[SSR] Failed to fetch leaderboard data:', res.status);
      return { leaderboard: [], stats: null, topToken: null };
    }

    const { data, errors } = await res.json();

    if (errors) {
      console.error('[SSR] GraphQL errors:', errors);
      return { leaderboard: [], stats: null, topToken: null };
    }

    return {
      leaderboard: data?.leaderboard || [],
      stats: data?.globalStats || null,
      topToken: data?.tokens?.edges?.[0]?.node || null,
    };
  } catch (error) {
    console.error('[SSR] Error fetching leaderboard data:', error);
    return { leaderboard: [], stats: null, topToken: null };
  }
}

/**
 * Generate static metadata for SEO
 */
export const metadata: Metadata = {
  title: 'Leaderboard - Astro Shiba',
  description:
    'Top traders, creators, and liquidity providers on Astro Shiba token launchpad. Compete for rankings and rewards on the Stellar network.',
  keywords: [
    'Leaderboard',
    'Trading',
    'Stellar',
    'Token',
    'DeFi',
    'Rankings',
    'Competition',
  ],
  openGraph: {
    title: 'Leaderboard - Astro Shiba',
    description: 'Top traders and creators on Astro Shiba token launchpad.',
    type: 'website',
    siteName: 'Astro Shiba',
  },
  twitter: {
    card: 'summary',
    title: 'Leaderboard - Astro Shiba',
    description: 'Top traders and creators on Stellar.',
  },
};

/**
 * Leaderboard Page - Server Component
 *
 * This is an async Server Component that:
 * 1. Fetches initial leaderboard, stats, and top token on the server
 * 2. Passes data to LeaderboardClient for interactivity
 * 3. Benefits from ISR (Incremental Static Regeneration)
 */
export default async function LeaderboardPage() {
  // Fetch data on the server
  const { leaderboard, stats, topToken } = await getLeaderboardData();

  // Pass initial data to client component
  return (
    <LeaderboardClient
      initialLeaderboard={leaderboard}
      initialStats={stats}
      initialTopToken={topToken}
    />
  );
}
