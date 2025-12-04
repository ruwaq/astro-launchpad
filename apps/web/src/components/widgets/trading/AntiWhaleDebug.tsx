/**
 * Anti-Whale Debug Panel Component
 *
 * Shows internal tracking information for anti-whale limits
 */

'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stroopsToXlm, formatCompactNumber } from '@/lib/stellar/utils';

interface AntiWhaleDebugProps {
  tokenInfo: TokenInfo;
  tokenSymbol: string;
  trackedHoldings: bigint;
}

export const AntiWhaleDebug = memo(function AntiWhaleDebug({
  tokenInfo,
  tokenSymbol,
  trackedHoldings,
}: AntiWhaleDebugProps) {
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const tokenReserve = parseFloat(stroopsToXlm(tokenInfo.bonding_curve.token_reserve));
  const holdingsDecimal = Number(trackedHoldings) / 10_000_000;
  const maxAllowed = tokenReserve * 0.5;
  const holdingPercent = tokenReserve > 0 ? (holdingsDecimal / tokenReserve) * 100 : 0;
  const isOverLimit = holdingsDecimal > maxAllowed;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <button
        onClick={() => setShowDebugInfo(!showDebugInfo)}
        className="w-full text-xs text-ui-text-secondary hover:text-ui-text-primary text-left py-1"
        aria-expanded={showDebugInfo}
      >
        {showDebugInfo ? '▼ Hide debug info' : '▶ Show debug info (anti-whale)'}
      </button>
      <AnimatePresence>
        {showDebugInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mt-2"
          >
            <p className="text-xs font-semibold text-yellow-800 mb-2">
              Anti-Whale Debug Info
            </p>
            <div className="space-y-1 text-xs font-mono text-yellow-700">
              <p>
                <span className="text-yellow-600">Tracked Holdings:</span>{' '}
                {formatCompactNumber(holdingsDecimal)} {tokenSymbol}
              </p>
              <p>
                <span className="text-yellow-600">Max Allowed (50%):</span>{' '}
                {formatCompactNumber(maxAllowed)} {tokenSymbol}
              </p>
              <p>
                <span className="text-yellow-600">Total Supply:</span>{' '}
                {formatCompactNumber(tokenReserve)} {tokenSymbol}
              </p>
              {Number(trackedHoldings) > 0 && (
                <p className={isOverLimit ? 'text-red-600 font-bold' : 'text-green-600'}>
                  Holding: {holdingPercent.toFixed(2)}% of supply
                </p>
              )}
              {isOverLimit && (
                <p className="text-red-600 mt-2">
                  ⚠️ Internal tracking may be desynchronized. Contact admin to reset.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

AntiWhaleDebug.displayName = 'AntiWhaleDebug';
