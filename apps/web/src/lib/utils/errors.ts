/**
 * Error handling utilities
 * Centralized error extraction and handling
 */

/**
 * Extract a user-friendly error message from any error type
 * @param error - Any error object
 * @returns User-friendly error message string
 */
export function extractErrorMessage(error: unknown): string {
  // Standard Error object
  if (error instanceof Error) {
    return error.message;
  }

  // Object with message property
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  // Fallback for unknown error types
  return 'An unexpected error occurred';
}

/**
 * Parse contract/blockchain error messages into user-friendly text
 * @param error - Error message from contract
 * @returns User-friendly error message
 */
export function parseContractError(error: string): string {
  const errorLower = error.toLowerCase();

  // Max holdings error
  if (errorLower.includes('max') && errorLower.includes('holdings')) {
    return "You've reached the maximum token holdings (50%). Sell some tokens first to buy more.";
  }

  // Insufficient balance
  if (errorLower.includes('insufficient') && errorLower.includes('balance')) {
    return 'Insufficient balance to complete this transaction.';
  }

  // Slippage error
  if (errorLower.includes('slippage') || errorLower.includes('price')) {
    return 'Price changed during transaction. Please try again with higher slippage.';
  }

  // Transaction rejected
  if (errorLower.includes('rejected') || errorLower.includes('cancelled')) {
    return 'Transaction was cancelled.';
  }

  // Network error
  if (errorLower.includes('network') || errorLower.includes('timeout')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Return original if no pattern matches
  return error;
}

/**
 * Check if an error is a user cancellation
 * @param error - Error to check
 * @returns True if user cancelled the action
 */
export function isUserCancellation(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes('rejected') ||
    message.includes('cancelled') ||
    message.includes('user denied') ||
    message.includes('user rejected')
  );
}

/**
 * Log error with context (use instead of console.error directly)
 * @param context - Where the error occurred
 * @param error - The error object
 * @param metadata - Additional context
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const message = extractErrorMessage(error);

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, message, metadata);
  }

  // In production, Sentry will capture this automatically
  // The error boundary or Sentry integration will handle reporting
}

/**
 * Log warning with context (use instead of console.warn directly)
 * @param context - Where the warning occurred
 * @param message - Warning message
 * @param metadata - Additional context
 */
export function logWarning(
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[${context}]`, message, metadata);
  }
}
