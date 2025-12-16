/**
 * Trade Info Panel Component
 *
 * Displays trading statistics and bonding curve information.
 * Note: Bonding curve pricing is deterministic (no slippage).
 */

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stroopsToXlm, formatCompactNumber } from '@/lib/stellar/utils';
import {
  formatFeeBps,
  DEFAULT_PROTOCOL_FEE_BPS,
  DEFAULT_LP_FEE_BPS,
  DEFAULT_TOTAL_FEE_BPS,
} from '@/lib/stellar/utils/bonding-curve.utils';
import type { TradeType } from './types';

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

interface TradeInfoPanelProps {
  tokenInfo: TokenInfo;
  tokenSymbol: string;
  inputAmount?: string;
  outputAmount: string;
  /** @deprecated Not used - bonding curves are deterministic */
  slippage?: number;
  tradeType: TradeType;
}

export const TradeInfoPanel = memo(function TradeInfoPanel({
  tokenInfo,
  tokenSymbol,
  inputAmount,
  outputAmount,
  tradeType,
}: TradeInfoPanelProps) {
  // Calculate current price from reserves (XLM per token)
  const xlmReserve = BigInt(tokenInfo.bonding_curve.xlm_reserve);
  const tokenReserve = BigInt(tokenInfo.bonding_curve.token_reserve);
  const currentPrice = tokenReserve > 0n
    ? Number(xlmReserve) / Number(tokenReserve)
    : 0;

  // Format the input amount for display
  const formattedInput = inputAmount && parseFloat(inputAmount) > 0
    ? parseFloat(inputAmount).toFixed(4)
    : '0.0000';
  const formattedOutput = outputAmount && parseFloat(outputAmount) > 0
    ? parseFloat(outputAmount).toFixed(4)
    : '0.0000';

  // Calculate estimated fee (0.3% of input)
  const estimatedFee = inputAmount && parseFloat(inputAmount) > 0
    ? (parseFloat(inputAmount) * 0.003).toFixed(6)
    : '0';

  return (
    <motion.div variants={itemVariants} className="space-y-3">
      {/* Trade Summary - Clear display of exact amounts */}
      {inputAmount && parseFloat(inputAmount) > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs text-blue-600 font-medium mb-2 uppercase tracking-wide">
            Trade Summary
          </p>
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-xs text-gray-500">You {tradeType === 'buy' ? 'pay' : 'sell'}</p>
              <p className="text-lg font-bold text-gray-900">
                {formattedInput} <span className="text-sm text-gray-500">{tradeType === 'buy' ? 'XLM' : tokenSymbol}</span>
              </p>
            </div>
            <div className="text-2xl text-blue-400">→</div>
            <div className="text-right">
              <p className="text-xs text-gray-500">You receive</p>
              <p className="text-lg font-bold text-green-600">
                {formattedOutput} <span className="text-sm text-green-500">{tradeType === 'buy' ? tokenSymbol : 'XLM'}</span>
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-blue-100 flex justify-between text-xs text-gray-500">
            <span>Fee ({formatFeeBps(DEFAULT_TOTAL_FEE_BPS)})</span>
            <span>~{estimatedFee} {tradeType === 'buy' ? 'XLM' : tokenSymbol}</span>
          </div>
        </div>
      )}

      {/* Technical Info Grid */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl text-sm">
        <div>
          <p className="text-ui-text-secondary">Token Reserve</p>
          <p className="font-semibold">
            {formatCompactNumber(parseFloat(stroopsToXlm(tokenInfo.bonding_curve.token_reserve)))}
          </p>
        </div>
        <div>
          <p className="text-ui-text-secondary">XLM Raised</p>
          <p className="font-semibold">
            {formatCompactNumber(parseFloat(stroopsToXlm(tokenInfo.xlm_raised)))} XLM
          </p>
        </div>
        <div>
          <p className="text-ui-text-secondary">Fee Structure</p>
          <p className="font-semibold">
            {formatFeeBps(DEFAULT_TOTAL_FEE_BPS)} ({formatFeeBps(DEFAULT_PROTOCOL_FEE_BPS)} + {formatFeeBps(DEFAULT_LP_FEE_BPS)})
          </p>
        </div>
        <div>
          <p className="text-ui-text-secondary">Current Price</p>
          <p className="font-semibold">
            {currentPrice.toFixed(7)} XLM/{tokenSymbol}
          </p>
        </div>
      </div>
    </motion.div>
  );
});

TradeInfoPanel.displayName = 'TradeInfoPanel';
