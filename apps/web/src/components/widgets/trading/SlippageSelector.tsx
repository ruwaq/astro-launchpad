'use client';

import { useState } from 'react';
import { SLIPPAGE_OPTIONS } from './constants';

interface SlippageSelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function SlippageSelector({ value, onChange, disabled }: SlippageSelectorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <label className="block text-xs font-medium text-ui-text-secondary">
          Slippage Tolerance
        </label>
        <div className="relative">
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label="What is slippage tolerance?"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
          {showTooltip && (
            <div
              role="tooltip"
              className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg"
            >
              <p className="font-medium mb-1">What is slippage?</p>
              <p className="text-gray-300 leading-relaxed">
                Slippage is the maximum price difference you&apos;ll accept between when you submit a trade and when it executes.
                Higher slippage = more likely to succeed but you may get a worse price.
                Lower slippage = better price but trade may fail if price moves.
              </p>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                <div className="border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {SLIPPAGE_OPTIONS.map((percent) => (
          <button
            key={percent}
            onClick={() => onChange(percent)}
            disabled={disabled}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
              value === percent
                ? 'bg-brand-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            {percent}%
          </button>
        ))}
      </div>
      {value >= 5 && (
        <p className="mt-1.5 text-xs text-amber-600">
          High slippage may result in an unfavorable trade
        </p>
      )}
    </div>
  );
}
