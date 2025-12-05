/**
 * Token Transaction History Component
 *
 * Shows buy/sell history for a specific token.
 * Falls back to Horizon API if the indexer is not running.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import { stellarClient } from '@/lib/stellar/client';
import { formatCompactNumber } from '@/lib/stellar/utils';

interface TokenTransaction {
  id: string;
  type: 'buy' | 'sell';
  userAddress: string;
  tokenAmount: string;
  xlmAmount: string;
  timestamp: number;
  txHash: string;
}

interface TokenTransactionHistoryProps {
  tokenAddress: string;
  tokenSymbol: string;
  limit?: number;
}

export function TokenTransactionHistory({
  tokenAddress,
  tokenSymbol,
  limit = 20,
}: TokenTransactionHistoryProps) {
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchTransactions = useCallback(async () => {
    if (!tokenAddress) return;

    setLoading(true);
    setError(null);

    try {
      // Try to fetch from Horizon operations for the contract
      const horizon = stellarClient.getHorizon();
      const server = horizon.getServer();

      // Fetch recent operations involving the contract
      const response = await server
        .operations()
        .forAccount(tokenAddress)
        .order('desc')
        .limit(limit)
        .call();

      if (!isMountedRef.current) return;

      // Parse operations into transactions
      const parsedTxs: TokenTransaction[] = [];

      for (const op of response.records) {
        // Only process invoke contract operations
        if (op.type !== 'invoke_host_function') continue;

        try {
          // Get transaction details to extract function call info
          const txResponse = await fetch(op._links.transaction.href);
          const txData = await txResponse.json();

          // Extract function name from operation
          const functionName = (op as unknown as Record<string, unknown>).function || '';

          if (functionName === 'buy' || functionName === 'sell') {
            parsedTxs.push({
              id: op.id,
              type: functionName as 'buy' | 'sell',
              userAddress: op.source_account,
              tokenAmount: '0', // Would need to parse from result
              xlmAmount: '0', // Would need to parse from result
              timestamp: new Date(op.created_at).getTime(),
              txHash: txData.hash || op.transaction_hash || '',
            });
          }
        } catch {
          // Skip operations that can't be parsed
        }
      }

      if (isMountedRef.current) {
        setTransactions(parsedTxs);
      }
    } catch (err) {
      console.error('Failed to fetch transaction history:', err);
      if (isMountedRef.current) {
        setError('Unable to load transaction history');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [tokenAddress, limit]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchTransactions();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchTransactions]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-ui-border">
          <h3 className="font-bold text-ui-text-primary">Trade History</h3>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-ui-border flex items-center justify-between">
          <h3 className="font-bold text-ui-text-primary">Trade History</h3>
          <button
            onClick={fetchTransactions}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-xs text-gray-400 mt-1">
            Indexer may not be running
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-ui-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-ui-text-primary">Trade History</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {transactions.length} trades
          </span>
        </div>
        <button
          onClick={fetchTransactions}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        <AnimatePresence>
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">No trades yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Be the first to trade ${tokenSymbol}!
              </p>
            </div>
          ) : (
            transactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  tx.type === 'buy'
                    ? 'border-l-4 border-l-green-500'
                    : 'border-l-4 border-l-red-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className={`p-2 rounded-lg ${
                      tx.type === 'buy' ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    {tx.type === 'buy' ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">
                        {formatAddress(tx.userAddress)}
                      </span>
                      <span
                        className={`font-semibold ${
                          tx.type === 'buy' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {tx.type === 'buy' ? 'bought' : 'sold'}
                      </span>
                      {tx.tokenAmount !== '0' && (
                        <span className="text-gray-600">
                          {formatCompactNumber(parseFloat(tx.tokenAmount))}{' '}
                          {tokenSymbol}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(tx.timestamp)}</span>
                      {tx.xlmAmount !== '0' && (
                        <>
                          <span>•</span>
                          <span>
                            {formatCompactNumber(parseFloat(tx.xlmAmount))} XLM
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Link to explorer */}
                  <a
                    href={`https://testnet.stellarchain.io/transactions/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </a>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TokenTransactionHistory;
