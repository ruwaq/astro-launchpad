'use client';

import { Loader2 } from 'lucide-react';
import type { TokenOption, TradeType } from './types';

interface SwapButtonProps {
  onClick: () => void;
  isConnected: boolean;
  isProcessing: boolean;
  selectedToken: TokenOption | null;
  inputAmount: string;
  hasTokenInfo: boolean;
  tradeType: TradeType;
}

export function SwapButton({
  onClick,
  isConnected,
  isProcessing,
  selectedToken,
  inputAmount,
  hasTokenInfo,
  tradeType,
}: SwapButtonProps) {
  const isTestnetOnly = selectedToken?.isTestnet && !hasTokenInfo;
  const hasValidAmount = inputAmount && parseFloat(inputAmount) > 0;

  const isDisabled =
    !isConnected ||
    isProcessing ||
    !selectedToken ||
    !hasValidAmount ||
    isTestnetOnly;

  const getButtonText = () => {
    if (isProcessing) {
      return (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Processing...
        </div>
      );
    }
    if (!isConnected) return 'Connect Wallet';
    if (!selectedToken) return 'Select a token';
    if (isTestnetOnly) return 'Demo Only (Simulated Prices)';
    return `Swap ${tradeType === 'buy' ? 'XLM' : selectedToken.symbol}`;
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full py-3 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        tradeType === 'buy'
          ? 'bg-green-500 hover:bg-green-600 text-white'
          : 'bg-red-500 hover:bg-red-600 text-white'
      }`}
    >
      {getButtonText()}
    </button>
  );
}
