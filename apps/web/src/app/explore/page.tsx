'use client';

// Force dynamic rendering to avoid build-time errors with contract service
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Search, Filter, TrendingUp, Loader2, ExternalLink } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { formatCompactNumber, stroopsToXlm } from '@/lib/stellar/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useQuery, gql } from '@apollo/client';

type SortOption = 'trending' | 'new' | 'marketCap' | 'volume' | 'graduation';
type StatusFilter = 'all' | 'bonding' | 'graduated';

export default function ExplorePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();

  // Fetch ALL tokens from GraphQL API (not filtered by user)
  const { data: tokensData, loading: tokensLoading } = useQuery(gql`
    query GetAllTokens($limit: Int!, $orderBy: TokenOrderBy!) {
      tokens(limit: $limit, orderBy: $orderBy) {
        edges {
          address
          name
          symbol
          imageUrl
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
        pageInfo {
          total
          hasNextPage
        }
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
  const [tokens, setTokens] = useState<any[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('new');

  // Extract tokens from GraphQL response
  useEffect(() => {
    if (tokensData?.tokens?.edges) {
      // edges is already an array of Token objects (not {node: Token})
      setTokens(tokensData.tokens.edges);
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
          const progressA = (parseFloat(a.xlmRaised || '0') / 10000) * 100;
          const progressB = (parseFloat(b.xlmRaised || '0') / 10000) * 100;
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
    } catch (error: any) {
      // Error already shown by WalletContext
    }
  };

  // Token Card Component
  const TokenCard = ({ token }: { token: any }) => {
    const graduationProgress = Math.min(
      (parseFloat(token.xlmRaised || '0') / 10000) * 100,
      100
    );

    return (
      <Link
        href={`/t/${token.address}`}
        className="block bg-white rounded-xl p-6 border border-ui-border hover:border-brand-primary transition-all hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          {/* Token Image */}
          {token.imageUrl ? (
            <img
              src={token.imageUrl}
              alt={token.symbol}
              className="w-12 h-12 rounded-lg flex-shrink-0"
              onError={(e) => {
                // Fallback to gradient if image fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {token.symbol?.charAt(0) || '?'}
            </div>
          )}

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-ui-text-primary truncate">
                  {token.name}
                </h3>
                <p className="text-sm text-ui-text-secondary">${token.symbol}</p>
              </div>
              <span
                className={`px-2 py-1 text-xs font-medium rounded ${
                  !token.graduated
                    ? 'bg-brand-blue-50 text-brand-blue'
                    : 'bg-brand-green-50 text-brand-green'
                }`}
              >
                {token.graduated ? 'Graduated' : 'Bonding'}
              </span>
            </div>

            {/* Graduation Progress */}
            {!token.graduated && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-ui-text-secondary mb-2">
                  <span>Graduation Progress</span>
                  <span>{graduationProgress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-brand-primary to-brand-blue h-2 rounded-full transition-all"
                    style={{ width: `${graduationProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-ui-text-secondary">XLM Raised</p>
                <p className="text-sm font-semibold text-ui-text-primary">
                  {formatCompactNumber(parseFloat(token.xlmRaised || '0') / 10_000_000)} XLM
                </p>
              </div>
              <div>
                <p className="text-xs text-ui-text-secondary">Market Cap</p>
                <p className="text-sm font-semibold text-ui-text-primary">
                  ${formatCompactNumber(parseFloat(token.marketCap || '0') / 10_000_000)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-4 pt-4 border-t border-ui-border flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-blue-50 text-brand-blue text-xs font-medium rounded">
            🛡️ Fair Launch
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-green-50 text-brand-green text-xs font-medium rounded">
            🔒 Real SAC
          </span>
        </div>
      </Link>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary">
            Explore Tokens
          </h1>
          <p className="text-ui-text-secondary mt-1">
            Discover and trade real SAC tokens on Stellar Testnet
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-4 border border-ui-border">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-ui-text-secondary" />
                <input
                  type="text"
                  placeholder="Search by name or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
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

            {/* Sort */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-ui-border">
              <span className="text-sm font-medium text-ui-text-secondary">Sort by:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSortBy('new')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === 'new'
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-ui-text-secondary hover:bg-gray-200'
                  }`}
                >
                  New
                </button>
                <button
                  onClick={() => setSortBy('marketCap')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === 'marketCap'
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-ui-text-secondary hover:bg-gray-200'
                  }`}
                >
                  Market Cap
                </button>
                <button
                  onClick={() => setSortBy('graduation')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === 'graduation'
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-ui-text-secondary hover:bg-gray-200'
                  }`}
                >
                  Graduation %
                </button>
              </div>
            </div>
          </div>

        {/* Content */}
        {tokensLoading ? (
          // Loading state
          <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
            <Loader2 className="h-12 w-12 text-brand-primary animate-spin mx-auto mb-4" />
            <p className="text-ui-text-secondary">Loading tokens from platform...</p>
          </div>
        ) : filteredTokens.length === 0 ? (
          // Empty state (no tokens found)
          <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-brand-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
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
                  className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium"
                >
                  Create Token
                </Link>
              )}
            </div>
          </div>
        ) : (
          // Tokens grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTokens.map((token) => (
              <TokenCard key={token.token_address} token={token} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
