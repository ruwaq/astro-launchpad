/**
 * useToken Hook Tests
 *
 * Tests for token data fetching with auto-refresh, caching,
 * and error handling. Covers single and multiple token scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useToken, useTokenCount, useTokens } from '@/hooks/useToken';
import { useTokenStore } from '@/stores/useTokenStore';
import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { TokenStatus } from '@/lib/stellar/services/sac-factory.service';

// Mock the token store
vi.mock('@/stores/useTokenStore');

const mockTokenInfo: TokenInfo = {
  id: 1,
  creator: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  token_address: 'CTEST123',
  name: 'Test Token',
  symbol: 'TEST',
  issuer: 'GIXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  image_url: 'https://example.com/test.png',
  description: 'Test token description',
  created_at: Date.now(),
  status: TokenStatus.Bonding,
  bonding_curve: {
    xlm_reserve: '10000000000',
    token_reserve: '800000000000',
    k: '8000000000000000000',
  },
  xlm_raised: '5000000000',
  market_cap: '15000000000',
  holders_count: 25,
};

describe('useToken', () => {
  const mockFetchTokenInfo = vi.fn();
  const mockRefreshToken = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (useTokenStore as any).mockReturnValue({
      tokens: new Map([['CTEST123', mockTokenInfo]]),
      isLoadingToken: vi.fn(() => false),
      errors: new Map(),
      fetchTokenInfo: mockFetchTokenInfo,
      refreshToken: mockRefreshToken,
      clearError: mockClearError,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should return null token when address is null', () => {
      const { result } = renderHook(() => useToken(null));

      expect(result.current.token).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return null token when address is undefined', () => {
      const { result } = renderHook(() => useToken(undefined));

      expect(result.current.token).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return cached token if available', () => {
      const { result } = renderHook(() => useToken('CTEST123'));

      expect(result.current.token).toEqual(mockTokenInfo);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Token Fetching', () => {
    it('should fetch token info on mount when fetchOnMount is true', () => {
      (useTokenStore as any).mockReturnValue({
        tokens: new Map(),
        isLoadingToken: vi.fn(() => false),
        errors: new Map(),
        fetchTokenInfo: mockFetchTokenInfo,
        refreshToken: mockRefreshToken,
        clearError: mockClearError,
      });

      renderHook(() => useToken('CTEST123', { fetchOnMount: true }));

      expect(mockFetchTokenInfo).toHaveBeenCalledWith('CTEST123');
    });

    it('should not fetch token info on mount when fetchOnMount is false', () => {
      (useTokenStore as any).mockReturnValue({
        tokens: new Map(),
        isLoadingToken: vi.fn(() => false),
        errors: new Map(),
        fetchTokenInfo: mockFetchTokenInfo,
        refreshToken: mockRefreshToken,
        clearError: mockClearError,
      });

      renderHook(() => useToken('CTEST123', { fetchOnMount: false }));

      expect(mockFetchTokenInfo).not.toHaveBeenCalled();
    });

    it('should not fetch if token is already cached', () => {
      renderHook(() => useToken('CTEST123'));

      expect(mockFetchTokenInfo).not.toHaveBeenCalled();
    });

    it('should not fetch if already loading', () => {
      (useTokenStore as any).mockReturnValue({
        tokens: new Map(),
        isLoadingToken: vi.fn(() => true),
        errors: new Map(),
        fetchTokenInfo: mockFetchTokenInfo,
        refreshToken: mockRefreshToken,
        clearError: mockClearError,
      });

      renderHook(() => useToken('CTEST123'));

      expect(mockFetchTokenInfo).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should return isLoading true when token is loading', () => {
      (useTokenStore as any).mockReturnValue({
        tokens: new Map(),
        isLoadingToken: vi.fn(() => true),
        errors: new Map(),
        fetchTokenInfo: mockFetchTokenInfo,
        refreshToken: mockRefreshToken,
        clearError: mockClearError,
      });

      const { result } = renderHook(() => useToken('CTEST123'));

      expect(result.current.isLoading).toBe(true);
    });

    it('should return isLoading false when token is not loading', () => {
      const { result } = renderHook(() => useToken('CTEST123'));

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return error when token fetch fails', () => {
      (useTokenStore as any).mockReturnValue({
        tokens: new Map(),
        isLoadingToken: vi.fn(() => false),
        errors: new Map([['token-CTEST123', 'Network error']]),
        fetchTokenInfo: mockFetchTokenInfo,
        refreshToken: mockRefreshToken,
        clearError: mockClearError,
      });

      const { result } = renderHook(() => useToken('CTEST123'));

      expect(result.current.error).toBe('Network error');
    });

    it('should provide clearError function', () => {
      const { result } = renderHook(() => useToken('CTEST123'));

      act(() => {
        result.current.clearError();
      });

      expect(mockClearError).toHaveBeenCalledWith('token-CTEST123');
    });

    it('should not call clearError when address is null', () => {
      const { result } = renderHook(() => useToken(null));

      act(() => {
        result.current.clearError();
      });

      expect(mockClearError).not.toHaveBeenCalled();
    });
  });

  describe('Auto-refresh', () => {
    it('should auto-refresh at specified interval', async () => {
      renderHook(() => useToken('CTEST123', { refreshInterval: 10000 }));

      // Fast-forward time by 10 seconds
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(mockRefreshToken).toHaveBeenCalledWith('CTEST123');
    });

    it('should not auto-refresh when interval is 0', async () => {
      renderHook(() => useToken('CTEST123', { refreshInterval: 0 }));

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      expect(mockRefreshToken).not.toHaveBeenCalled();
    });

    it('should use default refresh interval of 30 seconds', async () => {
      renderHook(() => useToken('CTEST123'));

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      expect(mockRefreshToken).toHaveBeenCalledWith('CTEST123');
    });

    it('should clear interval on unmount', async () => {
      const { unmount } = renderHook(() => useToken('CTEST123', { refreshInterval: 10000 }));

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(mockRefreshToken).not.toHaveBeenCalled();
    });

    it('should not refresh if component unmounted', async () => {
      const { unmount } = renderHook(() => useToken('CTEST123', { refreshInterval: 1000 }));

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('Manual Refresh', () => {
    it('should manually refresh token', async () => {
      const { result } = renderHook(() => useToken('CTEST123'));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockRefreshToken).toHaveBeenCalledWith('CTEST123');
    });

    it('should set isRefreshing during manual refresh', async () => {
      let resolveRefresh: () => void;
      const refreshPromise = new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      });

      mockRefreshToken.mockReturnValue(refreshPromise);

      const { result } = renderHook(() => useToken('CTEST123'));

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(true);
      });

      await act(async () => {
        resolveRefresh!();
        await refreshPromise;
      });

      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(false);
      });
    });

    it('should not refresh when address is null', async () => {
      const { result } = renderHook(() => useToken(null));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('Address Changes', () => {
    it('should fetch new token when address changes', () => {
      (useTokenStore as any).mockReturnValue({
        tokens: new Map(),
        isLoadingToken: vi.fn(() => false),
        errors: new Map(),
        fetchTokenInfo: mockFetchTokenInfo,
        refreshToken: mockRefreshToken,
        clearError: mockClearError,
      });

      const { rerender } = renderHook(
        ({ address }) => useToken(address),
        { initialProps: { address: 'CTEST123' } }
      );

      expect(mockFetchTokenInfo).toHaveBeenCalledWith('CTEST123');

      mockFetchTokenInfo.mockClear();

      rerender({ address: 'CTEST456' });

      expect(mockFetchTokenInfo).toHaveBeenCalledWith('CTEST456');
    });

    it('should reset state when address changes to null', () => {
      const { result, rerender } = renderHook(
        ({ address }: { address: string | null }) => useToken(address),
        { initialProps: { address: 'CTEST123' as string | null } }
      );

      expect(result.current.token).toBeTruthy();

      rerender({ address: null as string | null });

      expect(result.current.token).toBeNull();
    });
  });
});

describe('useTokenCount', () => {
  const mockFetchTokenCount = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useTokenStore as any).mockReturnValue({
      tokenCount: 42,
      fetchTokenCount: mockFetchTokenCount,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return token count', () => {
    const { result } = renderHook(() => useTokenCount());

    expect(result.current.tokenCount).toBe(42);
  });

  it('should fetch token count on mount', () => {
    renderHook(() => useTokenCount());

    expect(mockFetchTokenCount).toHaveBeenCalled();
  });

  it('should set loading state while fetching', async () => {
    let resolveFetch: () => void;
    const fetchPromise = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });

    mockFetchTokenCount.mockReturnValue(fetchPromise);

    const { result } = renderHook(() => useTokenCount());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await act(async () => {
      resolveFetch!();
      await fetchPromise;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should provide refresh function', async () => {
    const { result } = renderHook(() => useTokenCount());

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetchTokenCount).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
  });
});

describe('useTokens', () => {
  const mockFetchTokenInfo = vi.fn();
  const mockRefreshToken = vi.fn();
  const mockIsLoadingToken = vi.fn((_address: string): boolean => false);

  const mockToken1: TokenInfo = { ...mockTokenInfo, token_address: 'CTEST123', symbol: 'TEST1' };
  const mockToken2: TokenInfo = { ...mockTokenInfo, token_address: 'CTEST456', symbol: 'TEST2' };
  const mockToken3: TokenInfo = { ...mockTokenInfo, token_address: 'CTEST789', symbol: 'TEST3' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (useTokenStore as any).mockReturnValue({
      tokens: new Map([
        ['CTEST123', mockToken1],
        ['CTEST456', mockToken2],
        ['CTEST789', mockToken3],
      ]),
      isLoadingToken: mockIsLoadingToken,
      fetchTokenInfo: mockFetchTokenInfo,
      refreshToken: mockRefreshToken,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return multiple tokens', () => {
    const { result } = renderHook(() => useTokens(['CTEST123', 'CTEST456']));

    expect(result.current.tokens).toHaveLength(2);
    expect(result.current.tokens[0].symbol).toBe('TEST1');
    expect(result.current.tokens[1].symbol).toBe('TEST2');
  });

  it('should fetch all tokens on mount', () => {
    (useTokenStore as any).mockReturnValue({
      tokens: new Map(),
      isLoadingToken: mockIsLoadingToken,
      fetchTokenInfo: mockFetchTokenInfo,
      refreshToken: mockRefreshToken,
    });

    renderHook(() => useTokens(['CTEST123', 'CTEST456', 'CTEST789']));

    expect(mockFetchTokenInfo).toHaveBeenCalledTimes(3);
    expect(mockFetchTokenInfo).toHaveBeenCalledWith('CTEST123');
    expect(mockFetchTokenInfo).toHaveBeenCalledWith('CTEST456');
    expect(mockFetchTokenInfo).toHaveBeenCalledWith('CTEST789');
  });

  it('should not fetch already cached tokens', () => {
    renderHook(() => useTokens(['CTEST123', 'CTEST456']));

    expect(mockFetchTokenInfo).not.toHaveBeenCalled();
  });

  it('should return isLoading true when any token is loading', () => {
    mockIsLoadingToken.mockImplementation((address) => address === 'CTEST456');

    const { result } = renderHook(() => useTokens(['CTEST123', 'CTEST456']));

    expect(result.current.isLoading).toBe(true);
  });

  it('should auto-refresh all tokens at interval', async () => {
    renderHook(() => useTokens(['CTEST123', 'CTEST456'], { refreshInterval: 10000 }));

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockRefreshToken).toHaveBeenCalledTimes(2);
    expect(mockRefreshToken).toHaveBeenCalledWith('CTEST123');
    expect(mockRefreshToken).toHaveBeenCalledWith('CTEST456');
  });

  it('should manually refresh all tokens', async () => {
    const { result } = renderHook(() => useTokens(['CTEST123', 'CTEST456']));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockRefreshToken).toHaveBeenCalledTimes(2);
  });

  it('should handle empty address array', () => {
    const { result } = renderHook(() => useTokens([]));

    expect(result.current.tokens).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('should filter out undefined tokens', () => {
    (useTokenStore as any).mockReturnValue({
      tokens: new Map([['CTEST123', mockToken1]]),
      isLoadingToken: mockIsLoadingToken,
      fetchTokenInfo: mockFetchTokenInfo,
      refreshToken: mockRefreshToken,
    });

    const { result } = renderHook(() => useTokens(['CTEST123', 'CTEST456']));

    expect(result.current.tokens).toHaveLength(1);
    expect(result.current.tokens[0].symbol).toBe('TEST1');
  });

  it('should not auto-refresh when interval is 0', async () => {
    renderHook(() => useTokens(['CTEST123'], { refreshInterval: 0 }));

    await act(async () => {
      vi.advanceTimersByTime(60000);
    });

    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('should not fetch when fetchOnMount is false', () => {
    (useTokenStore as any).mockReturnValue({
      tokens: new Map(),
      isLoadingToken: mockIsLoadingToken,
      fetchTokenInfo: mockFetchTokenInfo,
      refreshToken: mockRefreshToken,
    });

    renderHook(() => useTokens(['CTEST123'], { fetchOnMount: false }));

    expect(mockFetchTokenInfo).not.toHaveBeenCalled();
  });
});
