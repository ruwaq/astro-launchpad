/**
 * Graduation Progress Component
 *
 * Shows progress toward token graduation (30,000 XLM threshold)
 * Inspired by pump.fun style bonding curve UI
 */

'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Trophy, TrendingUp } from 'lucide-react';
import { stroopsToXlm } from '@/lib/stellar/utils';

// Graduation threshold: 30,000 XLM
const GRADUATION_THRESHOLD_XLM = 30_000;

interface GraduationProgressProps {
  xlmRaised: string; // In stroops (from contract/backend)
  isGraduated: boolean;
  className?: string;
}

/**
 * Safely parse xlmRaised value
 * Handles both stroops (large numbers) and XLM format
 */
function parseXlmRaised(value: string): number {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 0;

  // If the value is greater than 10 million, it's likely in stroops
  // (30,000 XLM = 300,000,000,000 stroops)
  if (numValue > 10_000_000) {
    return parseFloat(stroopsToXlm(value));
  }

  return numValue;
}

export const GraduationProgress = memo(function GraduationProgress({
  xlmRaised,
  isGraduated,
  className = '',
}: GraduationProgressProps) {
  const { progressPercent, xlmRaisedNumber, remaining } = useMemo(() => {
    const raised = parseXlmRaised(xlmRaised);
    const percent = Math.min((raised / GRADUATION_THRESHOLD_XLM) * 100, 100);
    const remainingXlm = Math.max(GRADUATION_THRESHOLD_XLM - raised, 0);

    return {
      progressPercent: percent,
      xlmRaisedNumber: raised,
      remaining: remainingXlm,
    };
  }, [xlmRaised]);

  // If already graduated, show celebration state
  if (isGraduated) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-green-800">Graduated to AMM!</h3>
              <span className="text-lg">🎓</span>
            </div>
            <p className="text-sm text-green-700">
              This token now trades on the decentralized AMM pool
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-orange-900">Bonding Curve</span>
        </div>
        <div className="flex items-center gap-1 text-orange-700">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">{progressPercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-4 bg-orange-100 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"
        />
        {/* Glow effect at the edge */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute top-0 left-0 h-full"
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg" />
        </motion.div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-sm">
        <div>
          <span className="text-orange-700">Raised: </span>
          <span className="font-bold text-orange-900">
            {xlmRaisedNumber.toLocaleString(undefined, { maximumFractionDigits: 0 })} XLM
          </span>
        </div>
        <div>
          <span className="text-orange-700">Goal: </span>
          <span className="font-bold text-orange-900">
            {GRADUATION_THRESHOLD_XLM.toLocaleString()} XLM
          </span>
        </div>
      </div>

      {/* Remaining message */}
      {remaining > 0 && (
        <p className="text-xs text-orange-600 mt-2 text-center">
          {remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} XLM until graduation to AMM 🚀
        </p>
      )}
    </motion.div>
  );
});

GraduationProgress.displayName = 'GraduationProgress';
