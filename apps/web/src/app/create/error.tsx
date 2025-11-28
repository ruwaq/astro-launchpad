'use client';

/**
 * Error Boundary for Token Creation Page
 *
 * CRITICAL: Token creation is a high-stakes operation.
 * Ensure clear messaging about transaction status.
 */

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home, HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CreateTokenError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('[CreateTokenError] Page error:', error);
  }, [error]);

  // Determine error type for better messaging
  const isWalletError = error.message?.toLowerCase().includes('wallet') ||
                        error.message?.toLowerCase().includes('connect');
  const isNetworkError = error.message?.toLowerCase().includes('network') ||
                         error.message?.toLowerCase().includes('rpc') ||
                         error.message?.toLowerCase().includes('timeout');
  const isTransactionError = error.message?.toLowerCase().includes('transaction') ||
                             error.message?.toLowerCase().includes('submit');

  const getErrorTitle = () => {
    if (isWalletError) return 'Wallet Connection Issue';
    if (isNetworkError) return 'Network Error';
    if (isTransactionError) return 'Transaction Error';
    return 'Something Went Wrong';
  };

  const getErrorMessage = () => {
    if (isWalletError) {
      return 'Please ensure your wallet is connected and try again. Your token has not been created yet.';
    }
    if (isNetworkError) {
      return 'Unable to connect to Stellar network. Please check your connection and try again.';
    }
    if (isTransactionError) {
      return 'There was an issue with the transaction. If you signed a transaction, please check your wallet history before retrying.';
    }
    return 'An unexpected error occurred. No transaction was submitted. Please try again.';
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Error Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>

          {/* Error Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {getErrorTitle()}
          </h2>

          {/* Error Message */}
          <p className="text-gray-600 mb-6">
            {getErrorMessage()}
          </p>

          {/* Important Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm text-amber-800 font-medium">Important</p>
                <p className="text-sm text-amber-700 mt-1">
                  If you already signed a transaction in your wallet, check your wallet history
                  before creating a new token to avoid duplicates.
                </p>
              </div>
            </div>
          </div>

          {/* Error Details (dev only) */}
          {process.env.NODE_ENV === 'development' && error.message && (
            <div className="mb-6 p-3 bg-gray-100 rounded-lg text-left">
              <p className="text-xs text-gray-500 font-mono break-all">
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
        </div>

        {/* Safety Note */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Need help? Check our{' '}
          <a href="/docs/token-creation" className="text-brand-primary hover:underline">
            token creation guide
          </a>{' '}
          or contact support.
        </p>
      </div>
    </div>
  );
}
