import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry if DSN is configured
const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Only enable in production with DSN
    enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV,
  });
}
