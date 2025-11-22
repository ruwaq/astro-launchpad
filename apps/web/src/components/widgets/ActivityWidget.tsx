'use client';

import { useRecentTransactions } from '@/hooks/useApi';
import { truncateAddress, getTimeAgo, formatCompactNumber } from '@/lib/stellar/utils';

export function ActivityWidget() {
  const { data, loading } = useRecentTransactions(10);

  const transactions = data?.transactions.edges.map((edge: any) => edge.node) || [];

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BUY':
        return 'bg-green-100 text-green-800';
      case 'SELL':
        return 'bg-red-100 text-red-800';
      case 'SWAP':
        return 'bg-blue-100 text-blue-800';
      case 'ADD_LIQUIDITY':
        return 'bg-purple-100 text-purple-800';
      case 'REMOVE_LIQUIDITY':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUY':
        return '↑';
      case 'SELL':
        return '↓';
      case 'SWAP':
        return '⇄';
      case 'ADD_LIQUIDITY':
        return '+';
      case 'REMOVE_LIQUIDITY':
        return '-';
      default:
        return '•';
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>

      <div className="space-y-3">
        {transactions.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No recent activity</p>
        ) : (
          transactions.map((tx: any) => {
            const timestamp = Math.floor(new Date(tx.timestamp).getTime() / 1000);

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${getTypeColor(tx.type)}`}>
                    {getTypeIcon(tx.type)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {tx.type.replace('_', ' ')}
                      </span>
                      {tx.token && (
                        <span className="text-sm text-gray-600">
                          {tx.token.symbol}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {truncateAddress(tx.user, 6)} · {getTimeAgo(timestamp)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    ${formatCompactNumber(parseFloat(tx.amountUSD))}
                  </div>
                  <a
                    href={`https://testnet.stellarchain.io/transactions/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View TX
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
