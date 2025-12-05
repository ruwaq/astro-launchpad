/**
 * Trading Widget Types
 *
 * NOTE: This is for bonding curve trading (mint/burn), NOT DEX swaps.
 * Bonding curve pricing is deterministic - no slippage applies.
 */

export type TradeType = 'buy' | 'sell';

export interface TradeState {
  type: TradeType;
  inputAmount: string;
  outputAmount: string;
  selectedToken: TokenOption | null;
  isCalculating: boolean;
  isProcessing: boolean;
  // Note: No slippage field - bonding curves are deterministic.
  // minOutputTolerance is used internally for race condition protection only.
}

export interface TokenOption {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  logoUrl?: string;
  isTestnet?: boolean;
  classicIssuer?: string;
  decimals?: number;
  currentPrice?: string;
  priceChange24h?: number;
  volume24h?: string;
  marketCap?: string;
}

export interface TradingWidgetProps {
  className?: string;
}
