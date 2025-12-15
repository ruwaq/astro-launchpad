/**
 * Explore Client Component
 *
 * Handles all client-side interactivity for the explore page.
 * Receives initial data from the Server Component.
 *
 * Features:
 * - Search with debounce
 * - Status filtering (Bonding/Graduated)
 * - Sort options (New, Trending, Market Cap, Graduation %)
 * - Infinite scroll / Load more
 * - Live activity feed toggle
 * - Framer Motion animations
 *
 * Pattern: Server/Client Component boundary for Next.js 15
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TokenCardPremium } from '@/components/token/TokenCardPremium';
import { LiveActivityFeed } from '@/components/activity/LiveActivityFeed';
import { Search, TrendingUp, Loader2, Flame, Sparkles, Activity, Filter, ChevronDown } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import toast from 'react-hot-toast';
import { useQuery, gql } from '@apollo/client';
import type { Token, TokenEdge, PageInfo } from '@/lib/graphql/types';
import { useDebounce } from '@/hooks/useDebounce';
import { SearchResultsAnnouncer } from '@/components/accessibility/LiveRegion';

type SortOption = 'trending' | 'new' | 'marketCap' | 'volume' | 'graduation';
type StatusFilter = 'ALL' | 'BONDING' | 'GRADUATED';

// Map frontend sort options to GraphQL orderBy enum
const sortToOrderBy: Record<SortOption, string> = {
  new: 'CREATED_AT_DESC',
  trending: 'VOLUME_DESC',
  marketCap: 'MARKET_CAP_DESC',
  volume: 'VOLUME_DESC',
  graduation: 'GRADUATION_DESC',
};

// Animation variants for staggered children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// GraphQL query with server-side search, filter, and sort
const GET_TOKENS = gql`
  query GetAllTokens($limit: Int!, $after: String, $orderBy: TokenOrderBy!, $search: String, $status: TokenStatus) {
    tokens(limit: $limit, after: $after, orderBy: $orderBy, search: $search, status: $status) {
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
        endCursor
      }
      totalCount
    }
  }
`;

interface TokensConnection {
  edges: TokenEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

interface ExploreClientProps {
  initialTokens: TokensConnection;
}

export function ExploreClient({ initialTokens }: ExploreClientProps) {
  const { connect } = useWallet();

  // Pagination constants
  const TOKENS_PER_PAGE = 24;

  // State for filters (these trigger server-side filtering)
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('new');

  // Build query variables
  const queryVariables = useMemo(() => ({
    limit: TOKENS_PER_PAGE,
    after: null as string | null,
    orderBy: sortToOrderBy[sortBy],
    search: debouncedSearchQuery || null,
    status: statusFilter,
  }), [sortBy, debouncedSearchQuery, statusFilter]);

  // Apollo takes over for real-time updates
  const { data: tokensData, loading: tokensLoading, error: tokensError, fetchMore } = useQuery(GET_TOKENS, {
    variables: queryVariables,
    pollInterval: 30000,
    notifyOnNetworkStatusChange: true,
  });

  // Track if we're loading more
  const [loadingMore, setLoadingMore] = useState(false);

  // Load more tokens handler - maintains current filters
  const handleLoadMore = useCallback(async () => {
    const currentData = tokensData?.tokens || initialTokens;
    if (!currentData?.pageInfo?.hasNextPage || loadingMore) return;

    setLoadingMore(true);
    try {
      await fetchMore({
        variables: {
          ...queryVariables,
          after: currentData.pageInfo.endCursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return {
            tokens: {
              ...fetchMoreResult.tokens,
              edges: [
                ...prev.tokens.edges,
                ...fetchMoreResult.tokens.edges,
              ],
            },
          };
        },
      });
    } catch (error) {
      console.error('Error loading more tokens:', error);
      toast.error('Failed to load more tokens');
    } finally {
      setLoadingMore(false);
    }
  }, [tokensData, initialTokens, fetchMore, loadingMore, queryVariables]);

  // Use client data if available, fallback to server data
  const tokensConnection = tokensData?.tokens || initialTokens;

  // Extract tokens from connection
  const tokens = useMemo(() => {
    if (!tokensConnection?.edges) return [];
    return tokensConnection.edges.map((edge: TokenEdge) => edge.node);
  }, [tokensConnection]);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected! Loading tokens...');
    } catch (error: unknown) {
      // Error already shown by WalletContext
    }
  };

  // Calculate trending rank and new status
  const getTokenMetadata = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Sort by volume for trending rank
    const byVolume = [...tokens].sort(
      (a: Token, b: Token) => parseFloat(b.volume24h || '0') - parseFloat(a.volume24h || '0')
    );

    return tokens.reduce((acc: Record<string, { isNew: boolean; trendingRank: number }>, token: Token) => {
      const createdAt = new Date(token.createdAt).getTime();
      const isNew = now - createdAt < oneDay; // New if created within 24h
      const trendingRank = byVolume.findIndex((t: Token) => t.address === token.address) + 1;

      acc[token.address] = { isNew, trendingRank };
      return acc;
    }, {} as Record<string, { isNew: boolean; trendingRank: number }>);
  }, [tokens]);

  // State for activity sidebar
  const [showActivity, setShowActivity] = useState(false);

  // Total count from server
  const totalCount = tokensConnection?.totalCount || 0;

  // Check if initial load is happening (no client data yet and loading)
  const isInitialLoading = tokensLoading && !tokensData;

  return (
    <DashboardLayout>
      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Page Header with Animation */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
          >
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-ui-text-primary flex items-center gap-3">
                <Flame className="h-8 w-8 text-brand-primary" />
                Explore Tokens
              </h1>
              <p className="text-ui-text-secondary mt-1">
                Discover and trade real SAC tokens on Stellar Testnet
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-3">
              <div className="bg-white rounded-xl px-4 py-2 border border-ui-border">
                <p className="text-xs text-ui-text-secondary">Total Tokens</p>
                <p className="text-lg font-bold text-ui-text-primary">{totalCount}</p>
              </div>
              <button
                onClick={() => setShowActivity(!showActivity)}
                className={`hidden lg:flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border transition-colors ${
                  showActivity
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white border-ui-border hover:border-brand-primary'
                }`}
              >
                <Activity className="h-4 w-4" />
                Live Feed
              </button>
            </div>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-4 border border-ui-border shadow-sm"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-ui-text-secondary" />
                <input
                  type="text"
                  placeholder="Search by name or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary transition-shadow"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-4 py-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                  aria-label="Filter tokens by status"
                >
                  <option value="ALL">All Status</option>
                  <option value="BONDING">Bonding</option>
                  <option value="GRADUATED">Graduated</option>
                </select>
              </div>
            </div>

            {/* Sort Tabs */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-ui-border" role="group" aria-label="Sort options">
              <span className="text-sm font-medium text-ui-text-secondary flex items-center gap-1">
                <Filter className="h-4 w-4" aria-hidden="true" />
                Sort:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'new', label: 'New', icon: <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> },
                  { id: 'trending', label: 'Trending', icon: <Flame className="h-3.5 w-3.5" aria-hidden="true" /> },
                  { id: 'marketCap', label: 'Market Cap', icon: <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> },
                  { id: 'graduation', label: 'Graduation %', icon: null },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSortBy(option.id as SortOption)}
                    aria-label={`Sort by ${option.label}`}
                    aria-pressed={sortBy === option.id}
                    className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-sm font-medium transition-all ${
                      sortBy === option.id
                        ? 'bg-brand-primary text-white shadow-md'
                        : 'bg-gray-100 text-ui-text-secondary hover:bg-gray-200'
                    }`}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Screen reader announcement for search results */}
          <SearchResultsAnnouncer
            count={tokens.length}
            isLoading={isInitialLoading}
            searchTerm={debouncedSearchQuery}
          />

          {/* GraphQL Error Display - only show if there's an error */}
          {tokensError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6" role="alert">
              <h3 className="font-bold text-red-700">Error loading tokens</h3>
              <p className="text-red-600 text-sm">{tokensError.message}</p>
            </div>
          )}

          {/* Content */}
          {isInitialLoading && tokens.length === 0 ? (
            // Loading state with skeleton - matches main grid responsive classes
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-ui-border p-4 animate-pulse"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-6 bg-gray-200 rounded w-1/2" />
                    <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-12 bg-gray-100 rounded" />
                      ))}
                    </div>
                    <div className="h-2 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : tokens.length === 0 ? (
            // Empty state (no tokens found)
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl border border-ui-border p-12 text-center"
            >
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-brand-primary/20 to-brand-blue/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="h-10 w-10 text-brand-primary" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-ui-text-primary mb-2">
                  {!debouncedSearchQuery && statusFilter === 'ALL'
                    ? 'No tokens created yet'
                    : 'No tokens match your filters'}
                </h3>
                <p className="text-ui-text-secondary mb-6">
                  {!debouncedSearchQuery && statusFilter === 'ALL'
                    ? 'Be the first to create a token on SAC Factory!'
                    : 'Try adjusting your search or filters'}
                </p>
                {!debouncedSearchQuery && statusFilter === 'ALL' && (
                  <Link
                    href="/create"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors font-medium shadow-lg shadow-brand-primary/25"
                  >
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                    Create Token
                  </Link>
                )}
              </div>
            </motion.div>
          ) : (
            // Premium Tokens Grid with staggered animation - responsive for mobile
            <>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"
                role="list"
                aria-label="Token list"
              >
                <AnimatePresence mode="popLayout">
                  {tokens.map((token: Token) => {
                    const metadata = getTokenMetadata[token.address] || { isNew: false, trendingRank: 0 };
                    return (
                      <motion.div
                        key={token.address}
                        variants={itemVariants}
                        layout
                        exit={{ opacity: 0, scale: 0.9 }}
                        role="listitem"
                      >
                        <TokenCardPremium
                          token={token}
                          isNew={metadata.isNew}
                          trendingRank={sortBy === 'trending' ? metadata.trendingRank : undefined}
                          showQuickActions={true}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>

              {/* Load More Button - only show if there are more tokens */}
              {tokensConnection?.pageInfo?.hasNextPage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center mt-8"
                >
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    aria-label={loadingMore ? 'Loading more tokens' : `Load more tokens, showing ${tokens.length} of ${totalCount}`}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] bg-white border border-ui-border rounded-xl font-medium text-ui-text-primary hover:bg-gray-50 hover:border-brand-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-5 w-5" aria-hidden="true" />
                        Load More Tokens
                        <span className="text-sm text-ui-text-secondary ml-1">
                          ({tokens.length} of {totalCount})
                        </span>
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Live Activity Sidebar - Desktop Only */}
        <AnimatePresence>
          {showActivity && (
            <motion.div
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 380 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              className="hidden lg:block flex-shrink-0"
            >
              <div className="sticky top-24">
                <LiveActivityFeed maxItems={10} pollInterval={15000} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
