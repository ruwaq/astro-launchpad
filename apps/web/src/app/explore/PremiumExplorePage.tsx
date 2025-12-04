/**
 * Premium Explore Page
 *
 * Enhanced explore experience with:
 * - Live Activity Feed sidebar
 * - Premium Token Cards with animations
 * - Real-time WebSocket updates
 * - Mobile-first responsive layout
 * - Sound effects and haptic feedback
 * - Gamification elements
 */

'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  TrendingUp,
  Loader2,
  Filter,
  Grid3X3,
  List,
  Sparkles,
  Flame,
  Clock,
  BarChart3,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TokenCardPremium } from '@/components/token/TokenCardPremium';
import { LiveActivityFeed } from '@/components/activity/LiveActivityFeed';
import { StreakCounter } from '@/components/gamification/StreakCounter';
import { useSimulatedWebSocket } from '@/hooks/useWebSocket';
import { useTradingSounds } from '@/hooks/useTradingSounds';
import { useWallet } from '@/contexts/WalletContext';
import { useQuery, gql } from '@apollo/client';
import Link from 'next/link';

// GraphQL query
const GET_ALL_TOKENS = gql`
  query GetAllTokens($limit: Int!, $orderBy: TokenOrderBy!) {
    tokens(limit: $limit, orderBy: $orderBy) {
      edges {
        cursor
        node {
          address
          name
          symbol
          imageUrl
          logoUrl
          currentPrice
          priceChange24h
          volume24h
          marketCap
          circulatingSupply
          xlmRaised
          xlmReserve
          graduated
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
      totalCount
    }
  }
`;

type SortOption = 'trending' | 'new' | 'marketCap' | 'volume' | 'graduation';
type StatusFilter = 'all' | 'bonding' | 'graduated';
type ViewMode = 'grid' | 'list';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const filterPillVariants = {
  active: { scale: 1, backgroundColor: 'rgb(250, 148, 39)', color: 'white' },
  inactive: { scale: 1, backgroundColor: 'rgb(243, 244, 246)', color: 'rgb(75, 85, 99)' },
};

