'use client';

import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { STROOPS_PER_XLM } from './constants';
import type { TokenOption } from './types';

// Fee constants matching the contract
const PROTOCOL_FEE_BPS = 5; // 0.05%
const LP_FEE_BPS = 25; // 0.25%
const TOTAL_FEE_BPS = PROTOCOL_FEE_BPS + LP_FEE_BPS; // 0.30%

interface TokenInfoCardProps {
  selectedToken: TokenOption;
  tokenInfo: TokenInfo;
}

export function TokenInfoCard({ selectedToken, tokenInfo }: TokenInfoCardProps) {
  // Get reserves from bonding curve
  const xlmReserve = parseFloat(tokenInfo.bonding_curve?.xlm_reserve || '0') / STROOPS_PER_XLM;
  const tokenReserve = parseFloat(tokenInfo.bonding_curve?.token_reserve || '0') / STROOPS_PER_XLM;
  const xlmRaised = parseFloat(tokenInfo.xlm_raised || '0') / STROOPS_PER_XLM;

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3 text-xs">
      {/* Token Metrics */}
      <div className="space-y-2">
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

      {/* Reserves Section */}
      <div className="border-t border-gray-200 pt-2 space-y-2">
        <div className="text-gray-500 font-medium mb-1">Bonding Curve Reserves</div>
        <div className="flex justify-between">
          <span className="text-gray-600">XLM Reserve</span>
          <span className="font-semibold">{xlmReserve.toFixed(2)} XLM</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Token Reserve</span>
          <span className="font-semibold">
            {tokenReserve.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">XLM Raised</span>
          <span className="font-semibold">{xlmRaised.toFixed(2)} XLM</span>
        </div>
      </div>

      {/* Fee Breakdown */}
      <div className="border-t border-gray-200 pt-2 space-y-2">
        <div className="text-gray-500 font-medium mb-1">Trading Fees</div>
        <div className="flex justify-between">
          <span className="text-gray-600">Protocol Fee</span>
          <span className="font-semibold">{(PROTOCOL_FEE_BPS / 100).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">LP Fee (to curve)</span>
          <span className="font-semibold">{(LP_FEE_BPS / 100).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-gray-800">
          <span className="font-medium">Total Fee</span>
          <span className="font-bold">{(TOTAL_FEE_BPS / 100).toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}
