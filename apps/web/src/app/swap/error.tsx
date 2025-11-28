'use client';

/**
 * Error Boundary for Swap Page
 *
 * Critical page - needs clear recovery path
 */

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Wallet } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SwapError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[SwapError] Page error:', error);
  }, [error]);

  // Check if it's a wallet-related error
  const isWalletError = error.message?.toLowerCase().includes('wallet') ||
                        error.message?.toLowerCase().includes('connect');

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          {isWalletError ? (
            <Wallet className="w-8 h-8 text-red-600" />
          ) : (
            <AlertCircle className="w-8 h-8 text-red-600" />
          )}
        </div>

        {/* Error Message */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isWalletError ? 'Wallet Connection Issue' : 'Swap Error'}
        </h2>
        <p className="text-gray-600 mb-6">
          {isWalletError
            ? 'Please make sure your wallet is connected and try again.'
            : 'Something went wrong with the swap interface. Your funds are safe.'}
        </p>

        {/* Error Details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-3 bg-gray-100 rounded-lg text-left">
            <p className="text-xs text-gray-500 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white font-medium rounded-xl hover:bg-brand-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>

        {/* Safety Note */}
        <p className="mt-8 text-sm text-gray-500">
          No transaction was submitted. Your wallet balance is unchanged.
        </p>
      </div>
    </div>
  );
}
