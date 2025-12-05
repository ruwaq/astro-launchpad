/**
 * Quick Sell Buttons Component
 *
 * Percentage-based quick sell presets (25%, 50%, 75%, MAX)
 * Similar to pump.fun style for fast selling
 */

'use client';

import { motion } from 'framer-motion';

export const QUICK_SELL_PERCENTAGES = [25, 50, 75, 100] as const;

interface QuickSellButtonsProps {
  /** User's token balance in stroops */
  tokenBalance: string;
  /** Token symbol for display */
  tokenSymbol: string;
  /** Callback when a preset is selected */
  onSelect: (amount: string) => void;
  /** Currently selected amount (for highlighting) */
  selectedAmount?: string;
  /** Whether buttons are disabled */
  disabled?: boolean;
}

export function QuickSellButtons({
  tokenBalance,
  tokenSymbol,
  onSelect,
  selectedAmount,
  disabled = false,
}: QuickSellButtonsProps) {
  const balance = BigInt(tokenBalance || '0');
  const hasBalance = balance > BigInt(0);

  const handleSelect = (percentage: number) => {
    if (!hasBalance || disabled) return;

    let amount: bigint;
    if (percentage === 100) {
      // MAX - sell everything
      amount = balance;
    } else {
      // Calculate percentage
      amount = (balance * BigInt(percentage)) / BigInt(100);
    }

    // Convert to human readable (divide by 10^7 for 7 decimals)
    const humanAmount = Number(amount) / 10_000_000;
    onSelect(humanAmount.toString());
  };

  const isSelected = (percentage: number): boolean => {
    if (!selectedAmount || !hasBalance) return false;
    const selectedStroops = BigInt(Math.floor(parseFloat(selectedAmount) * 10_000_000));
    const expectedStroops = percentage === 100
      ? balance
      : (balance * BigInt(percentage)) / BigInt(100);
    // Allow 0.1% tolerance for floating point
    const tolerance = expectedStroops / BigInt(1000);
    return selectedStroops >= expectedStroops - tolerance && selectedStroops <= expectedStroops + tolerance;
  };

  if (!hasBalance) {
    return (
      <div className="text-center text-sm text-gray-500 py-2">
        No {tokenSymbol} to sell
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {QUICK_SELL_PERCENTAGES.map((percentage) => {
        const selected = isSelected(percentage);
        const label = percentage === 100 ? 'MAX' : `${percentage}%`;
        const amount = percentage === 100
          ? balance
          : (balance * BigInt(percentage)) / BigInt(100);
        const humanAmount = Number(amount) / 10_000_000;

        return (
          <motion.button
            key={percentage}
            type="button"
            onClick={() => handleSelect(percentage)}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            className={`
              relative py-2 px-3 rounded-lg text-sm font-medium
              transition-all duration-200
              ${selected
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="text-center">
              <span className="font-bold">{label}</span>
              <p className="text-xs opacity-80 mt-0.5 truncate">
                {humanAmount > 1000000
                  ? `${(humanAmount / 1000000).toFixed(1)}M`
                  : humanAmount > 1000
                  ? `${(humanAmount / 1000).toFixed(1)}K`
                  : humanAmount.toFixed(2)
                }
              </p>
            </div>
            {percentage === 100 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                ALL
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
