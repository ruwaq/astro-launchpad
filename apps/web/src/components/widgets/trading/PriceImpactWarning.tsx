'use client';

interface PriceImpactWarningProps {
  inputAmount: string;
  outputAmount: string;
  /** XLM reserve in the bonding curve (in XLM, not stroops) */
  xlmReserve: string;
  /** Token reserve in the bonding curve */
  tokenReserve: string;
  tradeType: 'buy' | 'sell';
}

/**
 * Calculate and display price impact warning for large trades
 * Shows when the trade would move the price significantly from bonding curve
 */
export function PriceImpactWarning({
  inputAmount,
  outputAmount,
  xlmReserve,
  tokenReserve,
  tradeType,
}: PriceImpactWarningProps) {
  const input = parseFloat(inputAmount) || 0;
  const output = parseFloat(outputAmount) || 0;
  const xlmRes = parseFloat(xlmReserve) || 0;
  const tokenRes = parseFloat(tokenReserve) || 0;

  if (input === 0 || output === 0 || xlmRes === 0 || tokenRes === 0) {
    return null;
  }

  // Calculate current spot price from reserves (XLM per token)
  const currentPrice = xlmRes / tokenRes;

  // Calculate effective price from the trade
  let effectivePrice: number;
  let priceImpact: number;

  if (tradeType === 'buy') {
    // Buying: XLM -> Tokens, effective price = XLM / tokens received
    effectivePrice = input / output;
    priceImpact = ((effectivePrice - currentPrice) / currentPrice) * 100;
  } else {
    // Selling: Tokens -> XLM, effective price = XLM received / tokens
    effectivePrice = output / input;
    priceImpact = ((currentPrice - effectivePrice) / currentPrice) * 100;
  }

  // Only show warning for significant price impact (> 1%)
  if (priceImpact < 1) {
    return null;
  }

  const isHighImpact = priceImpact >= 5;
  const isCriticalImpact = priceImpact >= 10;

  const bgColor = isCriticalImpact
    ? 'bg-red-50 border-red-200'
    : isHighImpact
    ? 'bg-amber-50 border-amber-200'
    : 'bg-yellow-50 border-yellow-100';

  const textColor = isCriticalImpact
    ? 'text-red-700'
    : isHighImpact
    ? 'text-amber-700'
    : 'text-yellow-700';

  const iconColor = isCriticalImpact
    ? 'text-red-500'
    : isHighImpact
    ? 'text-amber-500'
    : 'text-yellow-500';

  return (
    <div className={`${bgColor} border rounded-lg p-3`}>
      <div className="flex items-start gap-2">
        <svg
          className={`w-4 h-4 ${iconColor} mt-0.5 flex-shrink-0`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${textColor}`}>
            {isCriticalImpact
              ? 'Very High Price Impact'
              : isHighImpact
              ? 'High Price Impact'
              : 'Price Impact Warning'}
          </p>
          <p className={`text-xs ${textColor} opacity-80 mt-0.5`}>
            This trade has a {priceImpact.toFixed(2)}% price impact.
            {isCriticalImpact && ' Consider reducing the trade size.'}
            {!isCriticalImpact && isHighImpact && ' You may receive less value than expected.'}
          </p>
        </div>
        <span className={`text-xs font-bold ${textColor} whitespace-nowrap`}>
          -{priceImpact.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
