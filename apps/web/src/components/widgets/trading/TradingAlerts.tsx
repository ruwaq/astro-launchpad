'use client';

import { Info, AlertCircle } from 'lucide-react';
import type { TokenOption } from './types';

interface ConnectWalletAlertProps {
  onConnect: () => void;
}

export function ConnectWalletAlert({ onConnect }: ConnectWalletAlertProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-blue-800 mb-3">Connect wallet to start trading</p>
          <button
            onClick={onConnect}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}

interface TestnetTokenAlertProps {
  token: TokenOption;
  simulatedPrice: number;
}

export function TestnetTokenAlert({ token, simulatedPrice }: TestnetTokenAlertProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900 mb-1">
            Testnet Token - Simulated Pricing
          </p>
          <p className="text-sm text-blue-800">
            {token.symbol} uses simulated prices for demo (1 XLM = {simulatedPrice}{' '}
            {token.symbol}). Real trades use bonding curve pricing.
          </p>
        </div>
      </div>
    </div>
  );
}

export function NoLiquidityAlert() {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-900 mb-1">Token Not Available</p>
          <p className="text-sm text-orange-800">
            This token is not found in the bonding curve.
            Try tokens from the Astro Shiba section instead.
          </p>
        </div>
      </div>
    </div>
  );
}
