/**
 * Hook to fetch and display user's XLM balance
 * REAL DATA from Stellar Testnet
 */

'use client';

import { useState, useEffect } from 'react';
import { stellarClient } from '@/lib/stellar/client';

export function useBalance(address: string | null) {
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setBalance('0');
      return;
    }

    let isMounted = true;

    const fetchBalance = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const horizonClient = stellarClient.getHorizon();
        const account = await horizonClient.loadAccount(address);

        if (!isMounted) return;

        // Check if balances exist
        if (!account.balances || !Array.isArray(account.balances)) {
          console.error('[useBalance] Balances array is missing or invalid');
          setBalance('0');
          setIsLoading(false);
          return;
        }

        // Get XLM balance (native asset)
        const xlmBalance = account.balances.find(
          (b: any) => b.asset_type === 'native'
        );

        if (xlmBalance) {
          const balanceValue = parseFloat(xlmBalance.balance).toFixed(2);
          setBalance(balanceValue);
        } else {
          console.warn('[useBalance] No native balance found');
          setBalance('0');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[useBalance] Error fetching balance:', err);
        setError(err.message || 'Failed to fetch balance');
        setBalance('0');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [address]);

  return {
    balance,
    isLoading,
    error,
  };
}
