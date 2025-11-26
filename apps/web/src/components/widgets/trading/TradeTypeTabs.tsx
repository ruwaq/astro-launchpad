'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import type { TradeType } from './types';

interface TradeTypeTabsProps {
  tradeType: TradeType;
  onChange: (type: TradeType) => void;
}

export function TradeTypeTabs({ tradeType, onChange }: TradeTypeTabsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange('buy')}
        className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
          tradeType === 'buy'
            ? 'bg-green-500 text-white shadow-md'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Buy
        </div>
      </button>
      <button
        onClick={() => onChange('sell')}
        className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
          tradeType === 'sell'
            ? 'bg-red-500 text-white shadow-md'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Sell
        </div>
      </button>
    </div>
  );
}
