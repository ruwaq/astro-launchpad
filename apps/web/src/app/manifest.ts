/**
 * PWA Manifest Configuration
 *
 * Makes the app installable on mobile devices (iOS, Android)
 * and desktop (Windows, macOS, Linux)
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Astro Shiba - Stellar Token Launchpad',
    short_name: 'Astro Shiba',
    description: 'Create and trade meme tokens on Stellar in seconds. Fair launch, bonding curve, instant liquidity.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0f23',
    theme_color: '#fa9427',
    orientation: 'portrait-primary',
    categories: ['finance', 'cryptocurrency', 'defi'],
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/mobile-home.png',
        sizes: '390x844',
        type: 'image/png',
        // @ts-ignore - form_factor is valid in manifest spec
        form_factor: 'narrow',
      },
      {
        src: '/screenshots/desktop-home.png',
        sizes: '1920x1080',
        type: 'image/png',
        // @ts-ignore - form_factor is valid in manifest spec
        form_factor: 'wide',
      },
    ],
    shortcuts: [
      {
        name: 'Create Token',
        short_name: 'Create',
        description: 'Launch a new meme token',
        url: '/create',
        icons: [{ src: '/icons/shortcut-create.png', sizes: '96x96' }],
      },
      {
        name: 'Explore Tokens',
        short_name: 'Explore',
        description: 'Discover trending tokens',
        url: '/explore',
        icons: [{ src: '/icons/shortcut-explore.png', sizes: '96x96' }],
      },
    ],
    related_applications: [
      {
        platform: 'webapp',
        url: 'https://astroshiba.app',
      },
    ],
    prefer_related_applications: false,
  };
}
