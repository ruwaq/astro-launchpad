/**
 * Transaction Status Component
 *
 * Displays current transaction status with animations
 */

'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export type TransactionStatusType = 'idle' | 'preparing' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error';

const STATUS_MESSAGES: Record<TransactionStatusType, string> = {
  idle: '',
  preparing: 'Preparing transaction...',
  signing: 'Please sign in wallet...',
  submitting: 'Submitting to network...',
  confirming: 'Waiting for confirmation...',
  success: 'Transaction successful!',
  error: 'Transaction failed',
};

interface TransactionStatusProps {
  status: TransactionStatusType;
}

export const TransactionStatus = memo(function TransactionStatus({
  status,
}: TransactionStatusProps) {
  const isProcessing = ['preparing', 'signing', 'submitting', 'confirming'].includes(status);

  if (status === 'idle') {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={`p-3 rounded-lg flex items-center gap-3 ${
          status === 'success' ? 'bg-green-50 text-green-700' :
          status === 'error' ? 'bg-red-50 text-red-700' :
          'bg-blue-50 text-blue-700'
        }`}
        role="status"
        aria-live="polite"
      >
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {status === 'success' && <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
        {status === 'error' && <AlertCircle className="h-5 w-5" aria-hidden="true" />}
        <span className="text-sm font-medium">{STATUS_MESSAGES[status]}</span>
      </motion.div>
    </AnimatePresence>
  );
});

TransactionStatus.displayName = 'TransactionStatus';

export { STATUS_MESSAGES };
