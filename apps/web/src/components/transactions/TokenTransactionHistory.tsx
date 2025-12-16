/**
 * Token Transaction History Component
 *
 * Shows buy/sell history for a specific token using GraphQL API.
 * Displays real amounts from indexed transactions.
 */

'use client';

import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  Clock,
  User,
  AlertCircle,
  Rocket,
  ArrowLeftRight,
} from 'lucide-react';
import { useQuery, gql } from '@apollo/client';
import { formatCompactNumber, stroopsToXlm } from '@/lib/stellar/utils';
import { getNetworkConfig } from '@/lib/config/network';

// GraphQL query for token transactions
const GET_TOKEN_TRANSACTIONS = gql`
  query GetTokenTransactions($tokenAddress: String!, $limit: Int!) {
    transactions(tokenAddress: $tokenAddress, limit: $limit) {
      edges {
        node {
          id
          hash
          type
          from
          amount
          grossAmount
          status
          timestamp
        }
      }
      totalCount
    }
  }
`;

// Transaction types from API
type ApiTransactionType = 'TOKEN_CREATED' | 'TOKEN_BOUGHT' | 'TOKEN_SOLD' | 'LIQUIDITY_ADDED' | 'LIQUIDITY_REMOVED' | 'SWAP';
type DisplayTransactionType = 'buy' | 'sell' | 'create' | 'swap';

interface TransactionNode {
  id: string;
  hash: string;
  type: ApiTransactionType;
  from: string;
  amount: string;
  grossAmount: string;
  status: string;
  timestamp: string;
}

interface TokenTransactionHistoryProps {
  tokenAddress: string;
  tokenSymbol: string;
  limit?: number;
  /** Increment this to trigger a data refresh (e.g., after a trade) */
  refreshTrigger?: number;
}

// Map API transaction types to display types
function mapTransactionType(apiType: string): DisplayTransactionType | null {
  switch (apiType) {
    case 'TOKEN_BOUGHT': return 'buy';
    case 'TOKEN_SOLD': return 'sell';
    case 'TOKEN_CREATED': return 'create';
    case 'SWAP': return 'swap';
    default: return null;
  }
}

// Get transaction icon
function getTransactionIcon(type: DisplayTransactionType) {
  switch (type) {
    case 'buy':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'sell':
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    case 'create':
      return <Rocket className="h-4 w-4 text-brand-primary" />;
    case 'swap':
      return <ArrowLeftRight className="h-4 w-4 text-brand-blue" />;
  }
}

// Get transaction colors
function getTransactionColors(type: DisplayTransactionType) {
  switch (type) {
    case 'buy':
      return { bg: 'bg-green-100', border: 'border-l-green-500', text: 'text-green-600' };
    case 'sell':
      return { bg: 'bg-red-100', border: 'border-l-red-500', text: 'text-red-600' };
    case 'create':
      return { bg: 'bg-brand-primary-50', border: 'border-l-brand-primary', text: 'text-brand-primary' };
    case 'swap':
      return { bg: 'bg-blue-100', border: 'border-l-brand-blue', text: 'text-brand-blue' };
  }
}

// Get transaction label
function getTransactionLabel(type: DisplayTransactionType) {
  switch (type) {
    case 'buy': return 'bought';
    case 'sell': return 'sold';
    case 'create': return 'created';
  }
}

export const TokenTransactionHistory = memo(function TokenTransactionHistory({
  tokenAddress,
  tokenSymbol,
  limit = 20,
  refreshTrigger = 0,
}: TokenTransactionHistoryProps) {
  const networkConfig = getNetworkConfig();
  const explorerBaseUrl = networkConfig.passphrase.includes('Test')
    ? 'https://testnet.stellarchain.io'
    : 'https://stellarchain.io';

  const { data, loading, error, refetch } = useQuery(GET_TOKEN_TRANSACTIONS, {
    variables: { tokenAddress, limit },
    pollInterval: 10000, // Refresh every 10 seconds for better real-time experience
    skip: !tokenAddress,
  });

  // Refresh when triggered by parent (e.g., after a trade)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('[TokenTransactionHistory] Refresh triggered, fetching new data...');
      refetch();
    }
  }, [refreshTrigger, refetch]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  // Parse and filter transactions
  const transactions = (data?.transactions?.edges || [])
    .map((edge: { node: TransactionNode }) => {
      const tx = edge.node;
      const displayType = mapTransactionType(tx.type);
      if (!displayType) return null;

      // Convert amounts from stroops
      const tokenAmount = parseFloat(stroopsToXlm(tx.amount || '0'));
      const xlmAmount = parseFloat(stroopsToXlm(tx.grossAmount || '0'));

      return {
        id: tx.id,
        type: displayType,
        userAddress: tx.from,
        tokenAmount,
        xlmAmount,
        timestamp: tx.timestamp,
        txHash: tx.hash,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      type: DisplayTransactionType;
      userAddress: string;
      tokenAmount: number;
      xlmAmount: number;
      timestamp: string;
      txHash: string;
    }>;

  if (loading && !data) {
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
            onClick={() => refetch()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">Unable to load trade history</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-xs text-brand-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-ui-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-ui-text-primary">Trade History</h3>
          {transactions.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {transactions.length} trades
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
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
            transactions.map((tx, index) => {
              const colors = getTransactionColors(tx.type);
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors border-l-4 ${colors.border}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                      {getTransactionIcon(tx.type)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-medium">
                          {formatAddress(tx.userAddress)}
                        </span>
                        <span className={`font-semibold ${colors.text}`}>
                          {getTransactionLabel(tx.type)}
                        </span>
                        {tx.tokenAmount > 0 && (
                          <span className="text-gray-600">
                            {formatCompactNumber(tx.tokenAmount)} {tokenSymbol}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(tx.timestamp)}</span>
                        {tx.xlmAmount > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatCompactNumber(tx.xlmAmount)} XLM</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Link to explorer */}
                    {tx.txHash && (
                      <a
                        href={`${explorerBaseUrl}/transactions/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View on explorer"
                      >
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default TokenTransactionHistory;
