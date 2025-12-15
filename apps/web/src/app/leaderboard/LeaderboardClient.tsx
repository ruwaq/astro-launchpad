/**
 * Leaderboard Client Component
 *
 * Handles all client-side interactivity for the leaderboard page.
 * Receives initial data from the Server Component.
 *
 * Pattern: Server/Client Component boundary for Next.js 15
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLeaderboard, useGlobalStats } from '@/hooks/useApi';
import { useWallet } from '@/contexts/WalletContext';
import { truncateAddress, formatCompactNumber } from '@/lib/stellar/utils';
import { MetricCard } from '@/components/widgets/MetricCard';
import { TokensWidget } from '@/components/widgets/TokensWidget';
import { ActivityWidget } from '@/components/widgets/ActivityWidget';
import { KingOfTheHill } from '@/components/explore/KingOfTheHill';
import { TrendingUp, Rocket, Users, Lock, Zap, Plus, Trophy, Coins } from 'lucide-react';
import type { LeaderboardEntry, Token, GlobalStats } from '@/lib/graphql/types';
import { useQuery, gql } from '@apollo/client';
import toast from 'react-hot-toast';

// GraphQL query to fetch top token by volume
const GET_TOP_TOKEN = gql`
  query GetTopToken {
    tokens(limit: 1, orderBy: VOLUME_DESC, status: BONDING) {
      edges {
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
          holders
          xlmRaised
          graduated
          createdAt
        }
      }
    }
  }
`;

type LeaderboardType = 'TRADERS' | 'CREATORS' | 'LIQUIDITY_PROVIDERS';
type LeaderboardTimeframe = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'ALL_TIME';

const typeConfig: Record<LeaderboardType, { label: string; icon: typeof Trophy; description: string }> = {
  TRADERS: { label: 'Top Traders', icon: TrendingUp, description: 'Ranked by trading volume' },
  CREATORS: { label: 'Top Creators', icon: Coins, description: 'Ranked by tokens created' },
  LIQUIDITY_PROVIDERS: { label: 'Top LPs', icon: Users, description: 'Ranked by liquidity provided' },
};

const timeframeLabels: Record<LeaderboardTimeframe, string> = {
  HOUR: '1H',
  DAY: '24H',
  WEEK: '7D',
  MONTH: '30D',
  ALL_TIME: 'All',
};

interface LeaderboardClientProps {
  initialLeaderboard: LeaderboardEntry[];
  initialStats: GlobalStats | null;
  initialTopToken: Token | null;
}

export function LeaderboardClient({
  initialLeaderboard,
  initialStats,
  initialTopToken,
}: LeaderboardClientProps) {
  const [selectedType, setSelectedType] = useState<LeaderboardType>('TRADERS');
  const [selectedTimeframe, setSelectedTimeframe] = useState<LeaderboardTimeframe>('DAY');
  const { address, isConnected, connect, isConnecting } = useWallet();

  // Apollo takes over for real-time updates
  const { data: statsData, loading: statsLoading } = useGlobalStats();
  const { data, loading } = useLeaderboard({
    type: selectedType,
    limit: 50,
    timeframe: selectedTimeframe,
  });

  // Fetch top token for King of the Hill (with polling)
  const { data: topTokenData, loading: topTokenLoading } = useQuery(GET_TOP_TOKEN, {
    pollInterval: 60000, // Refresh every minute
  });

  // Use client data if available, fallback to server data
  const leaderboard = data?.leaderboard || initialLeaderboard;
  const stats = statsData?.globalStats || initialStats;

  // Extract top token from query, fallback to initial
  const topToken = useMemo(() => {
    if (topTokenData?.tokens?.edges?.[0]?.node) {
      return topTokenData.tokens.edges[0].node as Token;
    }
    return initialTopToken;
  }, [topTokenData, initialTopToken]);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      toast.error(errorMessage);
    }
  };

  const getEntryPrimaryValue = (entry: LeaderboardEntry): string => {
    switch (selectedType) {
      case 'TRADERS':
        return `$${formatCompactNumber(parseFloat(entry.volume24h || '0'))}`;
      case 'CREATORS':
        return `${entry.tokensCreated || 0}`;
      case 'LIQUIDITY_PROVIDERS':
        return `$${formatCompactNumber(parseFloat(entry.totalLiquidity || '0'))}`;
      default:
        return '';
    }
  };

  const getEntrySecondaryValue = (entry: LeaderboardEntry): string | null => {
    switch (selectedType) {
      case 'TRADERS':
        return `${entry.trades24h || 0} trades`;
      case 'CREATORS':
        return entry.totalVolumeGenerated
          ? `$${formatCompactNumber(parseFloat(entry.totalVolumeGenerated))} vol`
          : null;
      case 'LIQUIDITY_PROVIDERS':
        return entry.feesEarned24h
          ? `+$${formatCompactNumber(parseFloat(entry.feesEarned24h))} fees`
          : null;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary flex items-center gap-3">
              <Trophy className="h-8 w-8 text-brand-primary" />
              Leaderboard
            </h1>
            <p className="text-ui-text-secondary mt-1">
              Astro Shiba Token Launchpad on Stellar
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

        {/* Platform Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            title="Total Tokens"
            value={stats?.totalTokens || 0}
            loading={statsLoading && !initialStats}
            icon={<Rocket className="h-5 w-5" />}
          />
          <MetricCard
            title="Volume (24h)"
            value={formatCompactNumber(parseFloat(stats?.totalVolume24h || '0'))}
            loading={statsLoading && !initialStats}
            prefix="$"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MetricCard
            title="Users"
            value={stats?.totalUsers || 0}
            loading={statsLoading && !initialStats}
            icon={<Users className="h-5 w-5" />}
          />
          <MetricCard
            title="TVL"
            value={formatCompactNumber(parseFloat(stats?.totalTVL || '0'))}
            loading={statsLoading && !initialStats}
            prefix="$"
            icon={<Lock className="h-5 w-5" />}
          />
        </div>

        {/* King of the Hill - Top Trending Token */}
        <KingOfTheHill
          token={topToken}
          isLoading={topTokenLoading && !initialTopToken}
        />

        {/* Connect Wallet Notice */}
        {!isConnected && (
          <div className="bg-brand-blue-50 border border-brand-blue-200 rounded-xl p-4 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-brand-blue rounded-lg hidden sm:block">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-blue-900">Connect Your Wallet</h3>
                <p className="text-sm text-brand-blue-700 mt-1">
                  Connect to start trading and climb the leaderboard!
                </p>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="mt-3 px-5 py-2.5 min-h-[44px] bg-brand-blue text-white rounded-lg hover:bg-brand-blue-600 transition-colors font-medium disabled:opacity-50 text-sm"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Section */}
        <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
          {/* Leaderboard Controls */}
          <div className="p-4 border-b border-ui-border bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Type Filter */}
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(typeConfig) as LeaderboardType[]).map((type) => {
                    const config = typeConfig[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                          selectedType === type
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timeframe Filter */}
              <div className="flex gap-1">
                {(Object.keys(timeframeLabels) as LeaderboardTimeframe[]).map((timeframe) => (
                  <button
                    key={timeframe}
                    onClick={() => setSelectedTimeframe(timeframe)}
                    className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium transition-colors ${
                      selectedTimeframe === timeframe
                        ? 'bg-brand-primary text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {timeframeLabels[timeframe]}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{typeConfig[selectedType].description}</p>
          </div>

          {/* Loading State */}
          {loading && !initialLeaderboard.length && (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-20" />
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-20" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && leaderboard.length === 0 && (
            <div className="p-12 text-center">
              <Trophy className="h-16 w-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">No Rankings Yet</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                Be the first to rank! Start trading or creating tokens to appear on the leaderboard.
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-brand-primary-dark transition-colors font-medium"
              >
                <Rocket className="h-4 w-4" />
                Start Trading
              </Link>
            </div>
          )}

          {/* Top 3 Podium */}
          {leaderboard.length >= 3 && (
            <div className="p-6 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
              {/* Mobile: Compact list */}
              <div className="sm:hidden space-y-2">
                {[0, 1, 2].map((idx) => {
                  const entry = leaderboard[idx];
                  const badges = ['🥇', '🥈', '🥉'];
                  const colors = [
                    'border-l-4 border-yellow-400 bg-yellow-50',
                    'border-l-4 border-gray-400 bg-gray-50',
                    'border-l-4 border-orange-400 bg-orange-50',
                  ];
                  return (
                    <div key={entry.address} className={`flex items-center gap-3 p-3 rounded-lg ${colors[idx]}`}>
                      <span className="text-xl">{badges[idx]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{truncateAddress(entry.address, 5)}</div>
                        <div className="text-xs text-gray-500">{getEntrySecondaryValue(entry)}</div>
                      </div>
                      <div className="text-sm font-bold text-gray-900">{getEntryPrimaryValue(entry)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Podium layout */}
              <div className="hidden sm:flex justify-center items-end gap-4">
                {/* 2nd Place */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center mb-2 shadow-lg">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <div className="bg-white rounded-lg p-3 w-36 text-center shadow-md border-2 border-gray-300">
                    <div className="font-semibold text-gray-900 text-sm truncate">
                      {truncateAddress(leaderboard[1].address, 5)}
                    </div>
                    <div className="text-lg font-bold text-gray-700 mt-1">
                      {getEntryPrimaryValue(leaderboard[1])}
                    </div>
                    <div className="text-xs text-gray-500">{getEntrySecondaryValue(leaderboard[1])}</div>
                  </div>
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center -mt-6">
                  <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-2 shadow-xl ring-4 ring-yellow-200">
                    <span className="text-3xl font-bold text-white">1</span>
                  </div>
                  <div className="bg-white rounded-lg p-4 w-44 text-center shadow-xl border-4 border-yellow-400">
                    <div className="font-bold text-gray-900 truncate">
                      {truncateAddress(leaderboard[0].address, 5)}
                    </div>
                    <div className="text-xl font-bold text-yellow-600 mt-1">
                      {getEntryPrimaryValue(leaderboard[0])}
                    </div>
                    <div className="text-xs text-gray-500">{getEntrySecondaryValue(leaderboard[0])}</div>
                  </div>
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mb-2 shadow-lg">
                    <span className="text-2xl font-bold text-white">3</span>
                  </div>
                  <div className="bg-white rounded-lg p-3 w-36 text-center shadow-md border-2 border-orange-400">
                    <div className="font-semibold text-gray-900 text-sm truncate">
                      {truncateAddress(leaderboard[2].address, 5)}
                    </div>
                    <div className="text-lg font-bold text-orange-600 mt-1">
                      {getEntryPrimaryValue(leaderboard[2])}
                    </div>
                    <div className="text-xs text-gray-500">{getEntrySecondaryValue(leaderboard[2])}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full Rankings Table */}
          {leaderboard.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {selectedType === 'TRADERS' ? 'Volume' : selectedType === 'CREATORS' ? 'Tokens' : 'Liquidity'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {selectedType === 'TRADERS' ? 'Trades' : selectedType === 'CREATORS' ? 'Volume' : 'Fees'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaderboard.map((entry: LeaderboardEntry, index: number) => (
                    <tr key={entry.address} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {entry.rank}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-sm text-gray-900">{truncateAddress(entry.address, 6)}</div>
                        {entry.user?.level && entry.user.level > 1 && (
                          <div className="text-xs text-gray-400">Lvl {entry.user.level}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">{getEntryPrimaryValue(entry)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-500">{getEntrySecondaryValue(entry) || '-'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Trending Tokens + Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TokensWidget />
          <ActivityWidget />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-brand-primary-50 to-white rounded-xl p-5 border border-brand-primary-100">
            <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center mb-3">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-bold text-ui-text-primary mb-1">Instant Launch</h3>
            <p className="text-sm text-ui-text-secondary">Deploy tokens in seconds on Stellar</p>
          </div>

          <div className="bg-gradient-to-br from-brand-blue-50 to-white rounded-xl p-5 border border-brand-blue-100">
            <div className="w-10 h-10 bg-brand-blue rounded-lg flex items-center justify-center mb-3">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-bold text-ui-text-primary mb-1">Fair Launch</h3>
            <p className="text-sm text-ui-text-secondary">No pre-mints, everyone starts equal</p>
          </div>

          <div className="bg-gradient-to-br from-brand-green-50 to-white rounded-xl p-5 border border-brand-green-100">
            <div className="w-10 h-10 bg-brand-green rounded-lg flex items-center justify-center mb-3">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-bold text-ui-text-primary mb-1">LP Locked</h3>
            <p className="text-sm text-ui-text-secondary">Liquidity burned on graduation</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
