import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry if DSN is configured
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Only enable in production with DSN
    enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /extensions\//i,
      /^chrome-extension:\/\//,
      // Network errors users can't control
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // Wallet connection errors (expected)
      'User rejected',
      'User denied',
    ],

    beforeSend(event) {
      // Don't send events in development
      if (process.env.NODE_ENV !== 'production') {
        return null;
      }
      return event;
    },
  });
} else if (process.env.NODE_ENV === 'development') {
  console.log('ℹ️ Sentry (Edge): DSN not configured - error tracking disabled');
}
