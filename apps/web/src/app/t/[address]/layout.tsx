/**
 * Token Page Layout with Dynamic Metadata
 *
 * SEO: Generates dynamic metadata for token pages
 * This allows sharing tokens on social media with proper preview
 */

import type { Metadata } from 'next';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ address: string }>;
}

/**
 * Generate dynamic metadata for SEO and social sharing
 * Fetches token info server-side to populate meta tags
 */
export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { address } = await params;

  try {
    const token = await sacFactoryService.getTokenInfo(address);

    if (!token) {
      return {
        title: 'Token Not Found - Astro Shiba',
        description: 'This token could not be found on the Stellar network.',
      };
    }

    const title = `${token.name} (${token.symbol}) - Trade on Astro Shiba`;
    const description = token.description
      ? `${token.description.slice(0, 150)}${token.description.length > 150 ? '...' : ''}`
      : `Buy and sell ${token.name} tokens on Stellar's premier bonding curve launchpad.`;

    // Format XLM raised for description
    const xlmRaised = (Number(token.xlm_raised) / 10_000_000).toFixed(2);

    return {
      title,
      description: `${description} ${xlmRaised} XLM raised.`,
      openGraph: {
        title: `${token.name} - Astro Shiba`,
        description,
        images: token.image_url ? [token.image_url] : ['/og-image.png'],
        type: 'website',
        siteName: 'Astro Shiba',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${token.name} (${token.symbol})`,
        description,
        images: token.image_url ? [token.image_url] : ['/og-image.png'],
      },
      // Additional SEO tags
      keywords: [
        token.name,
        token.symbol,
        'Stellar',
        'token',
        'cryptocurrency',
        'bonding curve',
        'DeFi',
        'Astro Shiba',
      ],
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch (error) {
    console.error('[generateMetadata] Error fetching token:', error);
    return {
      title: 'Token - Astro Shiba',
      description: 'Trade tokens on Stellar\'s premier bonding curve launchpad.',
    };
  }
}

export default function TokenLayout({ children }: LayoutProps) {
  return children;
}
