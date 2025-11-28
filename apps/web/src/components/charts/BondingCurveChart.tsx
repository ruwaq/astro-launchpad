/**
 * Minimalist Price Chart - Bonding Curve Progress
 *
 * Ultra-simple: just a colored line showing price movement.
 * - Green when trending up
 * - Red when trending down
 * - Matches system white theme
 */

'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import { formatCompactNumber, GRADUATION_THRESHOLD_XLM } from '@/lib/stellar/utils';

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

  // Generate SVG path
  const { path, areaPath } = useMemo(() => {
    if (priceHistory.length < 2) {
      return { path: '', areaPath: '' };
    }

    const w = 400;
    const h = 100;
    const pad = 2;

    const values = priceHistory.map(p => p.value);
    const minV = Math.min(...values) * 0.9;
    const maxV = Math.max(...values, GRADUATION_THRESHOLD_XLM) * 1.1;

    const points = priceHistory.map((p, i) => {
      const x = pad + (i / (priceHistory.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p.value - minV) / (maxV - minV)) * (h - pad * 2);
      return { x, y };
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${path} L${points[points.length - 1].x},${h} L${pad},${h} Z`;

    return { path, areaPath };
  }, [priceHistory]);

  const progressPercent = Math.min((xlmRaised / GRADUATION_THRESHOLD_XLM) * 100, 100);
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#fa9427';

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden animate-pulse">
        {/* Price Header Skeleton - matches actual structure */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-baseline gap-2">
            <div className="h-8 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-12" />
          </div>
        </div>
        {/* Chart Skeleton - h-24 to match SVG */}
        <div className="px-2">
          <div className="h-24 bg-gray-100 rounded" />
        </div>
        {/* Progress Bar Skeleton */}
        <div className="p-4">
          <div className="flex justify-between mb-1">
            <div className="h-3 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-2 bg-gray-200 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
      {/* Price Header */}
      <div className="px-4 pt-4 pb-2">
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
      </div>

      {/* Minimalist Chart */}
      <div className="px-2">
        <svg viewBox="0 0 400 100" className="w-full h-24" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

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
            <>
              <circle
                cx={2 + ((priceHistory.length - 1) / Math.max(priceHistory.length - 1, 1)) * 396}
                cy={100 - 2 - ((priceHistory[priceHistory.length - 1].value - Math.min(...priceHistory.map(p => p.value)) * 0.9) / (Math.max(...priceHistory.map(p => p.value), GRADUATION_THRESHOLD_XLM) * 1.1 - Math.min(...priceHistory.map(p => p.value)) * 0.9)) * 96}
                r="4"
                fill={trendColor}
              />
            </>
          )}

          {/* Empty state line */}
          {priceHistory.length < 2 && (
            <line x1="2" y1="50" x2="398" y2="50" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
          )}
        </svg>
      </div>

      {/* Progress bar - ultra minimal */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center justify-between text-xs text-ui-text-secondary mb-1">
          <span>{formatCompactNumber(xlmRaised)} XLM</span>
          <span>{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: trendColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

export default BondingCurveChart;
