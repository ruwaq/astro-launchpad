/**
 * Recent Trades Component - REAL DATA
 *
 * Displays live transaction feed from GraphQL API
 * NO MOCK DATA - Real Stellar blockchain transactions
 */

'use client';

import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { Loader2, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const RECENT_TRADES_QUERY = gql`
  query RecentTrades($tokenAddress: String!) {
    token(address: $tokenAddress) {
      address
      symbol
    }
    transactions(tokenAddress: $tokenAddress, limit: 20) {
      edges {
        cursor
        node {
          id
          hash
          type
          from
          to
          amount
          status
          timestamp
        }
      }
    }
  }
`;

interface RecentTradesProps {
  tokenAddress: string;
}

export function RecentTrades({ tokenAddress }: RecentTradesProps) {
  // Fetch real trades from GraphQL
  const { data, loading, error } = useQuery(RECENT_TRADES_QUERY, {
    variables: { tokenAddress },
    pollInterval: 15000, // Update every 15 seconds (reduced from 3s to minimize API load)
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-6">
        <h3 className="font-bold text-ui-text-primary mb-4">Recent Trades</h3>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-6">
        <h3 className="font-bold text-ui-text-primary mb-4">Recent Trades</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-700">Failed to load trades</p>
        </div>
      </div>
    );
  }

  const trades = data?.transactions?.edges || [];
  const tokenSymbol = data?.token?.symbol || 'TOKEN';

  if (trades.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-6">
        <h3 className="font-bold text-ui-text-primary mb-4">Recent Trades</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="text-center">
            <p className="text-sm text-ui-text-secondary">No trades yet</p>
            <p className="text-xs text-ui-text-tertiary mt-1">
              Be the first to trade!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ui-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ui-text-primary">Recent Trades</h3>
        <span className="text-xs text-ui-text-secondary">
          Live updates
          <span className="ml-1 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {trades.map(({ node: trade }: any) => {
          const isBuy = trade.type === 'BUY';
          const amount = parseFloat(trade.amount || '0');
          const timestamp = new Date(trade.timestamp);
          const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });

          // Truncate wallet address
          const walletShort = trade.from
            ? `${trade.from.slice(0, 4)}...${trade.from.slice(-4)}`
            : 'Unknown';

          return (
            <div
              key={trade.id}
              className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
            >
              {/* Trade Type Icon */}
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`p-2 rounded-lg ${
                    isBuy
                      ? 'bg-green-100 text-green-600'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {isBuy ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </div>

                {/* Trade Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ui-text-primary">
                      {isBuy ? 'Buy' : 'Sell'}
                    </span>
                    <span className="text-xs text-ui-text-secondary">
                      {walletShort}
                    </span>
                  </div>

                  {/* Amounts */}
                  <div className="text-xs text-ui-text-secondary mt-0.5">
                    {amount.toFixed(4)} {tokenSymbol}
                  </div>
                </div>
              </div>

              {/* Time & Link */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-ui-text-tertiary">{timeAgo}</span>
                {trade.hash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${trade.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ui-text-tertiary hover:text-brand-primary transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-ui-border">
        <p className="text-xs text-ui-text-tertiary text-center">
          Showing {trades.length} most recent trades from Stellar Testnet
        </p>
      </div>
    </div>
  );
}
