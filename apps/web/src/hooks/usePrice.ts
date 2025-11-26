/**
 * usePrice Hook - REAL PRICE from Contract
 *
 * Fetches current token price from SAC Factory bonding curve
 * Updates in real-time via polling
 */

import { useEffect, useState, useCallback } from 'react';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';

interface UsePriceOptions {
  /**
   * Polling interval in ms
   * Default: 5000 (5 seconds) - fast updates like Pump.fun
   */
  interval?: number;

  /**
   * Auto-start polling
   * Default: true
   */
  autoStart?: number;
}

export function usePrice(tokenAddress: string | null | undefined, options: UsePriceOptions = {}) {
  const { interval = 5000, autoStart = true } = options;

  const [price, setPrice] = useState<bigint>(BigInt(0));
  const [previousPrice, setPreviousPrice] = useState<bigint>(BigInt(0));
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current price
  const fetchPrice = useCallback(async () => {
    if (!tokenAddress) return;

    try {
      const currentPrice = await sacFactoryService.getPrice(tokenAddress);

      // Update previous price if we had one
      if (price > BigInt(0)) {
        setPreviousPrice(price);
      }

      setPrice(currentPrice);
      setError(null);

      // Calculate 24h change (simplified - would need historical data from backend)
      // For now, just compare with previous poll
      if (previousPrice > BigInt(0)) {
        const change = Number(currentPrice - previousPrice) / Number(previousPrice) * 100;
        setPriceChange24h(change);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching price:', err);
      setError((err as Error).message);
      setIsLoading(false);
    }
  }, [tokenAddress, price, previousPrice]);

  // Initial fetch
  useEffect(() => {
    if (tokenAddress && autoStart) {
      fetchPrice();
    }
  }, [tokenAddress, autoStart, fetchPrice]);

  // Polling
  useEffect(() => {
    if (!tokenAddress || !autoStart || interval === 0) return;

    const pollInterval = setInterval(() => {
      fetchPrice();
    }, interval);

    return () => clearInterval(pollInterval);
  }, [tokenAddress, interval, autoStart, fetchPrice]);

  // Price direction indicator
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
