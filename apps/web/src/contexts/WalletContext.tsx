'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit';
import { getNetworkConfig } from '@/lib/config/network';

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  kit: StellarWalletsKit | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (txXDR: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);

  // Initialize StellarWalletsKit
  useEffect(() => {
    const config = getNetworkConfig();
    const network =
      config.passphrase === 'Public Global Stellar Network ; September 2015'
        ? WalletNetwork.PUBLIC
        : WalletNetwork.TESTNET;

    const walletsKit = new StellarWalletsKit({
      network,
      modules: allowAllModules(),
    });

    setKit(walletsKit);

    // Check if already connected (from localStorage)
    const savedAddress = localStorage.getItem('stellar_wallet_address');
    if (savedAddress) {
      setAddress(savedAddress);
      setIsConnected(true);
    }
  }, []);

  const connect = async () => {
    if (!kit) {
      setError('Wallet kit not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Open wallet selection modal
      const { address: walletAddress } = await kit.getAddress();

      setAddress(walletAddress);
      setIsConnected(true);
      localStorage.setItem('stellar_wallet_address', walletAddress);
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);

      // Handle specific error cases
      let errorMessage = 'Failed to connect wallet';

      if (err.code === -1) {
        errorMessage = 'Wallet connection rejected or wallet extension not installed.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsConnected(false);

      // Rethrow so components can handle it
      throw new Error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setIsConnected(false);
    localStorage.removeItem('stellar_wallet_address');
  };

  const signTransaction = async (txXDR: string): Promise<string> => {
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
  };

  const value: WalletContextType = {
    address,
    isConnected,
    isConnecting,
    error,
    kit,
    connect,
    disconnect,
    signTransaction,
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
