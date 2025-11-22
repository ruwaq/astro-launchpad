'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLeaderboard } from '@/hooks/useApi';
import { truncateAddress, formatCompactNumber } from '@/lib/stellar/utils';

type LeaderboardType = 'TRADERS' | 'CREATORS' | 'LIQUIDITY_PROVIDERS' | 'VIRAL_TOKENS';
type LeaderboardTimeframe = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'ALL_TIME';

export default function LeaderboardPage() {
  const [selectedType, setSelectedType] = useState<LeaderboardType>('TRADERS');
  const [selectedTimeframe, setSelectedTimeframe] = useState<LeaderboardTimeframe>('DAY');

  const { data, loading, error } = useLeaderboard({
    type: selectedType,
    limit: 100,
    timeframe: selectedTimeframe,
  });

  const leaderboard = data?.leaderboard || [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </DashboardLayout>
    );
  }

  const timeframeLabels: Record<LeaderboardTimeframe, string> = {
    HOUR: '1H',
    DAY: '24H',
    WEEK: '7D',
    MONTH: '30D',
    ALL_TIME: 'All Time',
  };

  const typeLabels: Record<LeaderboardType, string> = {
    TRADERS: 'Top Traders',
    CREATORS: 'Top Creators',
    LIQUIDITY_PROVIDERS: 'Top LPs',
    VIRAL_TOKENS: 'Viral Tokens',
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-gray-600">
          {selectedType === 'TRADERS' && 'Top traders ranked by volume'}
          {selectedType === 'CREATORS' && 'Top token creators ranked by tokens created'}
          {selectedType === 'LIQUIDITY_PROVIDERS' && 'Top liquidity providers ranked by TVL'}
          {selectedType === 'VIRAL_TOKENS' && 'Most viral tokens'}
        </p>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Type Filter */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
              Leaderboard Type
            </label>
            <div className="flex gap-2">
              {(Object.keys(typeLabels) as LeaderboardType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedType === type
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {typeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe Filter */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
              Timeframe
            </label>
            <div className="flex gap-2">
              {(Object.keys(timeframeLabels) as LeaderboardTimeframe[]).map((timeframe) => (
                <button
                  key={timeframe}
                  onClick={() => setSelectedTimeframe(timeframe)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTimeframe === timeframe
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {timeframeLabels[timeframe]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!loading && leaderboard.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">No Data Yet</h3>
            <p className="text-gray-600 mb-6">
              No {typeLabels[selectedType].toLowerCase()} found for this timeframe. Be the first!
            </p>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-brand-primary-dark transition-colors font-medium"
            >
              Start Trading
            </Link>
          </div>
        </div>
      )}

      {/* Leaderboard Content */}
      {!loading && leaderboard.length > 0 && (
        <div>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="mb-8 flex justify-center items-end gap-4">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-3xl font-bold text-white">2</span>
            </div>
            <div className="bg-white rounded-lg p-4 w-48 text-center shadow-lg border-2 border-gray-400">
              <div className="font-semibold text-gray-900 mb-1">
                {truncateAddress(leaderboard[1].address, 6)}
              </div>
              <div className="text-sm text-gray-600 mb-2">
                ${formatCompactNumber(parseFloat(leaderboard[1].volume24h))}
              </div>
              <div className="text-xs text-gray-500">
                {leaderboard[1].trades24h} trades
              </div>
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center -mt-8">
            <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-2 shadow-xl">
              <span className="text-4xl font-bold text-white">1</span>
            </div>
            <div className="bg-white rounded-lg p-6 w-56 text-center shadow-xl border-4 border-yellow-400">
              <div className="font-bold text-gray-900 mb-1 text-lg">
                {truncateAddress(leaderboard[0].address, 6)}
              </div>
              <div className="text-base text-gray-600 mb-2 font-semibold">
                ${formatCompactNumber(parseFloat(leaderboard[0].volume24h))}
              </div>
              <div className="text-sm text-gray-500">
                {leaderboard[0].trades24h} trades
              </div>
              <div className={`text-xs mt-2 ${
                parseFloat(leaderboard[0].profitLoss24h) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                P/L: ${formatCompactNumber(parseFloat(leaderboard[0].profitLoss24h))}
              </div>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-3xl font-bold text-white">3</span>
            </div>
            <div className="bg-white rounded-lg p-4 w-48 text-center shadow-lg border-2 border-orange-400">
              <div className="font-semibold text-gray-900 mb-1">
                {truncateAddress(leaderboard[2].address, 6)}
              </div>
              <div className="text-sm text-gray-600 mb-2">
                ${formatCompactNumber(parseFloat(leaderboard[2].volume24h))}
              </div>
              <div className="text-xs text-gray-500">
                {leaderboard[2].trades24h} trades
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                {selectedType === 'TRADERS' && (
                  <>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volume
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trades
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P/L
                    </th>
                  </>
                )}
                {selectedType === 'CREATORS' && (
                  <>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tokens Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Volume
                    </th>
                  </>
                )}
                {selectedType === 'LIQUIDITY_PROVIDERS' && (
                  <>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Liquidity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fees Earned
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((entry: any) => {
                const profitLoss = entry.profitLoss24h ? parseFloat(entry.profitLoss24h) : 0;
                const isProfit = profitLoss >= 0;

                return (
                  <tr key={entry.address} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          entry.rank === 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : entry.rank === 2
                            ? 'bg-gray-100 text-gray-800'
                            : entry.rank === 3
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-50 text-blue-800'
                        }`}>
                          {entry.rank}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {truncateAddress(entry.address, 8)}
                      </div>
                      {entry.user && entry.user.level > 1 && (
                        <div className="text-xs text-gray-500">
                          Level {entry.user.level} • {entry.user.points} pts
                        </div>
                      )}
                    </td>
                    {selectedType === 'TRADERS' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-gray-900">
                            ${formatCompactNumber(parseFloat(entry.volume24h || '0'))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                          {entry.trades24h || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className={`text-sm font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                            {isProfit ? '+' : ''}${formatCompactNumber(Math.abs(profitLoss))}
                          </div>
                        </td>
                      </>
                    )}
                    {selectedType === 'CREATORS' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {entry.tokensCreated || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-gray-900">
                            ${formatCompactNumber(parseFloat(entry.totalVolumeGenerated || '0'))}
                          </div>
                        </td>
                      </>
                    )}
                    {selectedType === 'LIQUIDITY_PROVIDERS' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-gray-900">
                            ${formatCompactNumber(parseFloat(entry.totalLiquidity || '0'))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-green-600">
                            ${formatCompactNumber(parseFloat(entry.feesEarned24h || '0'))}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      )}

      {/* Info Card */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">About the Leaderboard</h3>
        <p className="text-sm text-blue-800">
          {selectedType === 'TRADERS' && (
            <>
              Rankings are based on trading volume for the selected timeframe.
              The P/L column shows profit/loss from token buys and sells.
              Trade more to climb the ranks!
            </>
          )}
          {selectedType === 'CREATORS' && (
            <>
              Rankings are based on the number of tokens created in the selected timeframe.
              Total volume shows the combined trading volume of all your created tokens.
              Create successful tokens to climb the ranks!
            </>
          )}
          {selectedType === 'LIQUIDITY_PROVIDERS' && (
            <>
              Rankings are based on total liquidity provided across all pools.
              Fees earned shows your share of trading fees.
              Provide more liquidity to earn more fees!
            </>
          )}
        </p>
      </div>
    </DashboardLayout>
  );
}
