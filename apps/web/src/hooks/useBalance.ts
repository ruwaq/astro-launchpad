/**
 * Hook to fetch and display user's XLM balance
 * REAL DATA from Stellar Testnet
 *
 * Memory-safe implementation with proper cleanup:
 * - Uses isMounted flag to prevent setState after unmount
 * - Clears polling interval on unmount
 * - Skips state updates if component unmounted during async operation
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { stellarClient } from '@/lib/stellar/client';
import { logWarning, logError } from '@/lib/utils/errors';

export function useBalance(address: string | null) {
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref for mounted state to avoid stale closure issues
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Reset mounted flag on each effect run
    isMountedRef.current = true;

    if (!address) {
      setBalance('0');
      setError(null);
      setIsLoading(false);
      return;
    }

    const fetchBalance = async () => {
      // Don't start fetch if already unmounted
      if (!isMountedRef.current) return;

      setIsLoading(true);
      setError(null);

      try {
        const horizonClient = stellarClient.getHorizon();
        const account = await horizonClient.loadAccount(address);

        // Check if still mounted after async operation
        if (!isMountedRef.current) return;

        // Check if balances exist
        if (!account.balances || !Array.isArray(account.balances)) {
          logWarning('useBalance', 'Balances array is missing or invalid', { address });
          setBalance('0');
          setIsLoading(false);
          return;
        }

        // Get XLM balance (native asset)
        const xlmBalance = account.balances.find(
          (b: { asset_type: string }) => b.asset_type === 'native'
        );

        if (xlmBalance && 'balance' in xlmBalance) {
          const balanceValue = parseFloat(xlmBalance.balance).toFixed(2);
          setBalance(balanceValue);
        } else {
          logWarning('useBalance', 'No native balance found', { address });
          setBalance('0');
        }
      } catch (err: unknown) {
        // Don't update state if unmounted
        if (!isMountedRef.current) return;

        logError('useBalance', err, { address });
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance';
        setError(errorMessage);
        setBalance('0');
      } finally {
        // Only update loading state if still mounted
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchBalance();

    // PERFORMANCE: Refresh balance every 60 seconds
    // 60000ms = 60 requests/hour (sufficient for balance display)
    const interval = setInterval(() => {
      // Only fetch if still mounted
      if (isMountedRef.current) {
        fetchBalance();
      }
    }, 60000);

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [address]);

  return {
    balance,
    isLoading,
    error,
  };
}
