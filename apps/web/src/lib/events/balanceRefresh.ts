/**
 * Balance Refresh Event System
 *
 * Provides a simple event-based mechanism to trigger balance refresh
 * across components after trades complete.
 *
 * Usage:
 * - Call `emitBalanceRefresh()` after a successful trade
 * - Components use `useBalanceRefresh(callback)` to listen for refresh events
 */

// Custom event name for balance refresh
export const BALANCE_REFRESH_EVENT = 'astro:balance:refresh';

/**
 * Emit a balance refresh event
 * Call this after successful trades to trigger balance updates across components
 */
export function emitBalanceRefresh(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BALANCE_REFRESH_EVENT));
  }
}

/**
 * Hook to listen for balance refresh events
 *
 * @param callback - Function to call when balance refresh is triggered
 *
 * @example
 * ```tsx
 * useBalanceRefresh(() => {
 *   fetchBalances();
 * });
 * ```
 */
import { useEffect } from 'react';

export function useBalanceRefresh(callback: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRefresh = () => {
      callback();
    };

    window.addEventListener(BALANCE_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(BALANCE_REFRESH_EVENT, handleRefresh);
    };
  }, [callback]);
}
