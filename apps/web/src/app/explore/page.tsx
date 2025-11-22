'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Search, Filter, TrendingUp, Loader2, ExternalLink } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { formatCompactNumber, stroopsToXlm } from '@/lib/stellar/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';

type SortOption = 'trending' | 'new' | 'marketCap' | 'volume' | 'graduation';
type StatusFilter = 'all' | 'bonding' | 'graduated';

export default function ExplorePage() {
  const { address, isConnected, connect, isConnecting } = useWallet();

  // State
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('new');

  // Fetch tokens from SAC Factory contract
  useEffect(() => {
    if (isConnected && address) {
      fetchTokens();
    }
  }, [isConnected, address]);

  // Apply filters and search
  useEffect(() => {
    let result = [...tokens];

    // Apply search
    if (searchQuery) {
      result = result.filter(token =>
        token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(token => {
        if (statusFilter === 'bonding') return token.status === 'Bonding';
        if (statusFilter === 'graduated') return token.status === 'Graduated';
        return true;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'new':
          // Convert BigInt to Number for comparison
          return Number(b.created_at - a.created_at);
        case 'marketCap':
          return Number(BigInt(b.market_cap) - BigInt(a.market_cap));
        case 'graduation':
          const progressA = (Number(a.xlm_raised) / 10000) * 100;
          const progressB = (Number(b.xlm_raised) / 10000) * 100;
          return progressB - progressA;
        default:
          // Convert BigInt to Number for comparison
          return Number(b.created_at - a.created_at);
      }
    });

    setFilteredTokens(result);
  }, [tokens, searchQuery, statusFilter, sortBy]);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      // Get token count first
      const count = await sacFactoryService.getTokenCount();

      if (count === 0) {
        setTokens([]);
        setLoading(false);
        return;
      }

      // Fetch token info for each token
      // In production, this should be paginated and batched
      const tokenPromises: Promise<TokenInfo | null>[] = [];

      // For now, fetch last 20 tokens (or all if less than 20)
      const tokensToFetch = Math.min(count, 20);

      // Get creator's tokens (they should know their own tokens)
      if (address) {
        const creatorTokenAddresses = await sacFactoryService.getCreatorTokensPaginated(
          address,
          0,
          20
        );

        // Fetch info for creator's tokens
        for (const tokenAddress of creatorTokenAddresses) {
          tokenPromises.push(sacFactoryService.getTokenInfo(tokenAddress));
        }
      }

      const tokenInfos = await Promise.all(tokenPromises);
      const validTokens = tokenInfos.filter((t): t is TokenInfo => t !== null);

      setTokens(validTokens);
    } catch (error: any) {
      console.error('Error fetching tokens:', error);
      toast.error('Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected! Loading tokens...');
    } catch (error: any) {
      // Error already shown by WalletContext
    }
  };

  // Token Card Component
  const TokenCard = ({ token }: { token: TokenInfo }) => {
    const graduationProgress = Math.min(
      (Number(token.xlm_raised) / 10000) * 100,
      100
    );

    return (
      <Link
        href={`/t/${token.token_address}`}
        className="block bg-white rounded-xl p-6 border border-ui-border hover:border-brand-primary transition-all hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          {/* Token Image Placeholder */}
          <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {token.symbol.charAt(0)}
          </div>

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
                  token.status === 'Bonding'
                    ? 'bg-brand-blue-50 text-brand-blue'
                    : 'bg-brand-green-50 text-brand-green'
                }`}
              >
                {token.status}
              </span>
            </div>

            {/* Graduation Progress */}
            {token.status === 'Bonding' && (
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
                  {formatCompactNumber(parseFloat(stroopsToXlm(token.xlm_raised)))} XLM
                </p>
              </div>
              <div>
                <p className="text-xs text-ui-text-secondary">Market Cap</p>
                <p className="text-sm font-semibold text-ui-text-primary">
                  ${formatCompactNumber(parseFloat(token.market_cap) / 10000000)}
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
        {isConnected && (
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
        )}

        {/* Content */}
        {!isConnected ? (
          // Not connected state
          <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-brand-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-10 w-10 text-brand-primary" />
              </div>
              <h3 className="text-xl font-bold text-ui-text-primary mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-ui-text-secondary mb-6">
                Connect your Stellar wallet to explore real SAC tokens on testnet
              </p>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          </div>
        ) : loading ? (
          // Loading state
          <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
            <Loader2 className="h-12 w-12 text-brand-primary animate-spin mx-auto mb-4" />
            <p className="text-ui-text-secondary">Loading tokens from SAC Factory...</p>
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
