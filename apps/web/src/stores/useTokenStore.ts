/**
 * Token Store (Zustand)
 *
 * Manages token data state across the application.
 * Provides caching, loading states, and error handling for token info fetched
 * from the SAC Factory contract.
 */

import { create } from 'zustand';
import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { SacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import { logger } from '@/lib/logger';

const storeLogger = logger.child({ domain: 'token-store' });

interface TokenState {
  /** Map of token address -> TokenInfo */
  tokens: Map<string, TokenInfo>;
  /** Map of token address -> loading state */
  loadingTokens: Map<string, boolean>;
  /** Map of error key -> error message */
  errors: Map<string, string>;
  /** Total number of tokens launched */
  tokenCount: number;

  // Actions
  fetchTokenInfo: (address: string) => Promise<void>;
  refreshToken: (address: string) => Promise<void>;
  isLoadingToken: (address: string) => boolean;
  clearError: (key: string) => void;
  fetchTokenCount: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  tokens: new Map<string, TokenInfo>(),
  loadingTokens: new Map<string, boolean>(),
  errors: new Map<string, string>(),
  tokenCount: 0,
};

export const useTokenStore = create<TokenState>((set, get) => ({
  ...initialState,

  fetchTokenInfo: async (address: string) => {
    const state = get();

    // Skip if already loading or already fetched
    if (state.loadingTokens.get(address)) return;
    if (state.tokens.has(address)) return;

    set((prev) => {
      const next = new Map(prev.loadingTokens);
      next.set(address, true);
      return { loadingTokens: next };
    });

    try {
      const service = new SacFactoryService();
      const tokenInfo = await service.getTokenInfo(address);

      if (tokenInfo) {
        set((prev) => {
          const next = new Map(prev.tokens);
          next.set(address, tokenInfo);
          const nextLoading = new Map(prev.loadingTokens);
          nextLoading.set(address, false);
          const nextErrors = new Map(prev.errors);
          nextErrors.delete(`token-${address}`);
          return { tokens: next, loadingTokens: nextLoading, errors: nextErrors };
        });
      } else {
        set((prev) => {
          const nextLoading = new Map(prev.loadingTokens);
          nextLoading.set(address, false);
          const nextErrors = new Map(prev.errors);
          nextErrors.set(`token-${address}`, 'Token not found');
          return { loadingTokens: nextLoading, errors: nextErrors };
        });
      }
    } catch (error) {
      storeLogger.error('Failed to fetch token info:', { address, error });
      set((prev) => {
        const nextLoading = new Map(prev.loadingTokens);
        nextLoading.set(address, false);
        const nextErrors = new Map(prev.errors);
        nextErrors.set(
          `token-${address}`,
          error instanceof Error ? error.message : 'Failed to fetch token'
        );
        return { loadingTokens: nextLoading, errors: nextErrors };
      });
    }
  },

  refreshToken: async (address: string) => {
    try {
      const service = new SacFactoryService();
      const tokenInfo = await service.getTokenInfo(address);

      if (tokenInfo) {
        set((prev) => {
          const next = new Map(prev.tokens);
          next.set(address, tokenInfo);
          return { tokens: next };
        });
      }
    } catch (error) {
      storeLogger.error('Failed to refresh token info:', { address, error });
    }
  },

  isLoadingToken: (address: string) => {
    return get().loadingTokens.get(address) ?? false;
  },

  clearError: (key: string) => {
    set((prev) => {
      const next = new Map(prev.errors);
      next.delete(key);
      return { errors: next };
    });
  },

  fetchTokenCount: async () => {
    try {
      const service = new SacFactoryService();
      const count = await service.getTokenCount();
      set({ tokenCount: count });
    } catch (error) {
      storeLogger.error('Failed to fetch token count:', error);
    }
  },

  reset: () => {
    set(initialState);
  },
}));