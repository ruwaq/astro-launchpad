'use client';

/**
 * Error Boundary for Explore Page
 *
 * Catches unhandled errors and provides recovery options
 * Next.js 14+ error boundary pattern
 */

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ExploreError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('[ExploreError] Page error:', error);

    // Send to Sentry if configured
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import('@/lib/sentry').then(({ captureError }) => {
        captureError(error, { context: 'explore_page' });
      }).catch(() => {
        // Silently fail if Sentry module not available
      });
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>

        {/* Error Message */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Failed to Load Tokens
        </h2>
        <p className="text-gray-600 mb-6">
          Something went wrong while loading the explore page.
          This might be a temporary network issue.
        </p>

        {/* Error Details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-3 bg-gray-100 rounded-lg text-left">
            <p className="text-xs text-gray-500 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 mt-1">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white font-medium rounded-xl hover:bg-brand-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>

        {/* Help Text */}
        <p className="mt-8 text-sm text-gray-500">
          If this problem persists, please{' '}
          <a
            href="https://github.com/astro-shiba/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary hover:underline"
          >
            report an issue
          </a>
          .
        </p>
      </div>
    </div>
  );
}
