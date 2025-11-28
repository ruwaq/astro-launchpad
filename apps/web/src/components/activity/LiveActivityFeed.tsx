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

import { useState, useEffect, useRef, useCallback } from 'react';
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
  query GetRecentTransactions($limit: Int!) {
    transactions(limit: $limit) {
      edges {
        node {
          id
          hash
          type
          from
          to
          tokenAddress
          amount
          status
          timestamp
          token {
            symbol
            name
            imageUrl
          }
        }
      }
    }
  }
`;

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'create' | 'graduate';
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage?: string;
  amount: number;
  xlmAmount: number;
  userAddress: string;
  timestamp: number;
  txHash?: string;
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
// Previous: 5000ms default = excessive API calls
// Current: 15000ms default = balanced real-time feel with sustainable load
const DEFAULT_POLL_INTERVAL = 15000; // 15 seconds
const MIN_POLL_INTERVAL = 10000; // 10 seconds minimum
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
}

export function LiveActivityFeed({
  tokenAddress,
  maxItems = MAX_ITEMS_DEFAULT,
  compact = false,
  showHeader = true,
  autoScroll = true,
  soundEnabled: initialSoundEnabled = true,
  pollInterval: requestedPollInterval = DEFAULT_POLL_INTERVAL,
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

  // Mock data for development (will be replaced by real GraphQL)
  const generateMockTransaction = useCallback((): Transaction => {
    const types: ('buy' | 'sell' | 'create' | 'graduate')[] = ['buy', 'sell', 'buy', 'buy', 'create'];
    const type = types[Math.floor(Math.random() * types.length)];
    const symbols = ['ASTRO', 'SHIBA', 'MOON', 'DOGE', 'PEPE', 'BONK', 'WIF'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    return {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      tokenAddress: `CA${Math.random().toString(36).substr(2, 40).toUpperCase()}`,
      tokenSymbol: symbol,
      tokenName: `${symbol} Token`,
      tokenImage: `/tokens/${symbol.toLowerCase()}.png`,
      amount: Math.floor(Math.random() * 1000000) + 1000,
      xlmAmount: Math.floor(Math.random() * 10000) + 10,
      userAddress: `G${Math.random().toString(36).substr(2, 55).toUpperCase()}`,
      timestamp: Date.now(),
      txHash: Math.random().toString(36).substr(2, 64),
    };
  }, []);

  // Simulated polling (replace with real WebSocket/GraphQL subscription)
  useEffect(() => {
    // Initial load with some mock data
    const initialTxs = Array.from({ length: 5 }, generateMockTransaction);
    setTransactions(initialTxs);
    lastTxIdRef.current = initialTxs[0]?.id || null;

    // PERFORMANCE: Stop polling when paused OR when tab is not visible
    if (isPaused || !isPageVisible) return;

    const interval = setInterval(() => {
      // Add new transaction
      const newTx = generateMockTransaction();

      setTransactions((prev) => {
        const updated = [newTx, ...prev].slice(0, maxItems);
        return updated;
      });

      // Mark as new for highlighting
      setNewTxIds((prev) => new Set([...prev, newTx.id]));
      setTimeout(() => {
        setNewTxIds((prev) => {
          const next = new Set(prev);
          next.delete(newTx.id);
          return next;
        });
      }, HIGHLIGHT_DURATION_MS);

      // Play sound
      if (soundEnabled && lastTxIdRef.current !== newTx.id) {
        if (newTx.type === 'buy') {
          playNotification();
        } else if (newTx.type === 'sell') {
          playNotification();
        } else if (newTx.type === 'create' || newTx.type === 'graduate') {
          playMilestone();
        }
      }

      lastTxIdRef.current = newTx.id;
    }, pollInterval + Math.random() * POLL_JITTER_MAX_MS);

    return () => clearInterval(interval);
  }, [isPaused, isPageVisible, maxItems, pollInterval, soundEnabled, generateMockTransaction, playNotification, playMilestone]);

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
    <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
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
        className={`overflow-y-auto ${compact ? 'max-h-64' : 'max-h-96'}`}
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
                        {tx.xlmAmount > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatNumber(tx.xlmAmount)} XLM</span>
                          </>
                        )}
                        {tx.txHash && (
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
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

        {/* Empty State */}
        {transactions.length === 0 && (
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
}

export default LiveActivityFeed;
