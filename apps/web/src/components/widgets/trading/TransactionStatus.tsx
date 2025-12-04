/**
 * Transaction Status Component
 *
 * Enhanced pump.fun style transaction progress with:
 * - Step-by-step progress indicators
 * - Visual progress bar
 * - Detailed status messages
 * - Smooth animations
 */

'use client';

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Wallet,
  Send,
  Clock,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export type TransactionStatusType = 'idle' | 'preparing' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error';

export const STATUS_MESSAGES: Record<TransactionStatusType, string> = {
  idle: '',
  preparing: 'Building transaction...',
  signing: 'Please sign in wallet',
  submitting: 'Broadcasting to network...',
  confirming: 'Confirming on chain...',
  success: 'Transaction complete!',
  error: 'Transaction failed',
};

// Transaction steps configuration
interface StepConfig {
  key: TransactionStatusType;
  label: string;
  icon: LucideIcon;
}

const TRANSACTION_STEPS: StepConfig[] = [
  { key: 'preparing', label: 'Prepare', icon: FileEdit },
  { key: 'signing', label: 'Sign', icon: Wallet },
  { key: 'submitting', label: 'Submit', icon: Send },
  { key: 'confirming', label: 'Confirm', icon: Clock },
];

interface TransactionStatusProps {
  status: TransactionStatusType;
}

export const TransactionStatus = memo(function TransactionStatus({
  status,
}: TransactionStatusProps) {
  const isProcessing = ['preparing', 'signing', 'submitting', 'confirming'].includes(status);
  const isSuccess = status === 'success';
  const isError = status === 'error';

  // Calculate current step index
  const currentStepIndex = useMemo(() => {
    return TRANSACTION_STEPS.findIndex(step => step.key === status);
  }, [status]);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (status === 'idle') return 0;
    if (isSuccess) return 100;
    if (isError) return ((currentStepIndex + 1) / TRANSACTION_STEPS.length) * 100;
    if (currentStepIndex >= 0) {
      return ((currentStepIndex + 0.5) / TRANSACTION_STEPS.length) * 100;
    }
    return 0;
  }, [status, currentStepIndex, isSuccess, isError]);

  if (status === 'idle') {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className={`rounded-xl overflow-hidden ${
          isSuccess ? 'bg-green-50 border border-green-200' :
          isError ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="p-3 lg:p-4">
          {/* Progress Steps - Only show during processing */}
          {isProcessing && (
            <div className="mb-3">
              {/* Progress bar */}
              <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                />
              </div>

              {/* Step indicators */}
              <div className="flex justify-between">
                {TRANSACTION_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = step.key === status;
                  const isCompleted = currentStepIndex > index;
                  const isPending = currentStepIndex < index;

                  return (
                    <div
                      key={step.key}
                      className="flex flex-col items-center gap-1"
                    >
                      <motion.div
                        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 0.5, repeat: isActive ? Infinity : 0 }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isActive
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <StepIcon className="h-4 w-4" />
                        )}
                      </motion.div>
                      <span className={`text-xs font-medium ${
                        isCompleted || isActive ? 'text-blue-700' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Message */}
          <div className={`flex items-center gap-2 ${
            isSuccess ? 'text-green-700' :
            isError ? 'text-red-700' :
            'text-blue-700'
          }`}>
            {isProcessing && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="h-5 w-5" aria-hidden="true" />
              </motion.div>
            )}
            {isSuccess && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </motion.div>
            )}
            {isError && <AlertCircle className="h-5 w-5" aria-hidden="true" />}
            <span className="text-sm font-medium">{STATUS_MESSAGES[status]}</span>
          </div>

          {/* Success checkmarks animation */}
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center gap-1 mt-3"
            >
              {TRANSACTION_STEPS.map((step, index) => (
                <motion.div
                  key={step.key}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1, type: 'spring' }}
                  className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
                >
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

TransactionStatus.displayName = 'TransactionStatus';
