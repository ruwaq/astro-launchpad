'use client';

import { memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTrendingTokens } from '@/hooks/useApi';
import { formatCompactNumber } from '@/lib/stellar/utils';
import { getIpfsUrl } from '@/lib/utils/ipfs';
import type { Token } from '@/lib/graphql/types';

export function TokensWidget() {
  // Fetch trending tokens (ALL tokens from platform, not filtered by user)
  const { data, loading } = useTrendingTokens(10);

  // trendingTokens returns a direct array of Token objects (not a Connection)
  const tokens = data?.trendingTokens || [];

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Trending Tokens</h3>
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Trending Tokens</h3>
        <Link
          href="/explore"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {tokens.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No tokens yet</p>
        ) : (
          tokens.map((token: Token, index: number) => {
            const priceChange = parseFloat(token.priceChange24h);
            const isPositive = priceChange >= 0;

            return (
              <div
                key={token.address}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm">
                    {index + 1}
                  </div>

                  {(() => {
                    const imgUrl = getIpfsUrl(token.imageUrl);
                    return imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={token.symbol}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-purple-600 flex items-center justify-center text-white font-semibold">
                        {token.symbol?.charAt(0) || '?'}
                      </div>
                    );
                  })()}

                  <div>
                    <div className="font-medium text-gray-900">{token.symbol}</div>
                    <div className="text-xs text-gray-500">{token.name}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    ${formatCompactNumber(parseFloat(token.currentPrice))}
                  </div>
                  <div className={`text-xs font-medium ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
