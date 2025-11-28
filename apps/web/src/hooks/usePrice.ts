/**
 * usePrice Hook - REAL PRICE from Contract
 *
 * Fetches current token price from SAC Factory bonding curve
 * Updates in real-time via polling
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';

// PERFORMANCE: Polling intervals optimized for production
// Previous: 5000ms = 720 requests/hour per token (too aggressive)
// Current: 30000ms = 120 requests/hour per token (production-ready)
const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds
const MIN_POLLING_INTERVAL = 10000; // 10 seconds minimum to prevent abuse

interface UsePriceOptions {
  /**
   * Polling interval in ms
   * Default: 30000 (30 seconds) - balanced for production
   * Minimum: 10000 (10 seconds) - prevents excessive RPC calls
   */
  interval?: number;

  /**
   * Auto-start polling
   * Default: true
   */
  autoStart?: boolean;
}

export function usePrice(tokenAddress: string | null | undefined, options: UsePriceOptions = {}) {
  // PERFORMANCE: Enforce minimum polling interval
  const requestedInterval = options.interval ?? DEFAULT_POLLING_INTERVAL;
  const interval = Math.max(requestedInterval, MIN_POLLING_INTERVAL);
  const { autoStart = true } = options;

  const [price, setPrice] = useState<bigint>(BigInt(0));
  const [previousPrice, setPreviousPrice] = useState<bigint>(BigInt(0));
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs to track prices without causing re-renders or infinite loops
  // This breaks the circular dependency: fetchPrice -> price -> fetchPrice
  const priceRef = useRef<bigint>(BigInt(0));
  const previousPriceRef = useRef<bigint>(BigInt(0));

  // Fetch current price - only depends on tokenAddress
  const fetchPrice = useCallback(async () => {
    if (!tokenAddress) return;

    try {
      const currentPrice = await sacFactoryService.getPrice(tokenAddress);

      // Update previous price if we had one (using ref value)
      if (priceRef.current > BigInt(0)) {
        previousPriceRef.current = priceRef.current;
        setPreviousPrice(priceRef.current);
      }

      // Update current price
      priceRef.current = currentPrice;
      setPrice(currentPrice);
      setError(null);

      // Calculate change using ref values (avoids stale closure)
      if (previousPriceRef.current > BigInt(0)) {
        const change = Number(currentPrice - previousPriceRef.current) / Number(previousPriceRef.current) * 100;
        setPriceChange24h(change);
      }

      setIsLoading(false);
    } catch (err: unknown) {
      console.error('Error fetching price:', err);
      // Type guard for error message extraction
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch price';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [tokenAddress]); // Only depends on tokenAddress - breaks the infinite loop

  // Initial fetch - runs once when tokenAddress changes
  useEffect(() => {
    if (tokenAddress && autoStart) {
      // Reset state for new token
      priceRef.current = BigInt(0);
      previousPriceRef.current = BigInt(0);
      setPrice(BigInt(0));
      setPreviousPrice(BigInt(0));
      setPriceChange24h(0);
      setIsLoading(true);
      setError(null);

      fetchPrice();
    }
  }, [tokenAddress, autoStart, fetchPrice]);

  // Polling - separate effect to avoid recreating interval on price changes
  useEffect(() => {
    if (!tokenAddress || !autoStart || interval === 0) return;

    const pollInterval = setInterval(fetchPrice, interval);

    return () => clearInterval(pollInterval);
  }, [tokenAddress, interval, autoStart, fetchPrice]);

  // Price direction indicator - computed from state for rendering
  const priceDirection = price > previousPrice ? 'up' : price < previousPrice ? 'down' : 'stable';

  return {
    price,
    previousPrice,
    priceChange24h,
    priceDirection,
    isLoading,
    error,
    refresh: fetchPrice,
  };
}
