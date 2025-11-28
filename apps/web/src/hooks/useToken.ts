/**
 * useToken Hook - REAL DATA from Contract
 *
 * Custom hook for fetching and managing token data from SAC Factory
 * All data comes from deployed contract on Stellar Testnet
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTokenStore } from '@/stores/useTokenStore';
import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';

interface UseTokenOptions {
  /**
   * Auto-refresh interval in ms (0 = disabled)
   * Default: 30000 (30 seconds)
   */
  refreshInterval?: number;

  /**
   * Fetch on mount
   * Default: true
   */
  fetchOnMount?: boolean;
}

/**
 * Hook to fetch and manage single token data
 */
export function useToken(tokenAddress: string | null | undefined, options: UseTokenOptions = {}) {
  const { refreshInterval = 30000, fetchOnMount = true } = options;

  const {
    tokens,
    isLoadingToken,
    errors,
    fetchTokenInfo,
    refreshToken,
    clearError,
  } = useTokenStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);

  // Get token data from store
  const token = tokenAddress ? tokens.get(tokenAddress) : null;
  const isLoading = tokenAddress ? isLoadingToken(tokenAddress) : false;
  const error = tokenAddress ? errors.get(`token-${tokenAddress}`) : null;

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (tokenAddress && fetchOnMount && !token && !isLoading) {
      fetchTokenInfo(tokenAddress);
    }
  }, [tokenAddress, fetchOnMount, token, isLoading, fetchTokenInfo]);

  // Auto-refresh with isMounted check
  useEffect(() => {
    if (!tokenAddress || refreshInterval === 0) return;

    const interval = setInterval(async () => {
      if (!isMountedRef.current) return;

      setIsRefreshing(true);
      await refreshToken(tokenAddress);

      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [tokenAddress, refreshInterval, refreshToken]);

  // Manual refresh with isMounted check
  const refresh = useCallback(async () => {
    if (!tokenAddress || !isMountedRef.current) return;

    setIsRefreshing(true);
    await refreshToken(tokenAddress);

    if (isMountedRef.current) {
      setIsRefreshing(false);
    }
  }, [tokenAddress, refreshToken]);

  return {
    token,
    isLoading,
    isRefreshing,
    error,
    refresh,
    clearError: () => tokenAddress && clearError(`token-${tokenAddress}`),
  };
}

/**
 * Hook to fetch token count from contract
 */
export function useTokenCount() {
  const { tokenCount, fetchTokenCount } = useTokenStore();
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetch = async () => {
      if (!isMountedRef.current) return;

      setIsLoading(true);
      await fetchTokenCount();

      if (isMountedRef.current) {
        setIsLoading(false);
      }
    };

    fetch();
  }, [fetchTokenCount]);

  return {
    tokenCount,
    isLoading,
    refresh: fetchTokenCount,
  };
}

/**
 * Hook to fetch multiple tokens
 */
export function useTokens(addresses: string[], options: UseTokenOptions = {}) {
  const { refreshInterval = 30000, fetchOnMount = true } = options;

  const {
    tokens,
    isLoadingToken,
    fetchTokenInfo,
    refreshToken,
  } = useTokenStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch all tokens on mount
  useEffect(() => {
    if (!fetchOnMount) return;

    addresses.forEach((address) => {
      if (!tokens.has(address) && !isLoadingToken(address)) {
        fetchTokenInfo(address);
      }
    });
  }, [addresses, fetchOnMount, tokens, isLoadingToken, fetchTokenInfo]);

  // Auto-refresh all with isMounted check
  useEffect(() => {
    if (refreshInterval === 0 || addresses.length === 0) return;

    const interval = setInterval(async () => {
      if (!isMountedRef.current) return;

      setIsRefreshing(true);
      await Promise.all(addresses.map((addr) => refreshToken(addr)));

      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [addresses, refreshInterval, refreshToken]);

  // Get token data
  const tokensData = addresses
    .map((addr) => tokens.get(addr))
    .filter((t): t is TokenInfo => t !== undefined);

  const isLoading = addresses.some((addr) => isLoadingToken(addr));

  // Manual refresh with isMounted check
  const refresh = useCallback(async () => {
    if (!isMountedRef.current || addresses.length === 0) return;

    setIsRefreshing(true);
    await Promise.all(addresses.map((addr) => refreshToken(addr)));

    if (isMountedRef.current) {
      setIsRefreshing(false);
    }
  }, [addresses, refreshToken]);

  return {
    tokens: tokensData,
    isLoading,
    isRefreshing,
    refresh,
  };
}
