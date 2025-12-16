/**
 * Dynamic import wrapper for TradingViewChart
 *
 * PERFORMANCE OPTIMIZATION:
 * - Reduces initial bundle by ~800KB (lightweight-charts library)
 * - Chart only loads when component is rendered
 * - SSR disabled (chart requires browser APIs)
 */

import dynamic from 'next/dynamic';
import { Loader2, BarChart2 } from 'lucide-react';

// Loading skeleton that matches the chart dimensions
function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-[280px] sm:h-[400px] bg-white rounded-xl border border-ui-border">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
        <p className="text-sm text-ui-text-secondary">Loading chart...</p>
      </div>
    </div>
  );
}

// Dynamic import with loading state and SSR disabled
export const TradingViewChartDynamic = dynamic(
  () => import('./TradingViewChart').then((mod) => ({ default: mod.TradingViewChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Chart requires browser APIs (canvas, ResizeObserver)
  }
);

// Re-export the props type for consumers
export type { TradingViewChartProps } from './TradingViewChart';
