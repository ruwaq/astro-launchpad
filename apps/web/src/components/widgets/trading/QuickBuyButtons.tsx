/**
 * Quick Buy Buttons Component
 *
 * Preset amounts for quick buying (pump.fun style)
 */

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';

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
}

export const QuickBuyButtons = memo(function QuickBuyButtons({
  selectedAmount,
  tradeType,
  disabled,
  onSelect,
}: QuickBuyButtonsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ui-text-secondary uppercase tracking-wide">
        Quick Buy
      </p>
      <div className="grid grid-cols-5 gap-2">
        {QUICK_BUY_AMOUNTS.map((amount) => (
          <motion.button
            key={amount}
            variants={buttonVariants}
            initial="idle"
            whileHover="hover"
            whileTap="tap"
            onClick={() => onSelect(amount)}
            disabled={disabled}
            className={`py-3 px-3 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
              selectedAmount === amount.toString() && tradeType === 'buy'
                ? 'bg-brand-primary text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {amount >= 1000 ? `${amount / 1000}K` : amount}
          </motion.button>
        ))}
      </div>
    </div>
  );
});
