/**
 * Token Store - REAL DATA ONLY
 *
 * Fetches data directly from SAC Factory contract on Stellar Testnet
 * NO mock data, NO placeholders
 *
 * Contract: CBTFVJEYLMDHDFTKLO4PR7MHPFVNISOYYBJQSCNCQXWX2WMXXXJAZWT2
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sacFactoryService, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';

interface TokenState {
  // Token data (from contract)
  tokens: Map<string, TokenInfo>;
  tokenCount: number;

  // Loading states
  isLoadingTokens: boolean;
  isLoadingToken: (address: string) => boolean;
  loadingTokens: Set<string>;

  // Errors
  errors: Map<string, string>;

  // Actions
  fetchTokenCount: () => Promise<void>;
  fetchTokenInfo: (address: string) => Promise<TokenInfo | null>;
  refreshToken: (address: string) => Promise<void>;
  clearError: (key: string) => void;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      // Initial state
      tokens: new Map(),
      tokenCount: 0,
      isLoadingTokens: false,
      loadingTokens: new Set(),
      errors: new Map(),

      // Check if specific token is loading
      isLoadingToken: (address: string) => {
        return get().loadingTokens.has(address);
      },

      // Fetch total token count from contract
      fetchTokenCount: async () => {
        try {
          const count = await sacFactoryService.getTokenCount();
          set({ tokenCount: count });
        } catch (error) {
          console.error('Error fetching token count:', error);
          set((state) => ({
            errors: new Map(state.errors).set('tokenCount', (error as Error).message),
          }));
        }
      },

      // Fetch token info from contract
      fetchTokenInfo: async (address: string) => {
        const { tokens, loadingTokens, errors } = get();

        // Already loading this token
        if (loadingTokens.has(address)) {
          return tokens.get(address) || null;
        }

        // Mark as loading
        set((state) => ({
          loadingTokens: new Set(state.loadingTokens).add(address),
        }));

        try {
          const tokenInfo = await sacFactoryService.getTokenInfo(address);

          if (tokenInfo) {
            // Update tokens map
            set((state) => {
              const newTokens = new Map(state.tokens);
              newTokens.set(address, tokenInfo);

              const newLoadingTokens = new Set(state.loadingTokens);
              newLoadingTokens.delete(address);

              const newErrors = new Map(state.errors);
              newErrors.delete(`token-${address}`);

              return {
                tokens: newTokens,
                loadingTokens: newLoadingTokens,
                errors: newErrors,
              };
            });

            return tokenInfo;
          } else {
            // Token not found
            throw new Error('Token not found on contract');
          }
        } catch (error) {
          console.error(`Error fetching token ${address}:`, error);

          set((state) => {
            const newLoadingTokens = new Set(state.loadingTokens);
            newLoadingTokens.delete(address);

            const newErrors = new Map(state.errors);
            newErrors.set(`token-${address}`, (error as Error).message);

            return {
              loadingTokens: newLoadingTokens,
              errors: newErrors,
            };
          });

          return null;
        }
      },

      // Refresh specific token (re-fetch from contract)
      refreshToken: async (address: string) => {
        const { fetchTokenInfo } = get();
        await fetchTokenInfo(address);
      },

      // Clear error
      clearError: (key: string) => {
        set((state) => {
          const newErrors = new Map(state.errors);
          newErrors.delete(key);
          return { errors: newErrors };
        });
      },
    }),
    {
      name: 'astro-shiba-tokens',
      // Only persist tokens and tokenCount, not loading states
      partialize: (state) => ({
        tokens: Array.from(state.tokens.entries()),
        tokenCount: state.tokenCount,
      }),
      // Convert Map back from storage
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.tokens)) {
          state.tokens = new Map(state.tokens as any);
        }
      },
    }
  )
);
