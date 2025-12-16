'use client';

/**
 * Universal Wallet Context
 *
 * Supports ALL platforms: Desktop, Mobile (iOS/Android), Tablets
 *
 * Desktop: Freighter, xBull, Albedo, Hana extensions
 * Mobile: LOBSTR, xBull apps via deep links
 *
 * Uses @creit.tech/stellar-wallets-kit for unified wallet interface
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  xBullModule,
  AlbedoModule,
  LobstrModule,
  HanaModule,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit';
import { getNetworkConfig, getCurrentNetwork, checkWalletNetwork } from '@/lib/config/network';
import { isValidStellarAddress } from '@/lib/stellar/utils';
import { setAuthHeaders, clearAuthHeaders, resetApolloCache } from '@/lib/graphql/client';
import { useTokenStore } from '@/stores/useTokenStore';
import { logger } from '@/lib/logger';

// Create wallet-specific logger
const walletLogger = logger.child({ domain: 'wallet' });

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  networkWarning: string | null; // Warning if connected to wrong network
  expectedNetwork: string; // Expected network (testnet/mainnet)
  kit: StellarWalletsKit | null;
  isMobile: boolean;
  isStandalone: boolean; // PWA mode
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (txXDR: string) => Promise<string>;
  signAuthMessage: () => Promise<{ signature: string; timestamp: string } | null>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  openMobileWallet: (wallet: 'lobstr' | 'xbull') => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Detect mobile device
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Detect standalone PWA mode
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

// Deep link URLs for mobile wallets
const MOBILE_WALLET_DEEPLINKS = {
  lobstr: {
    ios: 'lobstr://',
    android: 'lobstr://',
    universal: 'https://lobstr.co',
    appStore: 'https://apps.apple.com/app/lobstr-stellar-wallet/id1404357892',
    playStore: 'https://play.google.com/store/apps/details?id=com.lobstr.client',
  },
  xbull: {
    ios: 'xbull://',
    android: 'xbull://',
    universal: 'https://xbull.app',
    appStore: 'https://apps.apple.com/app/xbull-wallet/id6705122563',
    playStore: 'https://play.google.com/store/apps/details?id=app.xbull.wallet',
  },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Ref to track mobile wallet timeout for cleanup (prevents memory leak)
  const mobileWalletTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get expected network from config
  const expectedNetwork = getCurrentNetwork();

  // Initialize StellarWalletsKit with wallet modules
  useEffect(() => {
    // Detect platform
    setIsMobile(detectMobile());
    setIsStandalone(detectStandalone());

    const config = getNetworkConfig();
    const network =
      config.passphrase === 'Public Global Stellar Network ; September 2015'
        ? WalletNetwork.PUBLIC
        : WalletNetwork.TESTNET;

    // Create wallet modules - supports both desktop and mobile
    // Desktop: Freighter, xBull, Albedo, Hana browser extensions
    // Mobile: LOBSTR app via deep links
    const modules = [
      new FreighterModule(),
      new xBullModule(),
      new AlbedoModule(),
      new HanaModule(),
      new LobstrModule(),
    ];

    const walletsKit = new StellarWalletsKit({
      network,
      modules,
    });

    setKit(walletsKit);

    // Restore saved connection with validation
    if (typeof window !== 'undefined') {
      try {
        const savedAddress = localStorage.getItem('stellar_wallet_address');
        const savedWalletId = localStorage.getItem('stellar_wallet_id');

        // Validate saved data before using (with full checksum validation)
        const isAddressValid = savedAddress && isValidStellarAddress(savedAddress);

        const validWalletIds = ['freighter', 'xbull', 'albedo', 'hana', 'lobstr'];
        const isWalletIdValid = savedWalletId &&
          typeof savedWalletId === 'string' &&
          validWalletIds.includes(savedWalletId.toLowerCase());

        if (isAddressValid && isWalletIdValid) {
          try {
            walletsKit.setWallet(savedWalletId);
            setAddress(savedAddress);
            setIsConnected(true);
          } catch (walletError) {
            // Wallet extension might not be available - clear invalid state
            walletLogger.warn('Could not restore wallet connection', { error: walletError });
            localStorage.removeItem('stellar_wallet_address');
            localStorage.removeItem('stellar_wallet_id');
          }
        } else if ((savedAddress && !isAddressValid) || (savedWalletId && !isWalletIdValid)) {
          // Clear invalid/corrupted data
          walletLogger.warn('Invalid wallet data in localStorage, clearing');
          localStorage.removeItem('stellar_wallet_address');
          localStorage.removeItem('stellar_wallet_id');
        }
      } catch (e) {
        walletLogger.warn('Could not access localStorage', { error: e });
      }
    }

    // Register service worker for PWA
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => walletLogger.info('Service worker registered', { scope: reg.scope }))
        .catch((err) => walletLogger.warn('Service worker registration failed', { error: err }));
    }
  }, []);

  // Sync auth headers with Apollo client when address changes
  useEffect(() => {
    if (address) {
      // Set basic auth header immediately
      // Signature will be added on-demand for mutations
      setAuthHeaders({
        'X-Stellar-Address': address,
      });
    } else {
      clearAuthHeaders();
    }
  }, [address]);

  const connect = useCallback(async () => {
    if (!kit) {
      setError('Wallet kit not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await kit.openModal({
        onWalletSelected: async (option: ISupportedWallet) => {
          try {
            kit.setWallet(option.id);
            const { address: walletAddress } = await kit.getAddress();

            // Note: Network validation happens at signing time - wallet will reject
            // transactions for the wrong network. We just clear any previous warning.
            setNetworkWarning(null);

            setAddress(walletAddress);
            setIsConnected(true);

            try {
              localStorage.setItem('stellar_wallet_address', walletAddress);
              localStorage.setItem('stellar_wallet_id', option.id);
            } catch (e) {
              walletLogger.warn('Could not save to localStorage', { error: e });
            }
          } catch (error) {
            walletLogger.error('Error in wallet selection', error);
            throw error;
          }
        },
        modalTitle: isMobile ? 'Connect Mobile Wallet' : 'Connect Wallet',
        notAvailableText: isMobile
          ? 'Open LOBSTR or xBull app to connect your wallet.'
          : 'Wallet extension not installed. Install Freighter, xBull, or Albedo.',
      });
    } catch (err: unknown) {
      walletLogger.error('Failed to connect wallet', err);

      let errorMessage = 'Failed to connect wallet';
      const errorObj = err as { code?: number; message?: string };

      if (errorObj.code === -1) {
        errorMessage = isMobile
          ? 'Please install LOBSTR or xBull wallet app to connect.'
          : 'Wallet extension not installed. Please install Freighter, xBull, or Albedo.';
      } else if (errorObj.code === -3) {
        errorMessage = 'Please select a wallet from the modal.';
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }

      setError(errorMessage);
      setIsConnected(false);
      throw new Error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [kit, isMobile]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setIsConnected(false);
    try {
      localStorage.removeItem('stellar_wallet_address');
      localStorage.removeItem('stellar_wallet_id');
    } catch (e) {
      walletLogger.warn('Could not clear localStorage', { error: e });
    }
    // Clear all cached data to prevent stale user-specific data
    clearAuthHeaders();
    resetApolloCache();
    // Reset token store (use getState to avoid hook dependency)
    useTokenStore.getState().reset();
  }, []);

  const signTransaction = useCallback(async (txXDR: string): Promise<string> => {
    if (!kit || !address) {
      throw new Error('Wallet not connected');
    }

    const config = getNetworkConfig();

    // The network passphrase is validated at transaction signing time
    // If wallet is on wrong network, the signature will fail
    // Clear any previous warnings since we're about to verify via signing
    setNetworkWarning(null);

    try {
      const { signedTxXdr } = await kit.signTransaction(txXDR, {
        address,
        networkPassphrase: config.passphrase,
      });

      return signedTxXdr;
    } catch (err: unknown) {
      walletLogger.error('Failed to sign transaction', err);
      const message = err instanceof Error ? err.message : 'Failed to sign transaction';
      throw new Error(message);
    }
  }, [kit, address]);

  /**
   * Sign an authentication message for API requests
   * Message format: "stellar:auth:{address}:{timestamp}"
   * Returns signature and timestamp for use in request headers
   */
  const signAuthMessage = useCallback(async (): Promise<{ signature: string; timestamp: string } | null> => {
    if (!kit || !address) {
      return null;
    }

    try {
      const timestamp = Date.now().toString();
      const message = `stellar:auth:${address}:${timestamp}`;
      const messageBuffer = Buffer.from(message, 'utf8');

      // Try to sign using the wallet's signBlob method
      // Note: Not all wallets support this - will fall back gracefully
      // Type assertion needed as signBlob is not in all kit versions' types
      const { signedBlob } = await (kit as any).signBlob(messageBuffer, {
        address,
      });

      // signedBlob is returned as base64
      return {
        signature: signedBlob,
        timestamp,
      };
    } catch (err: unknown) {
      // Many wallets don't support signBlob - this is expected
      const message = err instanceof Error ? err.message : 'Unknown error';
      walletLogger.debug('Wallet does not support message signing', { message });
      return null;
    }
  }, [kit, address]);

  /**
   * Get authentication headers for API requests
   * Includes address and optionally signature + timestamp if wallet supports signing
   */
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!address) {
      return {};
    }

    const headers: Record<string, string> = {
      'X-Stellar-Address': address,
    };

    // Try to get a fresh signature
    const authData = await signAuthMessage();
    if (authData) {
      headers['X-Stellar-Signature'] = authData.signature;
      headers['X-Stellar-Timestamp'] = authData.timestamp;
    }

    return headers;
  }, [address, signAuthMessage]);

  // Open mobile wallet app via deep link
  const openMobileWallet = useCallback((wallet: 'lobstr' | 'xbull') => {
    const links = MOBILE_WALLET_DEEPLINKS[wallet];
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Clear any existing timeout to prevent memory leak
    if (mobileWalletTimeoutRef.current) {
      clearTimeout(mobileWalletTimeoutRef.current);
      mobileWalletTimeoutRef.current = null;
    }

    // Try deep link first
    const deepLink = isIOS ? links.ios : links.android;
    window.location.href = deepLink;

    // Fallback to app store after timeout (tracked in ref for cleanup)
    mobileWalletTimeoutRef.current = setTimeout(() => {
      // Only navigate if timeout wasn't cancelled
      if (mobileWalletTimeoutRef.current !== null) {
        const storeLink = isIOS ? links.appStore : links.playStore;
        window.location.href = storeLink;
        mobileWalletTimeoutRef.current = null;
      }
    }, 2500);
  }, []);

  // Cleanup mobile wallet timeout on unmount (prevents memory leak)
  useEffect(() => {
    return () => {
      if (mobileWalletTimeoutRef.current) {
        clearTimeout(mobileWalletTimeoutRef.current);
        mobileWalletTimeoutRef.current = null;
      }
    };
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<WalletContextType>(
    () => ({
      address,
      isConnected,
      isConnecting,
      error,
      networkWarning,
      expectedNetwork,
      kit,
      isMobile,
      isStandalone,
      connect,
      disconnect,
      signTransaction,
      signAuthMessage,
      getAuthHeaders,
      openMobileWallet,
    }),
    [
      address,
      isConnected,
      isConnecting,
      error,
      networkWarning,
      expectedNetwork,
      kit,
      isMobile,
      isStandalone,
      connect,
      disconnect,
      signTransaction,
      signAuthMessage,
      getAuthHeaders,
      openMobileWallet,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
