/**
 * Trade Info Panel Component
 *
 * Displays trading statistics and calculated values
 */

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stroopsToXlm, formatCompactNumber } from '@/lib/stellar/utils';
import type { TradeType } from './types';

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

interface TradeInfoPanelProps {
  tokenInfo: TokenInfo;
  tokenSymbol: string;
  outputAmount: string;
  slippage: number;
  tradeType: TradeType;
}

export const TradeInfoPanel = memo(function TradeInfoPanel({
  tokenInfo,
  tokenSymbol,
  outputAmount,
  slippage,
  tradeType,
}: TradeInfoPanelProps) {
  const minOutput = outputAmount
    ? (parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(4)
    : '0';

  return (
    <motion.div
      variants={itemVariants}
      className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl text-sm"
    >
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
        <p className="text-ui-text-secondary">Fee</p>
        <p className="font-semibold">0.3% (0.05% + 0.25%)</p>
      </div>
      <div>
        <p className="text-ui-text-secondary">Min Output</p>
        <p className="font-semibold">
          {minOutput} {tradeType === 'buy' ? tokenSymbol : 'XLM'}
        </p>
      </div>
    </motion.div>
  );
});

TradeInfoPanel.displayName = 'TradeInfoPanel';
