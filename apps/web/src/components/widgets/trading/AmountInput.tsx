'use client';

import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { QUICK_AMOUNTS } from './constants';
import { TokenSelector } from './TokenSelector';
import type { TokenOption, TradeType } from './types';

interface AmountInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  isCalculating?: boolean;
  readOnly?: boolean;
  tradeType: TradeType;
  selectedToken: TokenOption | null;
  tokens: TokenOption[];
  tokensLoading?: boolean;
  showTokenSelector: boolean;
  onToggleSelector: () => void;
  onSelectToken: (token: TokenOption) => void;
  displayMode: 'input' | 'output';
  showQuickAmounts?: boolean;
  onQuickAmount?: (amount: number) => void;
  maxBalance?: string;
  onMaxClick?: () => void;
  showMaxButton?: boolean;
}

export const AmountInput = memo(function AmountInput({
  label,
  value,
  onChange,
  disabled,
  isCalculating,
  readOnly,
  tradeType,
  selectedToken,
  tokens,
  tokensLoading,
  showTokenSelector,
  onToggleSelector,
  onSelectToken,
  displayMode,
  showQuickAmounts,
  onQuickAmount,
  maxBalance,
  onMaxClick,
  showMaxButton = false,
}: AmountInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-medium text-ui-text-secondary">
          {label}
        </label>
        {showMaxButton && maxBalance && onMaxClick && !readOnly && (
          <button
            onClick={onMaxClick}
            disabled={disabled}
            className="text-xs font-medium text-brand-primary hover:text-brand-hover active:text-brand-hover/80 disabled:opacity-50 transition-colors touch-manipulation"
            aria-label="Use maximum balance"
          >
            MAX ({maxBalance})
          </button>
        )}
      </div>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          {readOnly ? (
            <div className="flex-1 text-2xl font-bold text-gray-400">
              {isCalculating ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-label="Calculating amount" />
              ) : value ? (
                `~${value}`
              ) : (
                '0.00'
              )}
            </div>
          ) : (
            <input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="0.00"
              disabled={disabled}
              className="flex-1 bg-transparent text-2xl font-bold outline-none disabled:opacity-50"
            />
          )}
          <TokenSelector
            tokens={tokens}
            selectedToken={selectedToken}
            onSelect={onSelectToken}
            isLoading={tokensLoading}
            disabled={disabled}
            showSelector={showTokenSelector}
            onToggle={onToggleSelector}
            displayMode={displayMode}
            tradeType={tradeType}
          />
        </div>

        {showQuickAmounts && onQuickAmount && (
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => onQuickAmount(amount)}
                disabled={disabled}
                className="flex-1 min-h-[44px] py-2.5 px-3 bg-white rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 transition-colors touch-manipulation"
              >
                {amount}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

AmountInput.displayName = 'AmountInput';
