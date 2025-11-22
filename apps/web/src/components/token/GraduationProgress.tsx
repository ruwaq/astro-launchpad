/**
 * Graduation Progress Component - REAL DATA
 *
 * Shows real progress towards AMM graduation
 * NO MOCK DATA - Real XLM raised from contract
 */

'use client';

import { Trophy } from 'lucide-react';

interface GraduationProgressProps {
  xlmRaised: string | number; // Current XLM raised
  graduated: boolean; // Graduation status
  threshold: number; // Graduation threshold (default 10,000 XLM)
}

export function GraduationProgress({
  xlmRaised,
  graduated,
  threshold = 10000,
}: GraduationProgressProps) {
  const raised = parseFloat(xlmRaised.toString());
  const percentComplete = Math.min((raised / threshold) * 100, 100);
  const remaining = Math.max(threshold - raised, 0);

  return (
    <div className="bg-white rounded-xl border border-ui-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ui-text-primary">
          {graduated ? 'Graduated! 🎓' : 'Graduation Progress'}
        </h3>
        <Trophy
          className={`h-5 w-5 ${
            graduated ? 'text-yellow-500' : 'text-gray-300'
          }`}
        />
      </div>

      {graduated ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800 font-semibold mb-1">
            Token Graduated to AMM!
          </p>
          <p className="text-xs text-green-700">
            This token is now trading on Stellar DEX with full liquidity.
          </p>
        </div>
      ) : (
        <>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-ui-text-secondary">
                {raised.toLocaleString()} XLM raised
              </span>
              <span className="text-sm font-semibold text-brand-primary">
                {percentComplete.toFixed(1)}%
              </span>
            </div>

            <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-primary to-purple-600 transition-all duration-500 ease-out relative"
                style={{ width: `${percentComplete}%` }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ui-text-secondary">Target</span>
              <span className="font-semibold text-ui-text-primary">
                {threshold.toLocaleString()} XLM
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ui-text-secondary">Remaining</span>
              <span className="font-semibold text-ui-text-primary">
                {remaining.toLocaleString()} XLM
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>What happens at graduation?</strong>
              <br />
              When this token reaches {threshold.toLocaleString()} XLM in bonding curve
              buys, it will automatically graduate to a full AMM pool on Stellar
              DEX with permanent liquidity.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
