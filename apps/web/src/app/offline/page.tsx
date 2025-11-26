/**
 * Offline Page
 *
 * Shown when the user is offline and the requested page isn't cached
 */

'use client';

import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Offline Icon */}
        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-gray-700 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-4">
          You&apos;re Offline
        </h1>

        {/* Description */}
        <p className="text-gray-400 mb-8">
          It looks like you&apos;ve lost your internet connection.
          Don&apos;t worry, you can still browse cached content.
        </p>

        {/* Actions */}
        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary-600 transition-colors"
          >
            Try Again
          </button>

          <Link
            href="/"
            className="block w-full px-6 py-3 bg-gray-700 text-white rounded-xl font-semibold hover:bg-gray-600 transition-colors"
          >
            Go to Home
          </Link>
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 bg-gray-800 rounded-xl text-left">
          <h3 className="text-sm font-semibold text-white mb-2">
            While you&apos;re offline:
          </h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>- View your cached tokens and portfolio</li>
            <li>- Explore previously viewed tokens</li>
            <li>- Transactions will sync when online</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
