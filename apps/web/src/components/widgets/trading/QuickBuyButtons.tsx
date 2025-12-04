/**
 * Quick Buy Buttons Component
 *
 * Preset amounts for quick buying (pump.fun style)
 * Shows estimated token amounts on hover
 */

'use client';

import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, TrendingUp } from 'lucide-react';
import { formatCompactNumber } from '@/lib/stellar/utils';

// Quick buy amounts in XLM
export const QUICK_BUY_AMOUNTS = [10, 50, 100, 500, 1000];

const buttonVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

interface QuickBuyButtonsProps {
  selectedAmount: string;
  tradeType: 'buy' | 'sell';
  disabled: boolean;
  onSelect: (amount: number) => void;
  /** Current price in XLM per token (for preview calculation) */
  currentPrice?: number;
  /** Token symbol for display */
  tokenSymbol?: string;
}

export const QuickBuyButtons = memo(function QuickBuyButtons({
  selectedAmount,
  tradeType,
  disabled,
  onSelect,
  currentPrice,
  tokenSymbol = 'TOKEN',
}: QuickBuyButtonsProps) {
  const [hoveredAmount, setHoveredAmount] = useState<number | null>(null);

  // Calculate estimated tokens for each amount
  const tokenEstimates = useMemo(() => {
    if (!currentPrice || currentPrice <= 0) return {};

    return QUICK_BUY_AMOUNTS.reduce((acc, amount) => {
      // Simple estimate: XLM / price = tokens
      // Note: This is an approximation; actual amount may vary due to bonding curve
      const estimatedTokens = amount / currentPrice;
      acc[amount] = estimatedTokens;
      return acc;
    }, {} as Record<number, number>);
  }, [currentPrice]);

  const showPreview = hoveredAmount !== null && tokenEstimates[hoveredAmount];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ui-text-secondary uppercase tracking-wide">
          Quick Buy
        </p>

        {/* Token Preview on Hover */}
        <AnimatePresence mode="wait">
          {showPreview && (
            <motion.div
              key={hoveredAmount}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full"
            >
              <TrendingUp className="h-3 w-3" />
              <span className="font-medium">
                ≈ {formatCompactNumber(tokenEstimates[hoveredAmount!])} {tokenSymbol}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {QUICK_BUY_AMOUNTS.map((amount) => {
          const isSelected = selectedAmount === amount.toString() && tradeType === 'buy';
          const estimate = tokenEstimates[amount];

          return (
            <motion.button
              key={amount}
              variants={buttonVariants}
              initial="idle"
              whileHover="hover"
              whileTap="tap"
              onClick={() => onSelect(amount)}
              onMouseEnter={() => setHoveredAmount(amount)}
              onMouseLeave={() => setHoveredAmount(null)}
              disabled={disabled}
              className={`relative py-3 px-3 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
                isSelected
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={`Buy with ${amount} XLM${estimate ? `, approximately ${Math.floor(estimate)} ${tokenSymbol}` : ''}`}
            >
              <span className="block">
                {amount >= 1000 ? `${amount / 1000}K` : amount}
              </span>

              {/* Small token estimate under amount */}
              {estimate && !isSelected && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  className="block text-[10px] font-normal text-gray-500 -mt-0.5"
                >
                  ≈{formatCompactNumber(estimate)}
                </motion.span>
              )}

              {/* Selected state shows token estimate */}
              {estimate && isSelected && (
                <span className="block text-[10px] font-normal text-white/80 -mt-0.5">
                  ≈{formatCompactNumber(estimate)}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Info text */}
      {currentPrice && currentPrice > 0 && (
        <p className="text-[10px] text-ui-text-tertiary flex items-center gap-1">
          <Coins className="h-3 w-3" />
          Current price: {currentPrice.toFixed(7)} XLM/{tokenSymbol}
        </p>
      )}
    </div>
  );
});
