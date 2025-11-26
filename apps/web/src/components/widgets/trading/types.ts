/**
 * Trading Widget Types
 */

export type TradeType = 'buy' | 'sell';

export interface TradeState {
  type: TradeType;
  inputAmount: string;
  outputAmount: string;
  selectedToken: TokenOption | null;
  isCalculating: boolean;
  isProcessing: boolean;
  slippage: number;
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
