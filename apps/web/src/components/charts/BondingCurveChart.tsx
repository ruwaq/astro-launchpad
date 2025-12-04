/**
 * Bonding Curve Progress Chart
 *
 * Shows graduation progress visually:
 * - Progress bar toward $69k graduation (30k XLM)
 * - Price line showing movement
 * - Green when trending up / Red when trending down
 */

'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import { GRADUATION_THRESHOLD_XLM } from '@/lib/stellar/utils';
import { TrendingUp, Target } from 'lucide-react';

interface BondingCurveChartProps {
  tokenAddress: string;
  symbol?: string;
  compact?: boolean;
}

const MAX_POINTS = 50;

interface PricePoint {
  value: number;
  type: 'up' | 'down' | 'neutral';
}

export function BondingCurveChart({
  tokenAddress,
  compact = false,
}: BondingCurveChartProps) {
  const [price, setPrice] = useState<number>(0);
  const [xlmRaised, setXlmRaised] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<'up' | 'down' | 'neutral'>('neutral');
  const lastXlmRef = useRef<number | null>(null);

  const checkForChanges = useCallback(async () => {
    try {
      // RESILIENT: Use allSettled so price fetch failure doesn't break the chart
      const results = await Promise.allSettled([
        sacFactoryService.getTokenInfo(tokenAddress),
        sacFactoryService.getPrice(tokenAddress),
      ]);

      const [infoResult, priceResult] = results;

      // Token info is required
      if (infoResult.status === 'rejected') {
        console.error('Failed to fetch token info:', infoResult.reason);
        return;
      }

      const info = infoResult.value;
      if (!info) return;

      // Price is optional - use fallback if failed
      const priceBigInt = priceResult.status === 'fulfilled' ? priceResult.value : BigInt(0);

      const newXlm = Number(BigInt(info.xlm_raised)) / 10_000_000;
      const newPrice = Number(priceBigInt) / 10_000_000;

      setPrice(newPrice);
      setXlmRaised(newXlm);

      // Determine trend
      let pointType: 'up' | 'down' | 'neutral' = 'neutral';
      if (lastXlmRef.current !== null && newXlm !== lastXlmRef.current) {
        pointType = newXlm > lastXlmRef.current ? 'up' : 'down';
        setTrend(pointType);

        // Add point only when value changes
        setPriceHistory(prev => {
          const updated = [...prev, { value: newXlm, type: pointType }];
          return updated.slice(-MAX_POINTS);
        });
      } else if (priceHistory.length === 0) {
        // Initial point
        setPriceHistory([{ value: newXlm, type: 'neutral' }]);
      }

      lastXlmRef.current = newXlm;
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, priceHistory.length]);

  useEffect(() => {
    checkForChanges();
    // PERFORMANCE: Reduced from 10s to 60s - chart updates on trade completion anyway
    const interval = setInterval(checkForChanges, 60000);
    return () => clearInterval(interval);
  }, [checkForChanges]);

  // Generate SVG path (80px height for compact view)
  const { path, areaPath } = useMemo(() => {
    if (priceHistory.length < 2) {
      return { path: '', areaPath: '' };
    }

    const w = 400;
    const h = 80;
    const pad = 2;
    const topPad = 15; // Space for graduation line label

    const values = priceHistory.map(p => p.value);
    const minV = Math.min(...values) * 0.9;
    const maxV = Math.max(...values, GRADUATION_THRESHOLD_XLM) * 1.1;

    const points = priceHistory.map((p, i) => {
      const x = pad + (i / (priceHistory.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p.value - minV) / (maxV - minV)) * (h - pad - topPad);
      return { x, y };
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${path} L${points[points.length - 1].x},${h} L${pad},${h} Z`;

    return { path, areaPath };
  }, [priceHistory]);

  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#fa9427';

  // Calculate graduation progress percentage
  const graduationProgress = Math.min((xlmRaised / GRADUATION_THRESHOLD_XLM) * 100, 100);
  const xlmRemaining = Math.max(GRADUATION_THRESHOLD_XLM - xlmRaised, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden animate-pulse">
        {/* Progress Header Skeleton */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-baseline gap-2">
            <div className="h-8 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-12" />
          </div>
        </div>
        {/* Progress Bar Skeleton */}
        <div className="px-4 pb-2">
          <div className="h-3 bg-gray-200 rounded-full" />
        </div>
        {/* Chart Skeleton */}
        <div className="px-2 pb-4">
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
      {/* Price & Progress Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ui-text-primary">
              {price.toFixed(8)}
            </span>
            <span className="text-sm text-ui-text-secondary">XLM</span>
            {trend !== 'neutral' && (
              <motion.span
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-xs font-medium px-2 py-0.5 rounded ${
                  trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}
              >
                {trend === 'up' ? '↑' : '↓'}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-ui-text-secondary">
            <Target className="w-3 h-3" />
            <span>{graduationProgress.toFixed(1)}%</span>
          </div>
        </div>

        {/* Graduation Progress Bar */}
        <div className="relative">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: graduationProgress >= 100
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : 'linear-gradient(90deg, #fa9427, #f97316)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${graduationProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          {/* Graduation marker at 100% */}
          <div
            className="absolute top-0 right-0 h-3 w-0.5 bg-green-600 rounded-full"
            title="Graduation: 30k XLM"
          />
        </div>

        {/* XLM Stats */}
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-ui-text-secondary">
            <span className="font-medium text-ui-text-primary">{xlmRaised.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> XLM raised
          </span>
          <span className="text-ui-text-secondary">
            <span className="font-medium text-green-600">{xlmRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> to graduate
          </span>
        </div>
      </div>

      {/* Price Chart with Graduation Line */}
      <div className="px-2 pb-4">
        <svg viewBox="0 0 400 80" className="w-full h-20" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Graduation threshold line */}
          {xlmRaised < GRADUATION_THRESHOLD_XLM && priceHistory.length >= 2 && (
            <>
              <line
                x1="0"
                y1="10"
                x2="400"
                y2="10"
                stroke="#22c55e"
                strokeWidth="1"
                strokeDasharray="4 2"
                opacity="0.5"
              />
              <text x="395" y="8" fill="#22c55e" fontSize="8" textAnchor="end" opacity="0.7">
                GRADUATE
              </text>
            </>
          )}

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill="url(#chartGradient)" />
          )}

          {/* Price line */}
          {path && (
            <path
              d={path}
              fill="none"
              stroke={trendColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current point glow */}
          {priceHistory.length > 0 && path && (
            <circle
              cx={2 + ((priceHistory.length - 1) / Math.max(priceHistory.length - 1, 1)) * 396}
              cy={80 - 2 - ((priceHistory[priceHistory.length - 1].value - Math.min(...priceHistory.map(p => p.value)) * 0.9) / (Math.max(...priceHistory.map(p => p.value), GRADUATION_THRESHOLD_XLM) * 1.1 - Math.min(...priceHistory.map(p => p.value)) * 0.9)) * 76}
              r="4"
              fill={trendColor}
            />
          )}

          {/* Empty state - show progress indicator */}
          {priceHistory.length < 2 && (
            <>
              <line x1="2" y1="70" x2="398" y2="70" stroke="#e5e7eb" strokeWidth="1" />
              {/* Progress indicator on empty chart */}
              <rect
                x="2"
                y="65"
                width={Math.max(graduationProgress * 3.96, 4)}
                height="10"
                fill={trendColor}
                opacity="0.3"
                rx="2"
              />
              <text x="200" y="45" fill="#9ca3af" fontSize="10" textAnchor="middle">
                Trading activity will appear here
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

export default BondingCurveChart;
