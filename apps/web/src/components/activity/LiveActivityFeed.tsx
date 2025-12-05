/**
 * Live Activity Feed Component
 *
 * Real-time transaction feed with:
 * - Animated entry/exit of transactions
 * - Buy (green) / Sell (red) visual distinction
 * - Sound effects for new transactions
 * - Auto-scrolling with pause on hover
 * - Mobile-optimized compact view
 * - Relative timestamps
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Rocket,
  Star,
  Users,
  Clock,
  ExternalLink,
  Volume2,
  VolumeX,
  Pause,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { useTradingSounds } from '@/hooks/useTradingSounds';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useQuery, gql } from '@apollo/client';
import { formatCompactNumber } from '@/lib/stellar/utils';

// GraphQL query for recent transactions
// Uses the transactions query with pagination from the backend
const GET_RECENT_TRANSACTIONS = gql`
  query GetRecentTransactions($limit: Int!, $tokenAddress: String) {
    transactions(limit: $limit, tokenAddress: $tokenAddress) {
      edges {
        node {
          id
          hash
          type
          from
          to
          tokenAddress
          amount
          grossAmount
          status
          timestamp
          token {
            address
            symbol
            name
            imageUrl
          }
        }
      }
      totalCount
    }
  }
`;

// Transaction types from API - matching Prisma schema
type ApiTransactionType = 'TOKEN_CREATED' | 'TOKEN_BOUGHT' | 'TOKEN_SOLD' | 'LIQUIDITY_ADDED' | 'LIQUIDITY_REMOVED' | 'SWAP';
// Display types for UI
type DisplayTransactionType = 'buy' | 'sell' | 'create' | 'graduate';

interface Transaction {
  id: string;
  type: DisplayTransactionType;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage?: string;
  amount: number;
  grossAmount?: number;
  userAddress: string;
  timestamp: number;
  txHash?: string;
}

// Map API transaction types to display types
function mapTransactionType(apiType: string): DisplayTransactionType {
  switch (apiType) {
    case 'TOKEN_BOUGHT': return 'buy';
    case 'TOKEN_SOLD': return 'sell';
    case 'TOKEN_CREATED': return 'create';
    case 'SWAP': return 'buy'; // Treat swaps as buys for display
    case 'LIQUIDITY_ADDED':
    case 'LIQUIDITY_REMOVED':
    default: return 'buy';
  }
}

// Animation variants
const feedItemVariants = {
  initial: {
    opacity: 0,
    x: -20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut' as const,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

const highlightVariants = {
  initial: { backgroundColor: 'transparent' },
  highlight: {
    backgroundColor: ['rgba(250, 148, 39, 0.2)', 'transparent'],
    transition: { duration: 1 },
  },
};

// PERFORMANCE: Polling interval constants for production
// Reduced for better real-time experience after trades
const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds - fast updates
const MIN_POLL_INTERVAL = 3000; // 3 seconds minimum
const MAX_ITEMS_DEFAULT = 20;
const HIGHLIGHT_DURATION_MS = 2000;
const POLL_JITTER_MAX_MS = 2000; // Random jitter to prevent thundering herd

interface LiveActivityFeedProps {
  /** Optional token address to filter transactions for a specific token */
  tokenAddress?: string;
  maxItems?: number;
  compact?: boolean;
  showHeader?: boolean;
  autoScroll?: boolean;
  soundEnabled?: boolean;
  /** Polling interval in ms. Min: 10000ms. Default: 15000ms */
  pollInterval?: number;
  /** Increment this to trigger a data refresh (e.g., after a trade) */
  refreshTrigger?: number;
}

