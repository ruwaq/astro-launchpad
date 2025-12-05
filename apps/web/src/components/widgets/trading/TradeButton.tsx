'use client';

import { Loader2 } from 'lucide-react';
import type { TokenOption, TradeType } from './types';

interface TradeButtonProps {
  onClick: () => void;
  isConnected: boolean;
  isProcessing: boolean;
  selectedToken: TokenOption | null;
  inputAmount: string;
  hasTokenInfo: boolean;
  tradeType: TradeType;
}

/**
 * Trade Button Component
 *
 * Button for executing buy/sell trades on bonding curve.
 * Note: This is NOT a swap - bonding curves mint/burn tokens directly.
 */
export function TradeButton({
  onClick,
  isConnected,
  isProcessing,
  selectedToken,
  inputAmount,
  hasTokenInfo,
  tradeType,
}: TradeButtonProps) {
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
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Processing...
        </span>
      );
    }
    if (!isConnected) return 'Connect Wallet';
    if (!selectedToken) return 'Select a token';
    if (isTestnetOnly) return 'Demo Only (Simulated Prices)';
    return `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${selectedToken.symbol}`;
  };

  const getAriaLabel = () => {
    if (isProcessing) return 'Processing transaction, please wait';
    if (!isConnected) return 'Connect your wallet to trade';
    if (!selectedToken) return 'Select a token to trade';
    if (isTestnetOnly) return 'Demo mode - simulated prices only';
    const action = tradeType === 'buy' ? 'Buy' : 'Sell';
    return `${action} ${selectedToken.symbol} tokens`;
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      aria-label={getAriaLabel()}
      aria-busy={isProcessing}
      aria-disabled={isDisabled}
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

// Backwards compatibility alias
export const SwapButton = TradeButton;
