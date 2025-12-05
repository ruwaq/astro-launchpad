/**
 * Simple Price Chart - Gas Pump Style
 *
 * Minimal chart showing price/cap movement over time
 * - Simple green line chart with area fill
 * - Graduation target line (DEX at 30,000 XLM)
 * - Cap/Price toggle
 * - Real-time updates using series.update()
 */

'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  LineData,
  Time,
  LineSeries,
  AreaSeries,
} from 'lightweight-charts';
import { Loader2 } from 'lucide-react';
import { sacFactoryService, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { GRADUATION_THRESHOLD_XLM } from '@/lib/stellar/utils';

interface SimpleChartProps {
  tokenAddress: string;
  symbol?: string;
  refreshTrigger?: number;
}

interface DataPoint {
  time: number;
  price: number;
  xlmRaised: number;
}

export function SimpleChart({ tokenAddress, symbol = 'TOKEN', refreshTrigger = 0 }: SimpleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [dataHistory, setDataHistory] = useState<DataPoint[]>([]);
  const [viewMode, setViewMode] = useState<'cap' | 'price'>('cap');
  const isInitializedRef = useRef(false);

  // Fetch current data from contract
  const fetchCurrentData = useCallback(async () => {
    try {
      const [priceBigInt, info] = await Promise.all([
        sacFactoryService.getPrice(tokenAddress),
        sacFactoryService.getTokenInfo(tokenAddress),
      ]);

      const currentPrice = Number(priceBigInt) / 10_000_000;
      const xlmRaised = info?.bonding_curve
        ? Number(info.bonding_curve.xlm_reserve) / 10_000_000
        : 0;

      if (info) {
        setTokenInfo(info);
      }

      const now = Math.floor(Date.now() / 1000);

      // Add new data point with both price AND xlmRaised
      if (currentPrice > 0) {
        setDataHistory(prev => {
          const lastTime = prev.length > 0 ? prev[prev.length - 1].time : 0;
          // Only add if time has advanced
          if (now <= lastTime) return prev;

          const newPoint: DataPoint = { time: now, price: currentPrice, xlmRaised };
          const newHistory = [...prev, newPoint];

          // Keep last 500 points
          return newHistory.slice(-500);
        });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  // Initial fetch and polling
  useEffect(() => {
    fetchCurrentData();
    const interval = setInterval(fetchCurrentData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [fetchCurrentData]);

  // Refresh on trigger (after trade)
  useEffect(() => {
    if (refreshTrigger > 0) {
      // Immediate fetch after trade
      fetchCurrentData();
    }
  }, [refreshTrigger, fetchCurrentData]);

  // Current values for display
  const currentXlmRaised = tokenInfo?.bonding_curve
    ? Number(tokenInfo.bonding_curve.xlm_reserve) / 10_000_000
    : 0;
  const graduationTarget = GRADUATION_THRESHOLD_XLM;
  const progressPercent = Math.min((currentXlmRaised / graduationTarget) * 100, 100);

  // Transform data for chart based on view mode
  const chartData = useMemo((): LineData[] => {
    if (dataHistory.length === 0) return [];

    let data: LineData[] = dataHistory.map((point) => ({
      time: point.time as Time,
      value: viewMode === 'cap' ? point.xlmRaised : point.price,
    }));

    // Ensure at least 2 points for visible line
    if (data.length === 1) {
      const point = data[0];
      // Add synthetic point 5 minutes earlier with same value
      data = [
        { time: ((point.time as number) - 300) as Time, value: point.value * 0.99 },
        point,
      ];
    }

    return data;
  }, [dataHistory, viewMode]);

  // Initialize chart ONCE
  useEffect(() => {
    if (!chartContainerRef.current || isInitializedRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 260,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;
    isInitializedRef.current = true;

    // Add area series (gradient under line)
    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(34, 197, 94, 0.3)',
      bottomColor: 'rgba(34, 197, 94, 0.0)',
      lineColor: 'transparent',
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    areaSeriesRef.current = areaSeries;

    // Add line series
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#22c55e',
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    lineSeriesRef.current = lineSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      isInitializedRef.current = false;
    };
  }, []);

  // Update chart data when data changes
  useEffect(() => {
    if (!chartRef.current || !lineSeriesRef.current || !areaSeriesRef.current) return;
    if (chartData.length === 0) return;

    // Update both series with full data
    lineSeriesRef.current.setData(chartData);
    areaSeriesRef.current.setData(chartData);

    // Remove old price lines and add graduation target if in cap mode
    // Price lines are reset when setData is called, so we add fresh ones
    if (viewMode === 'cap') {
      lineSeriesRef.current.createPriceLine({
        price: graduationTarget,
        color: '#eab308',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'DEX',
      });
    }

    chartRef.current.timeScale().fitContent();
  }, [chartData, viewMode, graduationTarget]);

  if (loading && dataHistory.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ui-border overflow-hidden">
        <div className="h-[340px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ui-border overflow-hidden">
      {/* Header with Cap/Price Toggle */}
      <div className="flex items-center gap-2 p-3 border-b border-ui-border">
        <button
          onClick={() => setViewMode('cap')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            viewMode === 'cap'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Cap
        </button>
        <button
          onClick={() => setViewMode('price')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            viewMode === 'price'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Price
        </button>

        {/* Graduation Info */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded font-medium">
            DEX at {graduationTarget.toLocaleString()} XLM
          </span>
          <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">
            {currentXlmRaised.toFixed(0)} XLM
          </span>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-[260px]" />

      {/* Progress Bar */}
      <div className="px-3 pb-3 pt-2">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-yellow-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-500 font-medium">
            {progressPercent.toFixed(1)}% to DEX
          </span>
          <span className="text-xs text-gray-400">
            Live from Stellar
          </span>
        </div>
      </div>
    </div>
  );
}

export default SimpleChart;
