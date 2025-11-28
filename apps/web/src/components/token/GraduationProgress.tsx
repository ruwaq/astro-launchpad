/**
 * Graduation Progress Component - REAL DATA
 *
 * Shows real progress towards AMM graduation
 * NO MOCK DATA - Real XLM raised from contract
 *
 * Updated: November 25, 2024 - Added ASTRO allocation display
 * Updated: November 26, 2024 - Fixed formatting for consistent locale display
 */

'use client';

import { Trophy, Flame, Droplets, TrendingUp, Info } from 'lucide-react';
import { useState } from 'react';
import { formatCompactNumber, GRADUATION_THRESHOLD_XLM } from '@/lib/stellar/utils';

/**
 * Format XLM/token amount with consistent en-US locale
 * Avoids locale-dependent formatting issues (e.g., 1.500.000 vs 1,500,000)
 */
function formatAmount(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
}

interface AstroAllocationConfig {
  /** ASTRO liquidity basis points (default 1000 = 10%) */
  liquidityBps?: number;
  /** Buyback basis points (default 500 = 5%) */
  buybackBps?: number;
  /** Whether ASTRO is enabled */
  enabled?: boolean;
}

interface GraduationProgressProps {
  xlmRaised: string | number; // Current XLM raised
  graduated: boolean; // Graduation status
  threshold: number; // Graduation threshold (default 10,000 XLM)
  astroConfig?: AstroAllocationConfig; // Optional ASTRO configuration
}

export function GraduationProgress({
  xlmRaised,
  graduated,
  threshold = GRADUATION_THRESHOLD_XLM,
  astroConfig,
}: GraduationProgressProps) {
  const [showDetails, setShowDetails] = useState(false);
  const raised = parseFloat(xlmRaised.toString());
  const percentComplete = Math.min((raised / threshold) * 100, 100);
  const remaining = Math.max(threshold - raised, 0);

  // Calculate ASTRO allocation
  const liquidityBps = astroConfig?.liquidityBps ?? 1000;
  const buybackBps = astroConfig?.buybackBps ?? 500;
  const astroEnabled = astroConfig?.enabled ?? true;

  const totalAstroBps = liquidityBps + buybackBps;
  const mainPoolPercent = ((10000 - totalAstroBps) / 100);
  const astroLiquidityPercent = liquidityBps / 100;
  const buybackPercent = buybackBps / 100;

  // Calculate projected allocations based on threshold
  const xlmForMainPool = (threshold * mainPoolPercent) / 100;
  const xlmForAstroLiquidity = (threshold * astroLiquidityPercent) / 100;
  const xlmForBuyback = (threshold * buybackPercent) / 100;

  return (
    <div className="bg-white rounded-xl border border-ui-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ui-text-primary">
          {graduated ? 'Graduated!' : 'Graduation Progress'}
        </h3>
        <Trophy
          className={`h-5 w-5 ${
            graduated ? 'text-yellow-500' : 'text-gray-300'
          }`}
        />
      </div>

      {graduated ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 font-semibold mb-1">
              Token Graduated to AMM!
            </p>
            <p className="text-xs text-green-700">
              This token is now trading on Stellar DEX with full liquidity.
            </p>
          </div>

          {/* ASTRO Allocation Summary (Graduated) */}
          {astroEnabled && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-purple-600" />
                <p className="text-sm text-purple-800 font-semibold">
                  ASTRO Protocol Integration
                </p>
              </div>
              <div className="text-xs text-purple-700 space-y-1">
                <p>{mainPoolPercent}% allocated to Token/XLM pool</p>
                <p>{astroLiquidityPercent}% allocated to ASTRO ecosystem</p>
                <p>{buybackPercent}% used for ASTRO buyback & burn</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-ui-text-secondary">
                {formatAmount(raised)} XLM raised
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
                {formatCompactNumber(threshold)} XLM
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ui-text-secondary">Remaining</span>
              <span className="font-semibold text-ui-text-primary">
                {formatCompactNumber(remaining)} XLM
              </span>
            </div>
          </div>

          {/* ASTRO Allocation Preview */}
          {astroEnabled && (
            <div className="mt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between text-sm text-purple-600 hover:text-purple-700 transition-colors"
              >
                <span className="flex items-center gap-1">
                  <Flame className="h-4 w-4" />
                  ASTRO Allocation Preview
                </span>
                <Info className="h-4 w-4" />
              </button>

              {showDetails && (
                <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
                  {/* Visual allocation bar */}
                  <div className="h-3 rounded-full overflow-hidden flex">
                    <div
                      className="bg-brand-primary h-full"
                      style={{ width: `${mainPoolPercent}%` }}
                      title={`Main Pool: ${mainPoolPercent}%`}
                    />
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${astroLiquidityPercent}%` }}
                      title={`ASTRO Liquidity: ${astroLiquidityPercent}%`}
                    />
                    <div
                      className="bg-purple-600 h-full"
                      style={{ width: `${buybackPercent}%` }}
                      title={`Buyback & Burn: ${buybackPercent}%`}
                    />
                  </div>

                  {/* Legend */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-brand-primary" />
                        <span className="text-ui-text-secondary">Main Pool ({mainPoolPercent}%)</span>
                      </span>
                      <span className="font-semibold text-ui-text-primary">
                        ~{formatCompactNumber(xlmForMainPool)} XLM
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Droplets className="h-3 w-3 text-blue-500" />
                        <span className="text-ui-text-secondary">ASTRO Liquidity ({astroLiquidityPercent}%)</span>
                      </span>
                      <span className="font-semibold text-ui-text-primary">
                        ~{formatCompactNumber(xlmForAstroLiquidity)} XLM
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Flame className="h-3 w-3 text-purple-600" />
                        <span className="text-ui-text-secondary">Buyback & Burn ({buybackPercent}%)</span>
                      </span>
                      <span className="font-semibold text-ui-text-primary">
                        ~{formatCompactNumber(xlmForBuyback)} XLM
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-purple-700 pt-2 border-t border-purple-200">
                    ASTRO buyback helps support the ecosystem by permanently removing tokens from circulation.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>What happens at graduation?</strong>
              <br />
              When this token reaches {formatCompactNumber(threshold)} XLM in bonding curve
              buys, it will automatically graduate to a full AMM pool on Stellar
              DEX with permanent liquidity.
              {astroEnabled && (
                <span className="block mt-1 text-purple-700">
                  {buybackPercent}% will be used to buy and burn ASTRO tokens.
                </span>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
