'use client';

import { SLIPPAGE_OPTIONS } from './constants';

interface SlippageSelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function SlippageSelector({ value, onChange, disabled }: SlippageSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-ui-text-secondary mb-2">
        Slippage Tolerance
      </label>
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
    </div>
  );
}
