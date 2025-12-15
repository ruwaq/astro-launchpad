# Sentry Quick Start Guide

## Setup (5 minutes)

### 1. Get Sentry DSN

```bash
# 1. Go to https://sentry.io and sign up
# 2. Create new project → Select "Next.js"
# 3. Copy your DSN (looks like: https://abc123@o123456.ingest.sentry.io/123456)
```

### 2. Add to Environment

**Local Development (.env.local):**
```bash
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn-here
```

**Vercel Production:**
```bash
# Go to Vercel → Project Settings → Environment Variables
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn-here     # Production + Preview
SENTRY_ORG=your-org-slug                         # Production only
SENTRY_PROJECT=astro-launchpad                   # Production only
SENTRY_AUTH_TOKEN=your-auth-token                # Production only
```

### 3. Deploy

```bash
git add .
git commit -m "feat: configure Sentry error tracking"
git push origin main
```

## Usage

### Automatic Error Tracking

Errors are automatically captured from:
- ✅ React components (via ErrorBoundary)
- ✅ API routes (server-side)
- ✅ Client-side JavaScript errors
- ✅ Logger calls (`logger.error()`, `logger.warn()`)

### Manual Error Tracking

```typescript
import * as Sentry from '@sentry/nextjs';

// Capture exception
try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'trading' },
    extra: { tokenAddress: 'GABC...' },
  });
}

// Capture message
Sentry.captureMessage('Critical event occurred', {
  level: 'warning',
  extra: { userId: '123' },
});
```

### Using Logger (Recommended)

```typescript
import { logger } from '@/lib/logger';

// Automatically sent to Sentry
logger.error('Trade failed', error, { tokenAddress: 'GABC...' });
logger.warn('Slow operation', { duration: 5000 });
```

### ErrorBoundary

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

## Monitoring

### Sentry Dashboard

1. **Issues:** https://sentry.io/issues/
   - View all errors grouped by type
   - See error frequency and affected users

2. **Performance:** https://sentry.io/performance/
   - View slow transactions and API calls
   - Identify performance bottlenecks

3. **Replays:** https://sentry.io/replays/
   - Watch user sessions leading to errors
   - See exact steps to reproduce bugs

## Configuration

All configuration is in:
- `/Users/munay/dev/Astro/astro-launchpad/apps/web/sentry.client.config.ts`
- `/Users/munay/dev/Astro/astro-launchpad/apps/web/sentry.server.config.ts`
- `/Users/munay/dev/Astro/astro-launchpad/apps/web/sentry.edge.config.ts`

**Current settings:**
- Performance: 10% sample rate
- Session replay: 10% normal, 100% on errors
- Privacy: Text masked, media blocked
- Ignored errors: Browser extensions, wallet rejections

## Testing

### Test Error (Development)

```typescript
// Add to any page
<button onClick={() => { throw new Error('Test error'); }}>
  Test Sentry
</button>
```

### Test Error (Production)

```bash
NODE_ENV=production pnpm build
NODE_ENV=production pnpm start
# Then trigger test error
```

## Troubleshooting

### Errors not appearing?

1. Check DSN is set: `echo $NEXT_PUBLIC_SENTRY_DSN`
2. Check environment: `echo $NODE_ENV` (should be "production")
3. Check browser console for Sentry logs
4. Check Sentry dashboard → Project Settings → Client Keys

### Source maps not working?

1. Check `SENTRY_AUTH_TOKEN` is set in Vercel
2. Check Vercel build logs for upload errors
3. Verify `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry project

## Documentation

Full documentation: `/Users/munay/dev/Astro/astro-launchpad/SENTRY_SETUP.md`
