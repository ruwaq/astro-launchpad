/**
 * Create Token Page - Server Component
 *
 * Server component that renders the CreateClient component.
 * Metadata is generated for SEO.
 */

import type { Metadata } from 'next';
import { CreateClient } from './CreateClient';

export const metadata: Metadata = {
  title: 'Create Token - Astro Shiba',
  description:
    'Launch your own SAC token on Stellar with a bonding curve. Create a token in seconds with real Soroban smart contracts.',
  keywords: [
    'Stellar',
    'Soroban',
    'Create Token',
    'Launch Token',
    'SAC',
    'Bonding Curve',
    'DeFi',
  ],
  openGraph: {
    title: 'Create Token - Astro Shiba',
    description: 'Launch your own SAC token on Stellar.',
    type: 'website',
    siteName: 'Astro Shiba',
  },
};

export default function CreatePage() {
  return <CreateClient />;
}