'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface TransactionStep {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
}

interface TransactionProgressProps {
  steps: TransactionStep[];
  isVisible: boolean;
  title?: string;
}

export function TransactionProgress({
  steps,
  isVisible,
  title = 'Creating Token'
}: TransactionProgressProps) {
  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'active':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-800 rounded-xl p-4 shadow-2xl min-w-[280px]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-800">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm font-medium text-white">{title}</span>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded-lg transition-colors",
                    step.status === 'active' && "bg-gray-800/50",
                    step.status === 'completed' && "opacity-60"
                  )}
                >
                  <div className="mt-0.5">
                    {getStepIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      step.status === 'active' ? "text-white" : "text-gray-400"
                    )}>
                      {step.label}
                    </p>
                    {step.description && step.status === 'active' && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="text-xs text-gray-500 mt-0.5"
                      >
                        {step.description}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Progress indicator */}
            <div className="mt-3 pt-2 border-t border-gray-800">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {steps.filter(s => s.status === 'completed').length}/{steps.length} completed
                </span>
                <span className="text-gray-600">Please wait...</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
