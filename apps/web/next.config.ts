import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui'],
  output: 'standalone', // Required for Docker deployment
  experimental: {
    optimizePackageImports: ['@repo/ui'],
  },

  // API rewrites - proxy /graphql to the API Gateway
  // IMPORTANT: Always use production API URL for server-side rewrites
  // Local development should use .env.local with NEXT_PUBLIC_API_GATEWAY_URL override if needed
  async rewrites() {
    // Use explicit production URL - don't rely on env vars that might be misconfigured
    const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api-gateway-v2.vercel.app/graphql';

    return [
      {
        source: '/graphql',
        destination: apiUrl,
      },
    ];
  },

  // Webpack configuration to handle native modules (sodium-native)
  // This prevents Fast Refresh from doing full reloads
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't try to bundle native modules on the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Ignore native module warnings
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/sodium-native/ },
      { module: /node_modules\/require-addon/ },
    ];

    return config;
  },

  // PWA and Security Headers
  async headers() {
    return [
      // Global security headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Service worker headers
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      // Manifest headers
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },

  // Image optimization for external domains (IPFS gateways + Stellar + any)
  images: {
    // Prefer modern formats for better performance
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Image sizes for smaller images
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: '*.pinata.cloud',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'stellar.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.stellar.org',
        pathname: '/**',
      },
      // Allow any HTTPS image for user-submitted token logos
      {
        protocol: 'https',
        hostname: '**',
      },
      // UI Avatars for placeholder images
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
    ],
  },
};

export default nextConfig;
