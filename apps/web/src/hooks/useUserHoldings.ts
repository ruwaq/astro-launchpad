/**
 * Hook to fetch user's token holdings
 * Fetches all token balances for a given user address
 * Combines data from GraphQL (token info) and user transactions
 *
 * Note: Currently estimates holdings from transaction history.
 * In production, this should query Soroban contract balances directly.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useUserTransactions } from './useApi';
import { logError, logWarning } from '@/lib/utils/errors';

export interface TokenHolding {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenImage: string;
  balance: string;
  currentPrice: string;
  totalValue: string;
  priceChange24h: number;
  isGraduated: boolean;
  purchaseHistory?: {
    totalSpent: string;
    totalBought: string;
    totalSold: string;
    averagePrice: string;
  };
}

export interface UseUserHoldingsReturn {
  holdings: TokenHolding[];
  isLoading: boolean;
  error: string | null;
  totalPortfolioValue: string;
  refetch: () => void;
}

/**
 * Fetch user's token holdings
 *
 * Process:
 * 1. Get user's transaction history to find tokens they've interacted with
 * 2. Calculate net balance from buy/sell transactions
 * 3. Fetch current price and metadata
 * 4. Calculate total value and profit/loss
 *
 * Note: This estimates balances from transaction history.
 * For production, query Soroban contract balances directly via:
 * - Contract.call('balance', [userAddress])
 */
export function useUserHoldings(address: string | null): UseUserHoldingsReturn {
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState('0');

  const isMountedRef = useRef(true);

  // Fetch user transactions to calculate holdings
  const { data: txData, refetch: refetchTx, loading: txLoading } = useUserTransactions(address || '', 500);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!address) {
      setHoldings([]);
      setTotalPortfolioValue('0');
      setIsLoading(false);
      return;
    }

    if (txLoading) {
      setIsLoading(true);
      return;
    }

    if (!txData) {
      setHoldings([]);
      setTotalPortfolioValue('0');
      setIsLoading(false);
      return;
    }

    const calculateHoldings = () => {
      if (!isMountedRef.current) return;

      setIsLoading(true);
      setError(null);

      try {
        // Track balance and purchase history per token
        interface TokenData {
          address: string;
          name: string;
          symbol: string;
          image: string;
          currentPrice: string;
          priceChange24h: number;
          graduated: boolean;
          totalBought: number;
          totalSold: number;
          totalSpent: number;
          totalReceived: number;
        }

        const tokenMap = new Map<string, TokenData>();

        // Process all transactions to calculate net balances
        txData?.transactions?.edges?.forEach((edge: any) => {
          const tx = edge?.node;
          if (!tx?.token) return;

          const tokenAddress = tx.token.address;
          const txType = tx.type;
          const amount0 = parseFloat(tx.amount0 || '0');
          const amount1 = parseFloat(tx.amount1 || '0');

          // Initialize token data if not exists
          if (!tokenMap.has(tokenAddress)) {
            tokenMap.set(tokenAddress, {
              address: tokenAddress,
              name: tx.token.name || 'Unknown',
              symbol: tx.token.symbol || '???',
              image: tx.token.logoUrl || tx.token.imageUrl || '',
              currentPrice: tx.token.currentPrice || '0',
              priceChange24h: parseFloat(tx.token.priceChange24h || '0'),
              graduated: tx.token.graduated || false,
              totalBought: 0,
              totalSold: 0,
              totalSpent: 0,
              totalReceived: 0,
            });
          }

          const tokenData = tokenMap.get(tokenAddress)!;

          // Update balances based on transaction type
          if (txType === 'TOKEN_BOUGHT') {
            // amount0 = tokens received, amount1 = XLM spent
            tokenData.totalBought += amount0;
            tokenData.totalSpent += amount1;
          } else if (txType === 'TOKEN_SOLD') {
            // amount0 = tokens sold, amount1 = XLM received
            tokenData.totalSold += amount0;
            tokenData.totalReceived += amount1;
          }
        });

        if (!isMountedRef.current) return;

        // Convert to holdings array
        const calculatedHoldings: TokenHolding[] = [];

        tokenMap.forEach((tokenData) => {
          // Calculate net balance
          const netBalance = tokenData.totalBought - tokenData.totalSold;

          // Only include tokens with positive balance
          if (netBalance <= 0) return;

          const currentPrice = parseFloat(tokenData.currentPrice);
          const totalValue = netBalance * currentPrice;

          // Calculate average purchase price
          const averagePrice = tokenData.totalBought > 0
            ? tokenData.totalSpent / tokenData.totalBought
            : 0;

          calculatedHoldings.push({
            tokenAddress: tokenData.address,
            tokenName: tokenData.name,
            tokenSymbol: tokenData.symbol,
            tokenImage: tokenData.image,
            balance: netBalance.toFixed(2),
            currentPrice: tokenData.currentPrice,
            totalValue: totalValue.toFixed(2),
            priceChange24h: tokenData.priceChange24h,
            isGraduated: tokenData.graduated,
            purchaseHistory: {
              totalSpent: tokenData.totalSpent.toFixed(2),
              totalBought: tokenData.totalBought.toFixed(2),
              totalSold: tokenData.totalSold.toFixed(2),
              averagePrice: averagePrice.toFixed(7),
            },
          });
        });

        // Sort by total value (highest first)
        calculatedHoldings.sort((a, b) => parseFloat(b.totalValue) - parseFloat(a.totalValue));

        // Calculate total portfolio value
        const totalValue = calculatedHoldings.reduce(
          (sum, holding) => sum + parseFloat(holding.totalValue),
          0
        );

        setHoldings(calculatedHoldings);
        setTotalPortfolioValue(totalValue.toFixed(2));
      } catch (err) {
        if (!isMountedRef.current) return;

        logError('useUserHoldings', err, { address });
        const errorMessage = err instanceof Error ? err.message : 'Failed to calculate holdings';
        setError(errorMessage);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    calculateHoldings();
  }, [address, txData, txLoading]);

  const refetch = () => {
    refetchTx();
  };

  return {
    holdings,
    isLoading,
    error,
    totalPortfolioValue,
    refetch,
  };
}