// PERFORMANCE: Memoize component to prevent unnecessary re-renders from parent
export const LiveActivityFeed = memo(function LiveActivityFeed({
  tokenAddress,
  maxItems = MAX_ITEMS_DEFAULT,
  compact = false,
  showHeader = true,
  autoScroll = true,
  soundEnabled: initialSoundEnabled = true,
  pollInterval: requestedPollInterval = DEFAULT_POLL_INTERVAL,
  refreshTrigger = 0,
}: LiveActivityFeedProps) {
  // PERFORMANCE: Enforce minimum polling interval
  const pollInterval = Math.max(requestedPollInterval, MIN_POLL_INTERVAL);
  const shouldReduceMotion = useReducedMotion();
  const { playNotification, playBuy, playSell, playMilestone } = useTradingSounds();
  // PERFORMANCE: Pause polling when tab is not visible to save bandwidth
  const isPageVisible = usePageVisibility();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);
  const [newTxIds, setNewTxIds] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const lastTxIdRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // FIX: Use ref to track existing transaction IDs to avoid stale closure in useEffect
  const existingTxIdsRef = useRef<Set<string>>(new Set());

  // Build query variables
  const queryVariables = {
    limit: maxItems,
    ...(tokenAddress && { tokenAddress }),
  };

  // Fetch real transactions from GraphQL API
  const { data: txData, loading: txLoading, refetch: refetchTx } = useQuery(GET_RECENT_TRANSACTIONS, {
    variables: queryVariables,
    // PERFORMANCE: Stop polling when paused OR when tab is not visible
    pollInterval: isPaused || !isPageVisible ? 0 : pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  // Refresh when triggered by parent (e.g., after a trade)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('[LiveActivityFeed] Refresh triggered, fetching new data...');
      refetchTx();
    }
  }, [refreshTrigger, refetchTx]);

  // Transform API transactions to local Transaction type
  useEffect(() => {
    if (!txData?.transactions?.edges) return;

    const apiTransactions: Transaction[] = txData.transactions.edges.map(
      (edge: { node: {
        id: string;
        hash?: string;
        type?: string;
        from?: string;
        tokenAddress?: string;
        amount?: string;
        grossAmount?: string;
        timestamp?: string;
        token?: { address?: string; symbol?: string; name?: string; imageUrl?: string };
      }}) => {
        const tx = edge.node;
        return {
          id: tx.id,
          type: mapTransactionType(tx.type || 'TOKEN_BOUGHT'),
          tokenAddress: tx.token?.address || tx.tokenAddress || '',
          tokenSymbol: tx.token?.symbol || 'TOKEN',
          tokenName: tx.token?.name || 'Unknown Token',
          tokenImage: tx.token?.imageUrl,
          amount: parseFloat(tx.amount || '0'),
          grossAmount: tx.grossAmount ? parseFloat(tx.grossAmount) : undefined,
          userAddress: tx.from || '',
          timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now(),
          txHash: tx.hash,
        };
      }
    );

    // FIX: Use ref to check for new transactions (avoids stale closure issue)
    // Check for new transactions and highlight them
    if (existingTxIdsRef.current.size > 0 && apiTransactions.length > 0) {
      const newTransactions = apiTransactions.filter(t => !existingTxIdsRef.current.has(t.id));

      if (newTransactions.length > 0) {
        // Mark new transactions for highlighting
        setNewTxIds(prev => {
          const next = new Set(prev);
          newTransactions.forEach(t => next.add(t.id));
          return next;
        });

        // Play sound for new transactions
        if (soundEnabled && newTransactions.length > 0) {
          const latestTx = newTransactions[0];
          if (latestTx.type === 'create' || latestTx.type === 'graduate') {
            playMilestone();
          } else {
            playNotification();
          }
        }

        // Remove highlight after duration - FIX: Store timeout ref for cleanup
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setNewTxIds(prev => {
            const next = new Set(prev);
            newTransactions.forEach(t => next.delete(t.id));
            return next;
          });
        }, HIGHLIGHT_DURATION_MS);
      }
    }

    // FIX: Update ref with current transaction IDs AFTER checking for new ones
    existingTxIdsRef.current = new Set(apiTransactions.map(t => t.id));

    setTransactions(apiTransactions);
    if (apiTransactions.length > 0) {
      lastTxIdRef.current = apiTransactions[0].id;
    }
  }, [txData, soundEnabled, playNotification, playMilestone]);

  // FIX: Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Format address
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Format number using utility function for consistent display
  const formatNumber = (num: number): string => {
    return formatCompactNumber(num);
  };

  // Get transaction icon
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'sell':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'create':
        return <Rocket className="h-4 w-4 text-purple-500" />;
      case 'graduate':
        return <Star className="h-4 w-4 text-yellow-500" />;
      default:
        return <Users className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get transaction color
  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'border-l-green-500 bg-green-50/50';
      case 'sell':
        return 'border-l-red-500 bg-red-50/50';
      case 'create':
        return 'border-l-purple-500 bg-purple-50/50';
      case 'graduate':
        return 'border-l-yellow-500 bg-yellow-50/50';
      default:
        return 'border-l-gray-300 bg-gray-50/50';
    }
  };

  // Get transaction message
  const getTransactionMessage = (tx: Transaction) => {
    switch (tx.type) {
      case 'buy':
        return (
          <>
            <span className="text-green-600 font-semibold">bought</span>
            {' '}{formatNumber(tx.amount)} {tx.tokenSymbol}
          </>
        );
      case 'sell':
        return (
          <>
            <span className="text-red-600 font-semibold">sold</span>
            {' '}{formatNumber(tx.amount)} {tx.tokenSymbol}
          </>
        );
      case 'create':
        return (
          <>
            <span className="text-purple-600 font-semibold">created</span>
            {' '}{tx.tokenSymbol}
          </>
        );
      case 'graduate':
        return (
          <>
            <span className="text-yellow-600 font-semibold">graduated</span>
            {' '}{tx.tokenSymbol} to DEX!
          </>
        );
      default:
        return `interacted with ${tx.tokenSymbol}`;
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden"
      role="feed"
      aria-label="Live transaction activity"
      aria-busy={txLoading}
    >
      {/* Header */}
      {showHeader && (
        <div className="p-4 border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75" />
            </div>
            <h3 className="font-bold text-ui-text-primary">Live Activity</h3>
            <span className="text-xs text-ui-text-secondary bg-gray-100 px-2 py-0.5 rounded-full">
              {transactions.length} recent
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <Play className="h-4 w-4 text-gray-500" />
              ) : (
                <Pause className="h-4 w-4 text-gray-500" />
              )}
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-gray-500" />
              ) : (
                <VolumeX className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div
        ref={feedRef}
        className={`overflow-y-auto ${compact ? 'max-h-48 sm:max-h-64' : 'max-h-64 sm:max-h-96'}`}
        onMouseEnter={() => autoScroll && setIsPaused(true)}
        onMouseLeave={() => autoScroll && setIsPaused(false)}
      >
        <AnimatePresence mode="popLayout">
          {transactions.map((tx) => (
            <motion.div
              key={tx.id}
              variants={shouldReduceMotion ? {} : feedItemVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
              className={`border-l-4 ${getTransactionColor(tx.type)} ${
                newTxIds.has(tx.id) ? 'ring-2 ring-brand-primary/20' : ''
              }`}
            >
              <motion.div
                variants={newTxIds.has(tx.id) ? highlightVariants : {}}
                initial="initial"
                animate={newTxIds.has(tx.id) ? 'highlight' : 'initial'}
                className={`p-3 ${compact ? 'py-2' : ''} hover:bg-gray-50 transition-colors`}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 p-2 rounded-lg ${
                    tx.type === 'buy' ? 'bg-green-100' :
                    tx.type === 'sell' ? 'bg-red-100' :
                    tx.type === 'create' ? 'bg-purple-100' :
                    'bg-yellow-100'
                  }`}>
                    {getTransactionIcon(tx.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Link
                        href={`/user/${tx.userAddress}`}
                        className="font-medium text-ui-text-primary hover:text-brand-primary truncate"
                      >
                        {formatAddress(tx.userAddress)}
                      </Link>
                      <span className="text-ui-text-secondary">
                        {getTransactionMessage(tx)}
                      </span>
                    </div>

                    {!compact && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-ui-text-secondary">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeTime(tx.timestamp)}</span>
                        {tx.grossAmount && tx.grossAmount > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatNumber(tx.grossAmount)} XLM</span>
                          </>
                        )}
                        {tx.txHash && (
                          <a
                            href={`https://stellar.expert/explorer/${process.env.NEXT_PUBLIC_NETWORK || 'testnet'}/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-brand-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Token Link */}
                  <Link
                    href={`/t/${tx.tokenAddress}`}
                    className="flex-shrink-0 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-medium text-ui-text-primary transition-colors"
                  >
                    ${tx.tokenSymbol}
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading State */}
        {txLoading && transactions.length === 0 && (
          <div className="p-8 text-center text-ui-text-secondary">
            <div className="w-8 h-8 mx-auto mb-2 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading activity...</p>
          </div>
        )}

        {/* Empty State */}
        {!txLoading && transactions.length === 0 && (
          <div className="p-8 text-center text-ui-text-secondary">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity yet</p>
            <p className="text-xs mt-1">Transactions will appear here in real-time</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {isPaused && (
        <div className="p-2 bg-yellow-50 border-t border-yellow-100 text-center">
          <p className="text-xs text-yellow-700 flex items-center justify-center gap-1">
            <Pause className="h-3 w-3" />
            Feed paused - hover to resume
          </p>
        </div>
      )}
    </div>
  );
});

// Custom comparison function for memo - only re-render if props actually change
LiveActivityFeed.displayName = 'LiveActivityFeed';

export default LiveActivityFeed;
