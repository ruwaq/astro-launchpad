'use client';

import { usePools, useTopPools } from '@/hooks/useApi';
import { useWallet as useWalletContext } from '@/contexts/WalletContext';
import { formatCompactNumber, truncateAddress, getTimeAgo } from '@/lib/stellar/utils';
import toast from 'react-hot-toast';

export default function PoolsPage() {
  const { address } = useWalletContext();
  const { data, loading, error } = usePools({ first: 50 });
  const { data: topPoolsData } = useTopPools(5);

  const pools = data?.pools.edges.map((edge: any) => edge.node) || [];
  const topPools = topPoolsData?.pools.edges.map((edge: any) => edge.node) || [];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading pools. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Liquidity Pools</h1>
        <p className="text-gray-600">Provide liquidity and earn trading fees</p>
      </div>

      {/* Top Pools Highlight */}
      {topPools.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Top Pools by TVL</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {topPools.map((pool: any) => (
              <div
                key={pool.address}
                className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="text-sm font-medium mb-1">
                  {pool.token0.symbol}/{pool.token1.symbol}
                </div>
                <div className="text-2xl font-bold mb-2">
                  ${formatCompactNumber(parseFloat(pool.liquidity))}
                </div>
                <div className="text-xs opacity-90">
                  APY: {pool.apy}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Liquidity Button */}
      <div className="mb-6">
        <button
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            !address
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
          onClick={() => !address ? toast.error('Connect wallet first') : toast('Add liquidity feature coming soon')}
          disabled={!address}
        >
          + Add Liquidity
        </button>
      </div>

      {/* Pools Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pool
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TVL
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  24h Volume
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  APY
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fee
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No liquidity pools found
                  </td>
                </tr>
              ) : (
                pools.map((pool: any) => {
                  const volumeChange = parseFloat(pool.volumeChange24h);
                  const isPositiveChange = volumeChange >= 0;

                  return (
                    <tr key={pool.address} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex -space-x-2 mr-3">
                            {pool.token0.logoUrl && (
                              <img
                                src={pool.token0.logoUrl}
                                alt={pool.token0.symbol}
                                className="w-8 h-8 rounded-full border-2 border-white"
                              />
                            )}
                            {pool.token1.logoUrl && (
                              <img
                                src={pool.token1.logoUrl}
                                alt={pool.token1.symbol}
                                className="w-8 h-8 rounded-full border-2 border-white"
                              />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {pool.token0.symbol}/{pool.token1.symbol}
                            </div>
                            <div className="text-sm text-gray-500">
                              {truncateAddress(pool.address, 6)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          ${formatCompactNumber(parseFloat(pool.liquidity))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          ${formatCompactNumber(parseFloat(pool.volume24h))}
                        </div>
                        <div className={`text-xs ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositiveChange ? '+' : ''}{volumeChange.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-green-600">
                          {parseFloat(pool.apy).toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {pool.fee}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {getTimeAgo(Math.floor(new Date(pool.createdAt).getTime() / 1000))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => toast('Pool details coming soon')}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">What is a Liquidity Pool?</h3>
          <p className="text-sm text-blue-800 mb-2">
            Liquidity pools are smart contracts that hold reserves of two tokens to enable trading.
          </p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Earn trading fees from swaps</li>
            <li>• Provide liquidity for the ecosystem</li>
            <li>• Receive LP tokens representing your share</li>
          </ul>
        </div>

        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <h3 className="font-semibold text-green-900 mb-3">How to Earn</h3>
          <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
            <li>Add equal value of both tokens to a pool</li>
            <li>Receive LP tokens representing your share</li>
            <li>Earn a portion of all trading fees</li>
            <li>Remove liquidity anytime to claim fees</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
