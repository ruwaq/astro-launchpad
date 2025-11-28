'use client';

/**
 * Error Boundary for Token Detail Page
 *
 * Catches errors when loading individual token data
 */

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TokenError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[TokenError] Page error:', error);
  }, [error]);

  // Check if it's a "not found" type error
  const isNotFound = error.message?.toLowerCase().includes('not found') ||
                     error.message?.toLowerCase().includes('invalid');

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>

        {/* Error Message */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isNotFound ? 'Token Not Found' : 'Failed to Load Token'}
        </h2>
        <p className="text-gray-600 mb-6">
          {isNotFound
            ? 'This token may have been removed or the address is invalid.'
            : 'Something went wrong while loading this token. Please try again.'}
        </p>

        {/* Error Details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-3 bg-gray-100 rounded-lg text-left">
            <p className="text-xs text-gray-500 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!isNotFound && (
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white font-medium rounded-xl hover:bg-brand-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Explore
          </Link>
        </div>
      </div>
    </div>
  );
}
