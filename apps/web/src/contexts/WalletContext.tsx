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

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
import { getNetworkConfig } from '@/lib/config/network';

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  kit: StellarWalletsKit | null;
  isMobile: boolean;
  isStandalone: boolean; // PWA mode
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (txXDR: string) => Promise<string>;
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
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

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

    // Restore saved connection
    if (typeof window !== 'undefined') {
      try {
        const savedAddress = localStorage.getItem('stellar_wallet_address');
        const savedWalletId = localStorage.getItem('stellar_wallet_id');

        if (savedAddress && savedWalletId) {
          walletsKit.setWallet(savedWalletId);
          setAddress(savedAddress);
          setIsConnected(true);
        }
      } catch (e) {
        console.warn('Could not access localStorage:', e);
      }
    }

    // Register service worker for PWA
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA] Service worker registered:', reg.scope))
        .catch((err) => console.warn('[PWA] Service worker registration failed:', err));
    }
  }, []);

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

            setAddress(walletAddress);
            setIsConnected(true);

            try {
              localStorage.setItem('stellar_wallet_address', walletAddress);
              localStorage.setItem('stellar_wallet_id', option.id);
            } catch (e) {
              console.warn('Could not save to localStorage:', e);
            }
          } catch (error) {
            console.error('Error in wallet selection:', error);
            throw error;
          }
        },
        modalTitle: isMobile ? 'Connect Mobile Wallet' : 'Connect Wallet',
        notAvailableText: isMobile
          ? 'Open LOBSTR or xBull app to connect your wallet.'
          : 'Wallet extension not installed. Install Freighter, xBull, or Albedo.',
      });
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);

      let errorMessage = 'Failed to connect wallet';

      if (err.code === -1) {
        errorMessage = isMobile
          ? 'Please install LOBSTR or xBull wallet app to connect.'
          : 'Wallet extension not installed. Please install Freighter, xBull, or Albedo.';
      } else if (err.code === -3) {
        errorMessage = 'Please select a wallet from the modal.';
      } else if (err.message) {
        errorMessage = err.message;
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
      console.warn('Could not clear localStorage:', e);
    }
  }, []);

  const signTransaction = useCallback(async (txXDR: string): Promise<string> => {
    if (!kit || !address) {
      throw new Error('Wallet not connected');
    }

    const config = getNetworkConfig();

    try {
      const { signedTxXdr } = await kit.signTransaction(txXDR, {
        address,
        networkPassphrase: config.passphrase,
      });

      return signedTxXdr;
    } catch (err: any) {
      console.error('Failed to sign transaction:', err);
      throw new Error(err.message || 'Failed to sign transaction');
    }
  }, [kit, address]);

  // Open mobile wallet app via deep link
  const openMobileWallet = useCallback((wallet: 'lobstr' | 'xbull') => {
    const links = MOBILE_WALLET_DEEPLINKS[wallet];
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Try deep link first
    const deepLink = isIOS ? links.ios : links.android;
    window.location.href = deepLink;

    // Fallback to app store after timeout
    setTimeout(() => {
      const storeLink = isIOS ? links.appStore : links.playStore;
      window.location.href = storeLink;
    }, 2500);
  }, []);

  const value: WalletContextType = {
    address,
    isConnected,
    isConnecting,
    error,
    kit,
    isMobile,
    isStandalone,
    connect,
    disconnect,
    signTransaction,
    openMobileWallet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
