'use client';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the app.
 *
 * Usage:
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Custom error message */
  errorMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, errorMessage } = this.props;

    if (hasError) {
      // Custom fallback provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <svg
            className="mb-4 h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>

          <h3 className="mb-2 text-lg font-semibold text-red-400">
            {errorMessage || 'Something went wrong'}
          </h3>

          <p className="mb-4 text-sm text-gray-400">
            {error?.message || 'An unexpected error occurred'}
          </p>

          <button
            onClick={this.handleRetry}
            className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
          >
            Try Again
          </button>
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook-based error boundary reset
 * Use this to programmatically reset error boundaries from child components
 */
export function useErrorBoundaryReset(): () => void {
  return () => {
    // This is a placeholder - actual reset is handled by the component
    console.warn('[ErrorBoundary] Reset requested from child component');
  };
}

/**
 * Specialized error boundary for async/suspense errors
 */
export function AsyncErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}): React.ReactElement {
  return (
    <ErrorBoundary
      fallback={fallback}
      onError={(error, info) => {
        // Log async errors specifically
        console.error('[AsyncErrorBoundary]', error.message);
      }}
      errorMessage="Failed to load content"
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for wallet/blockchain operations
 */
export function WalletErrorBoundary({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error('[WalletErrorBoundary]', error);
      }}
      errorMessage="Wallet operation failed"
      fallback={
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
          <p className="text-sm text-yellow-400">
            There was an issue with your wallet connection.
            Please try reconnecting.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for trading widgets
 * Shows a user-friendly message with refresh option
 */
export function TradingErrorBoundary({
  children,
  tokenSymbol,
}: {
  children: ReactNode;
  tokenSymbol?: string;
}): React.ReactElement {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error('[TradingErrorBoundary]', error);
      }}
      errorMessage={`Trading ${tokenSymbol ? `for ${tokenSymbol}` : ''} temporarily unavailable`}
      fallback={
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-6 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-orange-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm font-medium text-orange-600">
            Trading widget encountered an error
          </p>
          <p className="mt-1 text-xs text-orange-500/80">
            Please refresh the page to continue trading
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-orange-500/20 px-4 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-500/30"
          >
            Refresh Page
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for chart components
 */
export function ChartErrorBoundary({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error('[ChartErrorBoundary]', error);
      }}
      errorMessage="Chart failed to load"
      fallback={
        <div className="flex h-[300px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
          <div className="text-center">
            <svg
              className="mx-auto mb-2 h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-sm text-gray-500">Chart unavailable</p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
