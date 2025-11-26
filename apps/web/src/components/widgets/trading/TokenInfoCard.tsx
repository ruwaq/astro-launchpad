'use client';

import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { STROOPS_PER_XLM } from './constants';
import type { TokenOption } from './types';

interface TokenInfoCardProps {
  selectedToken: TokenOption;
  tokenInfo: TokenInfo;
}

export function TokenInfoCard({ selectedToken, tokenInfo }: TokenInfoCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-600">Market Cap</span>
        <span className="font-semibold">
          {(parseFloat(tokenInfo.market_cap) / STROOPS_PER_XLM).toFixed(2)} XLM
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">24h Volume</span>
        <span className="font-semibold">
          {(parseFloat(selectedToken.volume24h || '0') / STROOPS_PER_XLM).toFixed(2)} XLM
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Status</span>
        <span
          className={`font-semibold ${
            tokenInfo.status === 'Bonding' ? 'text-blue-600' : 'text-green-600'
          }`}
        >
          {tokenInfo.status === 'Bonding' ? 'Bonding' : 'Graduated'}
        </span>
      </div>
    </div>
  );
}
