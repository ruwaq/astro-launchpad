/**
 * User Balance Display Component
 *
 * Shows user's XLM and token balances in the trading widget
 * Pump.fun style: Always visible for trust and convenience
 *
 * FIXED: Now properly fetches SAC token balances from Soroban contract
 */

'use client';

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Wallet, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { stellarClient } from '@/lib/stellar/client';
import { formatCompactNumber } from '@/lib/stellar/utils';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';

interface UserBalanceDisplayProps {
  userAddress: string | null;
  tokenAddress?: string;
  tokenSymbol?: string;
  isConnected: boolean;
  /** Callback when token balance changes - useful for MAX button */
  onTokenBalanceChange?: (balance: string) => void;
  /** Callback when XLM balance changes - useful for balance validation */
  onXlmBalanceChange?: (balance: string) => void;
}

export const UserBalanceDisplay = memo(function UserBalanceDisplay({
  userAddress,
  tokenAddress,
  tokenSymbol = 'TOKEN',
  isConnected,
  onTokenBalanceChange,
  onXlmBalanceChange,
}: UserBalanceDisplayProps) {
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent state updates on unmounted component
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

      try {
        const account = await server.loadAccount(userAddress);

        if (!isMountedRef.current) return;

        // Find XLM balance (native asset)
        const xlmBalanceEntry = account.balances.find(
          (b: { asset_type: string }) => b.asset_type === 'native'
        );
        if (xlmBalanceEntry && 'balance' in xlmBalanceEntry) {
          const balance = xlmBalanceEntry.balance as string;
          setXlmBalance(balance);
          onXlmBalanceChange?.(balance);
        }
      } catch (horizonErr) {
        // Account might not exist on Horizon yet (new account)
        console.warn('Could not load account from Horizon:', horizonErr);
        if (isMountedRef.current) {
          setXlmBalance('0');
          onXlmBalanceChange?.('0');
        }
      }

      // Fetch token balance from Soroban contract (SAC tokens)
      if (tokenAddress) {
        try {
          // Get token info which includes the user's balance via contract call
          const tokenInfo = await sacFactoryService.getTokenInfo(tokenAddress);

          if (!isMountedRef.current) return;

          if (tokenInfo) {
            // For SAC tokens, we need to query the token contract directly
            // The balance is stored in the token contract, not in Horizon
            const balance = await fetchSorobanTokenBalance(userAddress, tokenAddress, tokenInfo.issuer);

            if (isMountedRef.current) {
              const balanceStr = balance.toString();
              setTokenBalance(balanceStr);
              onTokenBalanceChange?.(balanceStr);
            }
          } else {
            if (isMountedRef.current) {
              setTokenBalance('0');
              onTokenBalanceChange?.('0');
            }
          }
        } catch (tokenErr) {
          console.warn('Could not fetch token balance:', tokenErr);
          if (isMountedRef.current) {
            setTokenBalance('0');
            onTokenBalanceChange?.('0');
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
  }, [userAddress, tokenAddress, isConnected, onTokenBalanceChange, onXlmBalanceChange]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchBalances();
    // Refresh every 15 seconds for more responsive updates
    const interval = setInterval(fetchBalances, 15000);
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
                  {tokenBalance ? formatCompactNumber(parseFloat(tokenBalance) / 10_000_000) : '0'}{' '}
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

/**
 * Fetch token balance from Soroban contract
 * SAC tokens store balances in the contract, not in Horizon
 */
async function fetchSorobanTokenBalance(
  userAddress: string,
  tokenAddress: string,
  issuer?: string
): Promise<bigint> {
  try {
    const soroban = stellarClient.getSoroban();
    const server = soroban.getServer();

    // Import necessary SDK components
    const { Contract, Address, scValToNative } = await import('@stellar/stellar-sdk');

    // Create contract instance for the token
    const contract = new Contract(tokenAddress);

    // Build the balance query operation
    const balanceOp = contract.call(
      'balance',
      Address.fromString(userAddress).toScVal()
    );

    // Simulate to get the result
    const account = await server.getAccount(userAddress);
    const { TransactionBuilder } = await import('@stellar/stellar-sdk');
    const { getNetworkConfig } = await import('@/lib/config/network');
    const config = getNetworkConfig();

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: config.passphrase,
    })
      .addOperation(balanceOp)
      .setTimeout(30)
      .build();

    const simulated = await server.simulateTransaction(tx);

    if ('result' in simulated && simulated.result) {
      // Extract the balance from simulation result
      const result = simulated.result as { retval?: unknown };
      if (result.retval) {
        const balance = scValToNative(result.retval as Parameters<typeof scValToNative>[0]);
        return BigInt(balance?.toString() || '0');
      }
    }

    return BigInt(0);
  } catch (err) {
    console.warn('Failed to fetch Soroban token balance:', err);

    // Fallback: Try to get balance from Horizon for SAC tokens with classic issuer
    if (issuer && issuer.startsWith('G')) {
      try {
        const horizon = stellarClient.getHorizon();
        const server = horizon.getServer();
        const account = await server.loadAccount(userAddress);

        const tokenBalanceEntry = account.balances.find(
          (b) => 'asset_issuer' in b && b.asset_issuer === issuer
        );

        if (tokenBalanceEntry && 'balance' in tokenBalanceEntry) {
          // Convert from display format (7 decimals) to stroops
          return BigInt(Math.floor(parseFloat(tokenBalanceEntry.balance as string) * 10_000_000));
        }
      } catch {
        // Ignore fallback errors
      }
    }

    return BigInt(0);
  }
}
