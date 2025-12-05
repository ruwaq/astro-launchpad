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
  outputAmount: string;
  /** @deprecated Not used - bonding curves are deterministic */
  slippage?: number;
  tradeType: TradeType;
}

export const TradeInfoPanel = memo(function TradeInfoPanel({
  tokenInfo,
  tokenSymbol,
  outputAmount,
  tradeType,
}: TradeInfoPanelProps) {
  // Calculate current price from reserves (XLM per token)
  const xlmReserve = BigInt(tokenInfo.bonding_curve.xlm_reserve);
  const tokenReserve = BigInt(tokenInfo.bonding_curve.token_reserve);
  const currentPrice = tokenReserve > 0n
    ? Number(xlmReserve) / Number(tokenReserve)
    : 0;

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
    </motion.div>
  );
});

TradeInfoPanel.displayName = 'TradeInfoPanel';
