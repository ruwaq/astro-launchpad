/**
 * Home Page - Server Component
 *
 * Server-side rendered landing page with ISR for optimal performance.
 * Fetches initial data on the server and passes to client component.
 *
 * Benefits:
 * - Faster FCP/LCP with SSR
 * - Better SEO with pre-rendered content
 * - Reduced bundle size (server code not shipped)
 * - ISR revalidation every 5 minutes
 *
 * Contract: CC3OFGFRFYZ4XN5AWTQNSZBEA4AP62GKHYF6YUFSMM2B4A6VUQLU3ZPV
 */

import { HomeClient } from './HomeClient';
import type { Metadata } from 'next';

// GraphQL endpoint
const GRAPHQL_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-gateway-v2.vercel.app/graphql';

/**
 * Fetch token count from GraphQL API
 * Uses ISR with 5-minute revalidation
 */
async function getTokenCount(): Promise<number> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GlobalStats {
            globalStats {
              totalTokens
            }
          }
        `,
      }),
      next: { revalidate: 300 }, // ISR: 5 minutes
    });

    if (!res.ok) {
      console.error('[SSR] Failed to fetch token count:', res.status);
      return 0;
    }

    const { data, errors } = await res.json();

    if (errors) {
      console.error('[SSR] GraphQL errors:', errors);
      return 0;
    }

    return data?.globalStats?.totalTokens ?? 0;
  } catch (error) {
    console.error('[SSR] Error fetching token count:', error);
    return 0;
  }
}

/**
 * Generate static metadata for SEO
 */
export const metadata: Metadata = {
  title: 'Astro Shiba - Launch Tokens Instantly on Stellar',
  description:
    'Fair launch platform with bonding curves, automatic graduation to AMM, and permanent liquidity locks. Zero pre-mints, 100% on-chain.',
  keywords: [
    'Stellar',
    'Soroban',
    'Token Launch',
    'Bonding Curve',
    'DeFi',
    'AMM',
    'Cryptocurrency',
    'Fair Launch',
  ],
  openGraph: {
    title: 'Astro Shiba - Token Launchpad on Stellar',
    description:
      'Launch tokens instantly with fair bonding curves. Auto-graduation to AMM with permanent liquidity locks.',
    images: [
      {
        url: '/images/personajeastroslatando.png',
        width: 500,
        height: 500,
        alt: 'Astro Shiba Character',
      },
    ],
    type: 'website',
    siteName: 'Astro Shiba',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Astro Shiba - Token Launchpad',
    description: 'Launch tokens instantly on Stellar with fair bonding curves.',
    images: ['/images/personajeastroslatando.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Home Page - Server Component
 *
 * This is an async Server Component that:
 * 1. Fetches initial data on the server
 * 2. Passes data to HomeClient for interactivity
 * 3. Benefits from ISR (Incremental Static Regeneration)
 */
export default async function HomePage() {
  // Fetch data on the server
  const tokenCount = await getTokenCount();

  // Pass initial data to client component
  return <HomeClient initialTokenCount={tokenCount} />;
}
