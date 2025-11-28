'use client';

// Force dynamic rendering to avoid build-time errors with contract service
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TokenCardPremium } from '@/components/token/TokenCardPremium';
import { LiveActivityFeed } from '@/components/activity/LiveActivityFeed';
import { Search, TrendingUp, Loader2, Flame, Sparkles, Activity, Filter } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import toast from 'react-hot-toast';
import { useQuery, gql } from '@apollo/client';
import type { Token, TokenEdge } from '@/lib/graphql/types';
import { GRADUATION_THRESHOLD_XLM } from '@/lib/stellar/utils';

type SortOption = 'trending' | 'new' | 'marketCap' | 'volume' | 'graduation';
type StatusFilter = 'all' | 'bonding' | 'graduated';

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

export default function ExplorePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();

  // Fetch ALL tokens from GraphQL API (not filtered by user)
  const { data: tokensData, loading: tokensLoading, error: tokensError } = useQuery(gql`
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
          total
          hasNextPage
        }
        totalCount
      }
    }
  `, {
    variables: {
      limit: 100,
      orderBy: 'CREATED_AT_DESC'
    },
    pollInterval: 30000,
  });

  // State
  const [tokens, setTokens] = useState<Token[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('new');

  // Extract tokens from GraphQL response
  useEffect(() => {
    if (tokensData?.tokens?.edges) {
      // Extract token data from edges[].node structure
      const tokensList = tokensData.tokens.edges.map((edge: TokenEdge) => edge.node);
      setTokens(tokensList);
    }
  }, [tokensData]);

  // Apply filters and search
  useEffect(() => {
    let result = [...tokens];

    // Apply search
    if (searchQuery) {
      result = result.filter(token =>
        token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.symbol?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(token => {
        if (statusFilter === 'bonding') return !token.graduated;
        if (statusFilter === 'graduated') return token.graduated;
        return true;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'new':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'marketCap':
          return parseFloat(b.marketCap || '0') - parseFloat(a.marketCap || '0');
        case 'volume':
          return parseFloat(b.volume24h || '0') - parseFloat(a.volume24h || '0');
        case 'graduation':
          const progressA = (parseFloat(a.xlmRaised || '0') / GRADUATION_THRESHOLD_XLM) * 100;
          const progressB = (parseFloat(b.xlmRaised || '0') / GRADUATION_THRESHOLD_XLM) * 100;
          return progressB - progressA;
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    setFilteredTokens(result);
  }, [tokens, searchQuery, statusFilter, sortBy]);

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
    const byVolume = [...filteredTokens].sort(
      (a, b) => parseFloat(b.volume24h || '0') - parseFloat(a.volume24h || '0')
    );

    return filteredTokens.reduce((acc, token, index) => {
      const createdAt = new Date(token.createdAt).getTime();
      const isNew = now - createdAt < oneDay; // New if created within 24h
      const trendingRank = byVolume.findIndex((t) => t.address === token.address) + 1;

      acc[token.address] = { isNew, trendingRank };
      return acc;
    }, {} as Record<string, { isNew: boolean; trendingRank: number }>);
  }, [filteredTokens]);

  // State for activity sidebar
  const [showActivity, setShowActivity] = useState(false);

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
              <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary flex items-center gap-3">
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
                <p className="text-lg font-bold text-ui-text-primary">{tokens.length}</p>
              </div>
              <button
                onClick={() => setShowActivity(!showActivity)}
                className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
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
                >
                  <option value="all">All Status</option>
                  <option value="bonding">Bonding</option>
                  <option value="graduated">Graduated</option>
                </select>
              </div>
            </div>

            {/* Sort Tabs */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-ui-border">
              <span className="text-sm font-medium text-ui-text-secondary flex items-center gap-1">
                <Filter className="h-4 w-4" />
                Sort:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'new', label: 'New', icon: <Sparkles className="h-3.5 w-3.5" /> },
                  { id: 'trending', label: 'Trending', icon: <Flame className="h-3.5 w-3.5" /> },
                  { id: 'marketCap', label: 'Market Cap', icon: <TrendingUp className="h-3.5 w-3.5" /> },
                  { id: 'graduation', label: 'Graduation %', icon: null },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSortBy(option.id as SortOption)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
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

          {/* GraphQL Error Display - only show if there's an error */}
          {tokensError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-red-700">Error loading tokens</h3>
              <p className="text-red-600 text-sm">{tokensError.message}</p>
            </div>
          )}

          {/* Content */}
          {tokensLoading ? (
            // Loading state with skeleton
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-12 bg-gray-100 rounded" />
                      ))}
                    </div>
                    <div className="h-2 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTokens.length === 0 ? (
            // Empty state (no tokens found)
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl border border-ui-border p-12 text-center"
            >
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-brand-primary/20 to-brand-blue/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="h-10 w-10 text-brand-primary" />
                </div>
                <h3 className="text-xl font-bold text-ui-text-primary mb-2">
                  {tokens.length === 0 ? 'No tokens created yet' : 'No tokens match your filters'}
                </h3>
                <p className="text-ui-text-secondary mb-6">
                  {tokens.length === 0
                    ? 'Be the first to create a token on SAC Factory!'
                    : 'Try adjusting your search or filters'}
                </p>
                {tokens.length === 0 && (
                  <Link
                    href="/create"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors font-medium shadow-lg shadow-brand-primary/25"
                  >
                    <Sparkles className="h-5 w-5" />
                    Create Token
                  </Link>
                )}
              </div>
            </motion.div>
          ) : (
            // Premium Tokens Grid with staggered animation
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredTokens.map((token) => {
                  const metadata = getTokenMetadata[token.address] || { isNew: false, trendingRank: 0 };
                  return (
                    <motion.div
                      key={token.address}
                      variants={itemVariants}
                      layout
                      exit={{ opacity: 0, scale: 0.9 }}
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
                <LiveActivityFeed maxItems={10} pollInterval={3000} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
