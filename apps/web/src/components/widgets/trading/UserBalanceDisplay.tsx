/**
 * User Balance Display Component
 *
 * Shows user's XLM and token balances in the trading widget
 * Pump.fun style: Always visible for trust and convenience
 */

'use client';

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Wallet, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { stellarClient } from '@/lib/stellar/client';
import { formatCompactNumber, stroopsToXlm } from '@/lib/stellar/utils';

interface UserBalanceDisplayProps {
  userAddress: string | null;
  tokenAddress?: string;
  tokenSymbol?: string;
  isConnected: boolean;
}

export const UserBalanceDisplay = memo(function UserBalanceDisplay({
  userAddress,
  tokenAddress,
  tokenSymbol = 'TOKEN',
  isConnected,
}: UserBalanceDisplayProps) {
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FIX: Add isMounted ref to prevent state updates on unmounted component
  const isMountedRef = useRef(true);

  const fetchBalances = useCallback(async () => {
    if (!userAddress || !isConnected) {
      setXlmBalance(null);
      setTokenBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch XLM balance using Horizon server
      const horizon = stellarClient.getHorizon();
      const server = horizon.getServer();
      const account = await server.loadAccount(userAddress);

      // FIX: Check if still mounted after async operation
      if (!isMountedRef.current) return;

      // Find XLM balance (native asset)
      const xlmBalanceEntry = account.balances.find(
        (b: any) => b.asset_type === 'native'
      );
      if (xlmBalanceEntry) {
        setXlmBalance(xlmBalanceEntry.balance);
      }

      // Fetch token balance if token address is provided
      if (tokenAddress) {
        try {
          // Check for token balance in the account's balances
          // For SAC tokens, we need to check the contract state
          // This is a simplified version - the actual implementation
          // would query the contract directly
          const tokenBalanceEntry = account.balances.find(
            (b: any) => b.asset_issuer === tokenAddress ||
                        b.contract_id === tokenAddress
          );

          if (isMountedRef.current) {
            if (tokenBalanceEntry) {
              setTokenBalance(tokenBalanceEntry.balance);
            } else {
              setTokenBalance('0');
            }
          }
        } catch {
          // Token balance might not be available yet
          if (isMountedRef.current) {
            setTokenBalance('0');
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch balances:', err);
      if (isMountedRef.current) {
        setError('Failed to load balances');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userAddress, tokenAddress, isConnected]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchBalances();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBalances, 30000);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchBalances]);

  if (!isConnected) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Wallet className="h-4 w-4" />
          <span className="font-medium">Your Wallet</span>
        </div>
        <button
          onClick={fetchBalances}
          disabled={isLoading}
          className="p-1 hover:bg-blue-100 rounded-md transition-colors"
          aria-label="Refresh balances"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-red-600"
          >
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </motion.div>
        ) : isLoading && xlmBalance === null ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex gap-4"
          >
            <div className="flex-1">
              <div className="h-4 bg-blue-200 rounded animate-pulse mb-1 w-16" />
              <div className="h-6 bg-blue-200 rounded animate-pulse w-24" />
            </div>
            {tokenAddress && (
              <div className="flex-1">
                <div className="h-4 bg-blue-200 rounded animate-pulse mb-1 w-16" />
                <div className="h-6 bg-blue-200 rounded animate-pulse w-24" />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="balances"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex gap-4"
          >
            <div className="flex-1">
              <p className="text-xs text-blue-600 mb-0.5">XLM Balance</p>
              <p className="text-lg font-bold text-blue-900">
                {xlmBalance ? formatCompactNumber(parseFloat(xlmBalance)) : '0'}{' '}
                <span className="text-sm font-normal text-blue-600">XLM</span>
              </p>
            </div>
            {tokenAddress && (
              <div className="flex-1">
                <p className="text-xs text-blue-600 mb-0.5">{tokenSymbol} Balance</p>
                <p className="text-lg font-bold text-blue-900">
                  {tokenBalance ? formatCompactNumber(parseFloat(tokenBalance)) : '0'}{' '}
                  <span className="text-sm font-normal text-blue-600">{tokenSymbol}</span>
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
