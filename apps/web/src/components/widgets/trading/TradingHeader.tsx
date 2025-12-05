/**
 * Trading Header Component
 *
 * Displays token info and price
 */

'use client';

import { memo } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const priceFlashVariants = {
  flash: {
    backgroundColor: ['rgba(34, 197, 94, 0.3)', 'transparent'],
    transition: { duration: 0.5 },
  },
};

interface TradingHeaderProps {
  tokenSymbol: string;
  tokenName: string;
  tokenImage?: string;
  currentPrice: string;
  priceFlash: 'up' | 'down' | null;
  priceChangePercent: number;
}

export const TradingHeader = memo(function TradingHeader({
  tokenSymbol,
  tokenName,
  tokenImage,
  currentPrice,
  priceFlash,
  priceChangePercent,
}: TradingHeaderProps) {
  return (
    <div className="p-4 border-b border-ui-border bg-gradient-to-r from-brand-primary/5 to-brand-blue/5">
      <div className="flex items-center gap-3">
        {tokenImage && (
          <Image
            src={tokenImage}
            alt={tokenName}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full"
            unoptimized={tokenImage.startsWith('data:')}
          />
        )}
        <div>
          <h3 className="font-bold text-ui-text-primary flex items-center gap-2">
            Trade {tokenSymbol}
            <Sparkles className="h-4 w-4 text-brand-primary" />
          </h3>
          <motion.div
            animate={priceFlash ? priceFlashVariants.flash : {}}
            className={`text-sm font-mono ${
              priceFlash === 'up' ? 'text-green-600' :
              priceFlash === 'down' ? 'text-red-600' :
              'text-ui-text-secondary'
            }`}
          >
            {currentPrice} XLM
            {priceChangePercent !== 0 && (
              <span className={`ml-2 ${priceChangePercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {priceChangePercent > 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
});

TradingHeader.displayName = 'TradingHeader';
