'use client';

import { useUserTransactions } from '@/hooks/useApi';
import { truncateAddress, getTimeAgo, formatCompactNumber } from '@/lib/stellar/utils';

interface TransactionHistoryProps {
  userAddress: string;
  limit?: number;
}

export function TransactionHistory({ userAddress, limit = 20 }: TransactionHistoryProps) {
  const { data, loading, error } = useUserTransactions(userAddress, limit);

  const transactions = data?.transactions.edges.map((edge: any) => edge.node) || [];

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
        <div className="text-center text-red-600 py-8">
          Error loading transactions
        </div>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BUY':
        return 'text-green-600 bg-green-50';
      case 'SELL':
        return 'text-red-600 bg-red-50';
      case 'SWAP':
        return 'text-blue-600 bg-blue-50';
      case 'ADD_LIQUIDITY':
        return 'text-purple-600 bg-purple-50';
      case 'REMOVE_LIQUIDITY':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Transaction History</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Token/Pool
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                USD Value
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                TX Hash
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No transactions yet
                </td>
              </tr>
            ) : (
              transactions.map((tx: any) => {
                const timestamp = Math.floor(new Date(tx.timestamp).getTime() / 1000);

                return (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(tx.type)}`}>
                        {tx.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {tx.token ? (
                        <div className="flex items-center">
                          {tx.token.logoUrl && (
                            <img
                              src={tx.token.logoUrl}
                              alt={tx.token.symbol}
                              className="w-6 h-6 rounded-full mr-2"
                            />
                          )}
                          <span className="font-medium">{tx.token.symbol}</span>
                        </div>
                      ) : tx.pool ? (
                        <span className="text-sm text-gray-600">
                          {truncateAddress(tx.pool.address, 6)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatCompactNumber(parseFloat(tx.amount0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      ${formatCompactNumber(parseFloat(tx.amountUSD))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-500">
                      {getTimeAgo(timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      <a
                        href={`https://testnet.stellarchain.io/transactions/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {truncateAddress(tx.txHash, 4)}
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
