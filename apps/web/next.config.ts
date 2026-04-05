import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Bundle analyzer for production optimization
// Usage: ANALYZE=true pnpm build
const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (config: NextConfig) => config;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui'],
  output: 'standalone', // Required for Docker deployment
  experimental: {
    // Optimize package imports for smaller bundles
    // These libraries have many exports - only import what's used
    optimizePackageImports: [
      '@repo/ui',
      'lucide-react',      // Icon library - tree-shake unused icons
      'framer-motion',     // Animation library - tree-shake unused exports
      'date-fns',          // Date library - tree-shake unused functions
      '@apollo/client',    // Apollo - tree-shake unused exports
      '@stellar/stellar-sdk', // Stellar SDK - tree-shake unused exports
    ],
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
          // Content Security Policy - Critical for XSS prevention
          {
            key: 'Content-Security-Policy',
            value: [
              // Default fallback: block everything not explicitly allowed
              "default-src 'self'",
              // Scripts: self + inline (needed for Next.js) + eval (needed for dev)
              process.env.NODE_ENV === 'production'
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Workers: allow blob URLs for lightweight-charts and other libraries
              "worker-src 'self' blob:",
              // Styles: self + inline (for styled-components/emotion)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Images: self + data URIs + IPFS gateways + Stellar + any HTTPS (for token logos)
              "img-src 'self' data: blob: https://gateway.pinata.cloud https://*.pinata.cloud https://ipfs.io https://cloudflare-ipfs.com https://stellar.org https://*.stellar.org https://ui-avatars.com https:",
              // Fonts: self + Google Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // API connections: self + API gateway + Stellar Horizon + Stellar RPC + Sentry + IPFS gateways
              "connect-src 'self' https://api-gateway-v2.vercel.app https://horizon-testnet.stellar.org https://horizon.stellar.org https://soroban-testnet.stellar.org https://soroban.stellar.org https://*.sentry.io wss://*.stellar.org https://gateway.pinata.cloud https://*.pinata.cloud https://ipfs.io https://cloudflare-ipfs.com",
              // Frames: block all (no iframes)
              "frame-ancestors 'none'",
              // Form actions: self only
              "form-action 'self'",
              // Base URI: self only
              "base-uri 'self'",
              // Object/embed: none (legacy Flash prevention)
              "object-src 'none'",
              // Upgrade insecure requests in production
              process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
            ].filter(Boolean).join('; '),
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

// Wrap with Bundle Analyzer (when ANALYZE=true) then Sentry for error monitoring
export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Sentry organization and project
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in production builds
  silent: !process.env.CI,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Tunnel through Next.js to avoid ad blockers
  tunnelRoute: '/monitoring-tunnel',
});
