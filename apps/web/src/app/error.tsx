'use client';

/**
 * Global Error Boundary
 *
 * Catches unhandled errors at the root level and provides recovery options.
 * This is the last line of defense for any uncaught errors in the app.
 */

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service
    logger.error('Unhandled application error', error, {
      digest: error.digest,
      context: 'GlobalError',
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Error Icon */}
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-8">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>

        {/* Error Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-8 text-lg">
          We encountered an unexpected error. Our team has been notified
          and we&apos;re working on a fix.
        </p>

        {/* Error Details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-8 p-4 bg-gray-100 rounded-xl text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">Error Details:</p>
            <p className="text-xs text-gray-600 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary/90 transition-colors shadow-lg shadow-brand-primary/25"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>

        {/* Help Text */}
        <p className="mt-10 text-sm text-gray-500">
          If this problem persists, please{' '}
          <a
            href="https://github.com/astro-shiba/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary hover:underline font-medium"
          >
            report an issue
          </a>{' '}
          or contact support.
        </p>
      </div>
    </div>
  );
}
