/**
 * Explore Client Component
 *
 * Client-side component for the token exploration page.
 * Displays tokens fetched via SSR with client-side pagination and filtering.
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, gql } from '@apollo/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useWallet } from '@/contexts/WalletContext';
import { useBalanceRefresh } from '@/lib/events/balanceRefresh';
import { stroopsToXlm, formatCompactNumber, GRADUATION_THRESHOLD_STROOPS } from '@/lib/stellar/utils';
import { BALANCE_POLL_INTERVAL_MS } from '@/lib/constants/app';
import { TrendingUp, TrendingDown, Rocket, Search, Plus, Users, DollarSign } from 'lucide-react';
import type { TokenEdge, PageInfo } from '@/lib/graphql/types';

// GraphQL query for tokens with pagination
const GET_TOKENS = gql`
  query GetTokens($limit: Int!, $after: String, $orderBy: TokenOrderBy!, $search: String) {
    tokens(limit: $limit, after: $after, orderBy: $orderBy, search: $search) {
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

type SortOption = 'CREATED_AT_DESC' | 'VOLUME_DESC' | 'MARKET_CAP_DESC' | 'PRICE_CHANGE_DESC';

interface ExploreClientProps {
  initialTokens: {
    edges: TokenEdge[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

export function ExploreClient({ initialTokens }: ExploreClientProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('CREATED_AT_DESC');
  const { isConnected, connect, isConnecting } = useWallet();

  // Apollo query for real-time data
  const { data, loading, fetchMore, refetch } = useQuery(GET_TOKENS, {
    variables: {
      limit: 24,
      orderBy: sortBy,
      search: search || undefined,
    },
    pollInterval: BALANCE_POLL_INTERVAL_MS,
  });

  // Listen for balance refresh events
  useBalanceRefresh(() => {
    refetch();
  });

  // Use client data if available, fallback to server data
  const tokens = data?.tokens?.edges || initialTokens.edges;
  const pageInfo = data?.tokens?.pageInfo || initialTokens.pageInfo;
  const totalCount = data?.tokens?.totalCount ?? initialTokens.totalCount;

  // Load more tokens (pagination)
  const loadMore = useCallback(() => {
    if (pageInfo?.hasNextPage && pageInfo?.endCursor) {
      fetchMore({
        variables: { after: pageInfo.endCursor },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;
          return {
            tokens: {
              ...fetchMoreResult.tokens,
              edges: [...prev.tokens.edges, ...fetchMoreResult.tokens.edges],
            },
          };
        },
      });
    }
  }, [pageInfo, fetchMore]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary flex items-center gap-3">
              <Rocket className="h-8 w-8 text-brand-primary" />
              Explore Tokens
            </h1>
            <p className="text-ui-text-secondary mt-1">
              {totalCount} tokens launched on Astro Shiba
            </p>
          </div>
          {isConnected && (
            <Link
              href="/create"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary-dark transition-colors shadow-sm"
            >
              <Plus className="h-5 w-5" />
              Create Token
            </Link>
          )}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tokens by name or symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-ui-border bg-white text-ui-text-primary placeholder:text-ui-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            />
          </div>
          <div className="flex gap-2">
            {([
              ['CREATED_AT_DESC', 'New'],
              ['VOLUME_DESC', 'Volume'],
              ['MARKET_CAP_DESC', 'Mkt Cap'],
              ['PRICE_CHANGE_DESC', 'Gainers'],
            ] as [SortOption, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSortBy(value)}
                className={`px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                  sortBy === value
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-ui-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Connect Wallet Banner (when not connected) */}
        {!isConnected && (
          <div className="bg-brand-blue-50 border border-brand-blue-200 rounded-xl p-4 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-brand-blue rounded-lg hidden sm:block">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-blue-900">Connect Your Wallet</h3>
                <p className="text-sm text-brand-blue-700 mt-1">
                  Connect to trade tokens and track your portfolio!
                </p>
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className="mt-3 px-5 py-2.5 min-h-[44px] bg-brand-blue text-white rounded-lg hover:bg-brand-blue-600 transition-colors font-medium disabled:opacity-50 text-sm"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Token Grid */}
        {loading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-ui-border p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 bg-gray-200 rounded" />
                  <div className="h-2 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12">
            <Rocket className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-ui-text-primary mb-2">No Tokens Found</h3>
            <p className="text-ui-text-secondary mb-6 max-w-sm mx-auto">
              {search ? 'No tokens match your search. Try a different keyword.' : 'Be the first to launch a token!'}
            </p>
            {!search && (
              <Link
                href="/create"
                className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-brand-primary-dark transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                Launch Token
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tokens.map((edge: TokenEdge) => {
              const token = edge.node;
              const xlmRaised = BigInt(token.xlmRaised || '0');
              const graduationPercent = Math.min(
                Number((xlmRaised * BigInt(100)) / GRADUATION_THRESHOLD_STROOPS),
                100
              );
              const isGraduated = token.graduated;
              const formattedPrice = stroopsToXlm(token.currentPrice || '0', 7);
              const formattedMarketCap = formatCompactNumber(
                parseFloat(stroopsToXlm(token.marketCap || '0'))
              );
              const priceChange = parseFloat(token.priceChange24h || '0');

              return (
                <Link
                  key={token.address}
                  href={`/t/${token.address}`}
                  className="block bg-white rounded-xl border border-ui-border hover:border-brand-primary hover:shadow-lg transition-all duration-200 overflow-hidden group"
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image
                          src={token.imageUrl || token.logoUrl || '/images/default-token.svg'}
                          alt={token.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-ui-text-primary truncate group-hover:text-brand-primary transition-colors">
                              {token.name}
                            </h3>
                            <p className="text-sm text-ui-text-secondary">${token.symbol}</p>
                          </div>
                          {priceChange !== 0 && (
                            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                              priceChange > 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                            }`}>
                              {priceChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {priceChange > 0 ? `+${priceChange.toFixed(1)}%` : `${priceChange.toFixed(1)}%`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="min-w-0">
                        <p className="text-xs text-ui-text-secondary">Price</p>
                        <p className="font-semibold text-ui-text-primary text-sm truncate">{formattedPrice} XLM</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-ui-text-secondary">Market Cap</p>
                        <p className="font-semibold text-ui-text-primary text-sm truncate">${formattedMarketCap}</p>
                      </div>
                    </div>

                    {/* Graduation Progress */}
                    {!isGraduated ? (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-ui-text-secondary">Graduation Progress</span>
                          <span className="font-medium text-brand-primary">{graduationPercent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-primary to-brand-blue transition-all duration-300"
                            style={{ width: `${graduationPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-lg py-2">
                        <span className="text-sm font-semibold text-green-700">GRADUATED</span>
                      </div>
                    )}

                    {/* Volume */}
                    <div className="flex items-center gap-1 text-xs text-ui-text-secondary mt-3 pt-3 border-t border-ui-border">
                      <DollarSign className="h-3 w-3" />
                      <span>{formatCompactNumber(parseFloat(stroopsToXlm(token.volume24h || '0')))} XLM vol</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {pageInfo?.hasNextPage && (
          <div className="text-center pt-4">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-6 py-3 bg-white text-ui-text-primary border border-ui-border rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More Tokens'}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}