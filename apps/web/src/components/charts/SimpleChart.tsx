/**
 * Simple Price Chart - Gas Pump Style
 *
 * Minimal chart showing price movement over time
 * - Simple green line chart
 * - Graduation target line
 * - No complex controls
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

interface PricePoint {
  time: number;
  price: number;
}

export function SimpleChart({ tokenAddress, symbol = 'TOKEN', refreshTrigger = 0 }: SimpleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [viewMode, setViewMode] = useState<'cap' | 'price'>('cap');
  const lastPriceRef = useRef<number>(0);

  // Fetch current price from contract
  const fetchCurrentPrice = useCallback(async () => {
    try {
      const [priceBigInt, info] = await Promise.all([
        sacFactoryService.getPrice(tokenAddress),
        sacFactoryService.getTokenInfo(tokenAddress),
      ]);

      const currentPrice = Number(priceBigInt) / 10_000_000;

      if (info) {
        setTokenInfo(info);
      }

      const now = Math.floor(Date.now() / 1000);

      // Always add a price point
      if (currentPrice > 0) {
        lastPriceRef.current = currentPrice;

        setPriceHistory(prev => {
          const lastTime = prev.length > 0 ? prev[prev.length - 1].time : 0;
          if (now <= lastTime) return prev;

          const newHistory = [...prev, { time: now, price: currentPrice }];
          return newHistory.slice(-500);
        });
      }
    } catch (err) {
      console.error('Error fetching price:', err);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  // Initial fetch and polling
  useEffect(() => {
    fetchCurrentPrice();
    const interval = setInterval(fetchCurrentPrice, 5000);
    return () => clearInterval(interval);
  }, [fetchCurrentPrice]);

  // Refresh on trigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchCurrentPrice();
    }
  }, [refreshTrigger, fetchCurrentPrice]);

  // Calculate market cap from reserves
  const marketCap = useMemo(() => {
    if (!tokenInfo?.bonding_curve) return 0;
    const xlmReserve = Number(tokenInfo.bonding_curve.xlm_reserve) / 10_000_000;
    // Approximate market cap as 2x XLM reserve (simple bonding curve estimation)
    return xlmReserve * 2;
  }, [tokenInfo]);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (priceHistory.length === 0) return [];

    // If viewing cap, show market cap progression
    // If viewing price, show price
    let data: LineData[] = priceHistory.map((point) => ({
      time: point.time as Time,
      value: viewMode === 'price' ? point.price * 10000000 : marketCap, // Scale price for visibility
    }));

    // Ensure at least 2 points for visible line
    if (data.length === 1) {
      const point = data[0];
      data = [
        { time: ((point.time as number) - 300) as Time, value: point.value },
        point,
      ];
    }

    return data;
  }, [priceHistory, viewMode, marketCap]);

  // Graduation target (in XLM)
  const graduationTarget = GRADUATION_THRESHOLD_XLM;
  const currentXlmRaised = tokenInfo?.bonding_curve
    ? Number(tokenInfo.bonding_curve.xlm_reserve) / 10_000_000
    : 0;
  const progressPercent = Math.min((currentXlmRaised / graduationTarget) * 100, 100);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a2e' },
        textColor: '#888',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 280,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
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
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) return;

    // Remove old series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
    }
    if (areaSeriesRef.current) {
      chartRef.current.removeSeries(areaSeriesRef.current);
    }

    // Add area (gradient under line)
    const areaSeries = chartRef.current.addSeries(AreaSeries, {
      topColor: 'rgba(34, 197, 94, 0.4)',
      bottomColor: 'rgba(34, 197, 94, 0.0)',
      lineColor: 'transparent',
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    areaSeries.setData(chartData);
    areaSeriesRef.current = areaSeries;

    // Add line
    const series = chartRef.current.addSeries(LineSeries, {
      color: '#22c55e',
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    series.setData(chartData);
    seriesRef.current = series;

    // Add graduation target line
    if (viewMode === 'cap') {
      series.createPriceLine({
        price: graduationTarget,
        color: '#facc15',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'DEX Graduation',
      });
    }

    chartRef.current.timeScale().fitContent();
  }, [chartData, viewMode, graduationTarget]);

  if (loading && priceHistory.length === 0) {
    return (
      <div className="bg-[#1a1a2e] rounded-xl overflow-hidden">
        <div className="h-[340px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] rounded-xl overflow-hidden">
      {/* Simple Header - Cap/Price Toggle */}
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <button
          onClick={() => setViewMode('cap')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            viewMode === 'cap'
              ? 'bg-green-500/20 text-green-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Cap
        </button>
        <button
          onClick={() => setViewMode('price')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            viewMode === 'price'
              ? 'bg-green-500/20 text-green-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Price
        </button>

        {/* Graduation Target Label */}
        {viewMode === 'cap' && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
              DEX at {graduationTarget.toLocaleString()} XLM
            </span>
            <span className="text-xs text-green-400 font-bold">
              {currentXlmRaised.toFixed(0)} XLM
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full h-[280px]" />

      {/* Progress Bar */}
      <div className="px-3 pb-3">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-yellow-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">{progressPercent.toFixed(1)}% to DEX</span>
          <span className="text-xs text-gray-500">Live from Stellar</span>
        </div>
      </div>
    </div>
  );
}

export default SimpleChart;