export default function PremiumExplorePage() {
  const { isConnected, address } = useWallet();
  const { playClick, playNotification } = useTradingSounds();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('trending');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(true);

  // Simulated streak data (would come from backend)
  const [streakData] = useState({
    currentStreak: 5,
    longestStreak: 12,
    lastTradeDate: new Date(Date.now() - 86400000), // Yesterday
  });

  // GraphQL query
  const { data: tokensData, loading: tokensLoading, refetch } = useQuery(GET_ALL_TOKENS, {
    variables: {
      limit: 100,
      orderBy: 'CREATED_AT_DESC',
    },
    pollInterval: 30000,
  });

  // WebSocket for real-time updates
  const { isConnected: wsConnected } = useSimulatedWebSocket({
    onNewToken: () => {
      playNotification();
      refetch();
    },
    onGraduation: () => {
      playNotification();
      refetch();
    },
  });

  // Extract and filter tokens
  const tokens = tokensData?.tokens?.edges?.map((edge: { node: unknown }) => edge.node) || [];

  const filteredTokens = tokens.filter((token: { name?: string; symbol?: string; graduated?: boolean }) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !token.name?.toLowerCase().includes(query) &&
        !token.symbol?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Status filter
    if (statusFilter === 'bonding' && token.graduated) return false;
    if (statusFilter === 'graduated' && !token.graduated) return false;

    return true;
  });

  // PERFORMANCE: Memoize expensive sort operations to prevent recalculation on every render
  const sortedTokens = useMemo(() => {
    return [...filteredTokens].sort((a: {
      createdAt?: string;
      marketCap?: string;
      volume24h?: string;
      xlmRaised?: string
    }, b: {
      createdAt?: string;
      marketCap?: string;
      volume24h?: string;
      xlmRaised?: string
    }) => {
      switch (sortBy) {
        case 'new':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'marketCap':
          return parseFloat(b.marketCap || '0') - parseFloat(a.marketCap || '0');
        case 'volume':
          return parseFloat(b.volume24h || '0') - parseFloat(a.volume24h || '0');
        case 'graduation':
          return parseFloat(b.xlmRaised || '0') - parseFloat(a.xlmRaised || '0');
        case 'trending':
        default:
          // Trending: combination of volume and recent activity
          const aScore = parseFloat(a.volume24h || '0') * 0.7 + parseFloat(a.xlmRaised || '0') * 0.3;
          const bScore = parseFloat(b.volume24h || '0') * 0.7 + parseFloat(b.xlmRaised || '0') * 0.3;
          return bScore - aScore;
      }
    });
  }, [filteredTokens, sortBy]);

  // PERFORMANCE: Memoize trending tokens set
  const trendingTokens = useMemo(() => {
    return new Set(sortedTokens.slice(0, 10).map((t: { address: string }) => t.address));
  }, [sortedTokens]);

  // Handle filter changes with sound
  const handleSortChange = (sort: SortOption) => {
    playClick();
    setSortBy(sort);
  };

  const handleStatusChange = (status: StatusFilter) => {
    playClick();
    setStatusFilter(status);
  };

  // Sort options config
  const sortOptions = [
    { id: 'trending', label: 'Trending', icon: <Flame className="h-4 w-4" /> },
    { id: 'new', label: 'New', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'marketCap', label: 'Market Cap', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'graduation', label: 'Graduating', icon: <TrendingUp className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout>
      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary flex items-center gap-2">
                Explore Tokens
                {wsConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Live
                  </span>
                )}
              </h1>
              <p className="text-ui-text-secondary mt-1">
                {sortedTokens.length} tokens trading on Stellar
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowActivityFeed(!showActivityFeed)}
                className={`p-2 rounded-lg transition-colors lg:hidden ${
                  showActivityFeed ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Clock className="h-5 w-5" />
              </button>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => {
                    playClick();
                    setViewMode('grid');
                  }}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' ? 'bg-white shadow-sm' : ''
                  }`}
                >
                  <Grid3X3 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    playClick();
                    setViewMode('list');
                  }}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow-sm' : ''
                  }`}
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-xl border border-ui-border p-4 space-y-4">
            {/* Search Bar */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                  showFilters
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-gray-600 border-ui-border hover:bg-gray-50'
                }`}
              >
                <SlidersHorizontal className="h-5 w-5" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>

            {/* Sort Pills */}
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((option) => (
                <motion.button
                  key={option.id}
                  variants={filterPillVariants}
                  animate={sortBy === option.id ? 'active' : 'inactive'}
                  onClick={() => handleSortChange(option.id as SortOption)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-shadow hover:shadow-md"
                >
                  {option.icon}
                  {option.label}
                </motion.button>
              ))}
            </div>

            {/* Expanded Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 border-t border-ui-border space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Token Status
                      </label>
                      <div className="flex gap-2">
                        {(['all', 'bonding', 'graduated'] as StatusFilter[]).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              statusFilter === status
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {status === 'all' ? 'All' : status === 'bonding' ? 'Bonding Curve' : 'Graduated'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tokens Grid/List */}
          {tokensLoading ? (
            <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
              <Loader2 className="h-12 w-12 text-brand-primary animate-spin mx-auto mb-4" />
              <p className="text-ui-text-secondary">Loading tokens...</p>
            </div>
          ) : sortedTokens.length === 0 ? (
            <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="h-10 w-10 text-brand-primary" />
                </div>
                <h3 className="text-xl font-bold text-ui-text-primary mb-2">
                  No tokens found
                </h3>
                <p className="text-ui-text-secondary mb-6">
                  {searchQuery
                    ? `No tokens match "${searchQuery}"`
                    : 'Be the first to launch a token!'}
                </p>
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-colors"
                >
                  <Sparkles className="h-5 w-5" />
                  Launch Token
                </Link>
              </div>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
                  : 'space-y-4'
              }
            >
              {sortedTokens.map((token: { address: string }, index: number) => (
                <motion.div key={token.address} variants={itemVariants}>
                  <TokenCardPremium
                    tokenAddress={token.address}
                    trendingRank={trendingTokens.has(token.address) ? index + 1 : undefined}
                    isNew={
                      new Date((token as { createdAt?: string }).createdAt || 0).getTime() >
                      Date.now() - 24 * 60 * 60 * 1000
                    }
                    compact={viewMode === 'list'}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Sidebar - Activity Feed */}
        <AnimatePresence>
          {showActivityFeed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="hidden lg:block w-80 flex-shrink-0 space-y-6"
            >
              {/* Streak Counter */}
              {isConnected && (
                <StreakCounter
                  currentStreak={streakData.currentStreak}
                  longestStreak={streakData.longestStreak}
                  lastTradeDate={streakData.lastTradeDate}
                  compact
                />
              )}

              {/* Activity Feed */}
              <LiveActivityFeed
                maxItems={15}
                compact
                pollInterval={15000}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Activity Feed Drawer */}
      <AnimatePresence>
        {showActivityFeed && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
          >
            <div className="bg-white border-t border-ui-border rounded-t-3xl shadow-2xl max-h-[60vh] overflow-hidden">
              <div className="p-4 border-b border-ui-border flex items-center justify-between">
                <h3 className="font-bold text-ui-text-primary">Live Activity</h3>
                <button
                  onClick={() => setShowActivityFeed(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(60vh-60px)]">
                <LiveActivityFeed
                  maxItems={10}
                  compact
                  showHeader={false}
                  pollInterval={15000}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
