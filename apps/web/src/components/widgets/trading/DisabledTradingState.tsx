/**
 * Disabled Trading State Component
 *
 * Shown when trading is disabled for a token
 */

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

export const DisabledTradingState = memo(function DisabledTradingState() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-gray-100 rounded-2xl border border-ui-border shadow-sm overflow-hidden"
    >
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="font-bold text-ui-text-primary mb-2">
          Trading Disabled
        </h3>
        <p className="text-sm text-ui-text-secondary mb-4">
          This token is not available on the current Stellar contract.
          Trading functionality has been disabled.
        </p>
        <div className="text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
          <p className="font-medium mb-1">Why is this happening?</p>
          <ul className="text-left space-y-1">
            <li>The token may have been created with an old contract</li>
            <li>The contract may have been redeployed</li>
            <li>Database contains stale data</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
});

DisabledTradingState.displayName = 'DisabledTradingState';
