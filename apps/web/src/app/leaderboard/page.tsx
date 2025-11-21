'use client';

import { useLeaderboard } from '@/hooks/useApi';
import { truncateAddress, formatCompactNumber } from '@/lib/stellar/utils';

export default function LeaderboardPage() {
  const { data, loading, error } = useLeaderboard(100);

  const leaderboard = data?.leaderboard || [];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading leaderboard. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-gray-600">Top traders by 24h volume</p>
      </div>

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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  24h Volume
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  24h Trades
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  24h P/L
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No traders yet
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry: any) => {
                  const profitLoss = parseFloat(entry.profitLoss24h);
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          ${formatCompactNumber(parseFloat(entry.volume24h))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {entry.trades24h}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                          {isProfit ? '+' : ''}${formatCompactNumber(Math.abs(profitLoss))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">About the Leaderboard</h3>
        <p className="text-sm text-blue-800">
          Rankings are based on 24-hour trading volume. Trade more to climb the ranks and showcase
          your trading prowess!
        </p>
      </div>
    </div>
  );
}
