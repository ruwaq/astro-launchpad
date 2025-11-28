/**
 * Dynamic Sitemap Generator
 *
 * SEO: Generates sitemap.xml with all static and dynamic routes
 * Includes token pages from the blockchain
 */

import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://astro-shiba.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/create`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/swap`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/portfolio`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ];

  // Note: Dynamic token routes can be added here when a getAllTokens endpoint is available
  // For now, token pages are discoverable through internal links and the explore page
  // Example implementation when available:
  // const tokenAddresses = await fetchAllTokenAddresses();
  // const tokenRoutes = tokenAddresses.map((address: string) => ({
  //   url: `${BASE_URL}/t/${address}`,
  //   lastModified: new Date(),
  //   changeFrequency: 'hourly' as const,
  //   priority: 0.7,
  // }));

  return staticRoutes;
}
