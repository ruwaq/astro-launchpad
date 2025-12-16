/**
 * WalletContext Tests
 *
 * Tests wallet connection flow, disconnection, network switching, and transaction signing.
 * Covers desktop wallets, mobile wallets, and PWA functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { WalletProvider, useWallet } from '@/contexts/WalletContext';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';

// Mock StellarWalletsKit
vi.mock('@creit.tech/stellar-wallets-kit', () => {
  const mockKit = {
    openModal: vi.fn(),
    setWallet: vi.fn(),
    getAddress: vi.fn(),
    signTransaction: vi.fn(),
    // signBlob is not in the actual SDK
  };

  return {
    StellarWalletsKit: vi.fn(() => mockKit),
    WalletNetwork: {
      PUBLIC: 'PUBLIC',
      TESTNET: 'TESTNET',
    },
    FreighterModule: vi.fn(),
    xBullModule: vi.fn(),
    AlbedoModule: vi.fn(),
    LobstrModule: vi.fn(),
    HanaModule: vi.fn(),
  };
});

// Mock network config
vi.mock('@/lib/config/network', () => ({
  getNetworkConfig: vi.fn(() => ({
    passphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
  })),
  getCurrentNetwork: vi.fn(() => 'testnet'),
  checkWalletNetwork: vi.fn(),
}));

// Mock GraphQL client
vi.mock('@/lib/graphql/client', () => ({
  setAuthHeaders: vi.fn(),
  clearAuthHeaders: vi.fn(),
  resetApolloCache: vi.fn(),
}));

// Mock token store
vi.mock('@/stores/useTokenStore', () => ({
  useTokenStore: {
    getState: () => ({
      reset: vi.fn(),
    }),
  },
}));

// Mock stellar address validation
vi.mock('@/lib/stellar/utils', () => ({
  isValidStellarAddress: vi.fn((address: string) => {
    return address.startsWith('G') && address.length === 56;
  }),
}));

describe('WalletContext', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage = {};

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {};
        }),
      },
      writable: true,
    });

    // Mock navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with disconnected state', () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(result.current.address).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should create StellarWalletsKit instance', () => {
      renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(StellarWalletsKit).toHaveBeenCalled();
    });

    it('should set expected network to testnet', () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(result.current.expectedNetwork).toBe('testnet');
    });

    it('should detect desktop environment by default', () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(result.current.isMobile).toBe(false);
    });

    it('should detect mobile environment', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true,
      });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(result.current.isMobile).toBe(true);
    });

    it('should detect Android environment', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10)',
        writable: true,
      });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(result.current.isMobile).toBe(true);
    });
  });

  describe('Connection Flow', () => {
    it('should connect wallet successfully', async () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const mockKit = new StellarWalletsKit({} as any);

      (mockKit.openModal as any).mockImplementation(async ({ onWalletSelected }: any) => {
        await onWalletSelected({ id: 'freighter', name: 'Freighter' });
      });
      (mockKit.getAddress as any).mockResolvedValue({ address: mockAddress });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.address).toBe(mockAddress);
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should set isConnecting during connection', async () => {
      const mockKit = new StellarWalletsKit({} as any);
      (mockKit.openModal as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      act(() => {
        result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.isConnecting).toBe(true);
      });
    });

    it('should save wallet connection to localStorage', async () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const mockKit = new StellarWalletsKit({} as any);

      (mockKit.openModal as any).mockImplementation(async ({ onWalletSelected }: any) => {
        await onWalletSelected({ id: 'freighter', name: 'Freighter' });
      });
      (mockKit.getAddress as any).mockResolvedValue({ address: mockAddress });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(mockLocalStorage['stellar_wallet_address']).toBe(mockAddress);
        expect(mockLocalStorage['stellar_wallet_id']).toBe('freighter');
      });
    });

    it('should handle connection errors', async () => {
      const mockKit = new StellarWalletsKit({} as any);
      (mockKit.openModal as any).mockRejectedValue(new Error('User cancelled'));

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await expect(async () => {
        await act(async () => {
          await result.current.connect();
        });
      }).rejects.toThrow();

      expect(result.current.isConnected).toBe(false);
    });

    it('should handle wallet not installed error', async () => {
      const mockKit = new StellarWalletsKit({} as any);
      (mockKit.openModal as any).mockRejectedValue({ code: -1 });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await expect(async () => {
        await act(async () => {
          await result.current.connect();
        });
      }).rejects.toThrow(/install/i);
    });

    it('should handle no wallet selected error', async () => {
      const mockKit = new StellarWalletsKit({} as any);
      (mockKit.openModal as any).mockRejectedValue({ code: -3 });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await expect(async () => {
        await act(async () => {
          await result.current.connect();
        });
      }).rejects.toThrow(/select a wallet/i);
    });
  });

  describe('Disconnection', () => {
    it('should disconnect wallet', async () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      mockLocalStorage['stellar_wallet_address'] = mockAddress;
      mockLocalStorage['stellar_wallet_id'] = 'freighter';

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      act(() => {
        result.current.disconnect();
      });

      await waitFor(() => {
        expect(result.current.address).toBeNull();
        expect(result.current.isConnected).toBe(false);
        expect(mockLocalStorage['stellar_wallet_address']).toBeUndefined();
        expect(mockLocalStorage['stellar_wallet_id']).toBeUndefined();
      });
    });

    it('should clear auth headers on disconnect', async () => {
      const { clearAuthHeaders } = await import('@/lib/graphql/client');

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      act(() => {
        result.current.disconnect();
      });

      await waitFor(() => {
        expect(clearAuthHeaders).toHaveBeenCalled();
      });
    });

    it('should reset Apollo cache on disconnect', async () => {
      const { resetApolloCache } = await import('@/lib/graphql/client');

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      act(() => {
        result.current.disconnect();
      });

      await waitFor(() => {
        expect(resetApolloCache).toHaveBeenCalled();
      });
    });

    it('should reset token store on disconnect', async () => {
      const { useTokenStore } = await import('@/stores/useTokenStore');

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      const resetMock = vi.fn();
      (useTokenStore.getState as any) = () => ({ reset: resetMock });

      act(() => {
        result.current.disconnect();
      });

      await waitFor(() => {
        expect(resetMock).toHaveBeenCalled();
      });
    });
  });

  describe('Transaction Signing', () => {
    it('should sign transaction successfully', async () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const mockSignedXDR = 'AAAAAgAAAAA...';
      const mockKit = new StellarWalletsKit({} as any);

      (mockKit.signTransaction as any).mockResolvedValue({ signedTxXdr: mockSignedXDR });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      // Set connected state
      await act(async () => {
        (mockKit.openModal as any).mockImplementation(async ({ onWalletSelected }: any) => {
          await onWalletSelected({ id: 'freighter', name: 'Freighter' });
        });
        (mockKit.getAddress as any).mockResolvedValue({ address: mockAddress });
        await result.current.connect();
      });

      const txXDR = 'AAAAAgAAAAB...';
      let signedXDR: string = '';

      await act(async () => {
        signedXDR = await result.current.signTransaction(txXDR);
      });

      expect(signedXDR).toBe(mockSignedXDR);
    });

    it('should throw error when signing without connection', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await expect(async () => {
        await act(async () => {
          await result.current.signTransaction('AAAAAgAAAAB...');
        });
      }).rejects.toThrow('Wallet not connected');
    });

    it('should handle signing errors', async () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const mockKit = new StellarWalletsKit({} as any);

      (mockKit.openModal as any).mockImplementation(async ({ onWalletSelected }: any) => {
        await onWalletSelected({ id: 'freighter', name: 'Freighter' });
      });
      (mockKit.getAddress as any).mockResolvedValue({ address: mockAddress });
      (mockKit.signTransaction as any).mockRejectedValue(new Error('User rejected'));

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await act(async () => {
        await result.current.connect();
      });

      await expect(async () => {
        await act(async () => {
          await result.current.signTransaction('AAAAAgAAAAB...');
        });
      }).rejects.toThrow('User rejected');
    });
  });

  describe('Authentication', () => {
    it('should return null for sign auth message (feature not implemented)', async () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const mockKit = new StellarWalletsKit({} as any);

      (mockKit.openModal as any).mockImplementation(async ({ onWalletSelected }: any) => {
        await onWalletSelected({ id: 'freighter', name: 'Freighter' });
      });
      (mockKit.getAddress as any).mockResolvedValue({ address: mockAddress });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await act(async () => {
        await result.current.connect();
      });

      let authData: any = null;

      await act(async () => {
        authData = await result.current.signAuthMessage();
      });

      // Since signBlob is not available, should return null
      expect(authData).toBeNull();
    });

    it('should get auth headers with address only', async () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const mockKit = new StellarWalletsKit({} as any);

      (mockKit.openModal as any).mockImplementation(async ({ onWalletSelected }: any) => {
        await onWalletSelected({ id: 'freighter', name: 'Freighter' });
      });
      (mockKit.getAddress as any).mockResolvedValue({ address: mockAddress });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await act(async () => {
        await result.current.connect();
      });

      let headers: any = {};

      await act(async () => {
        headers = await result.current.getAuthHeaders();
      });

      // Should only contain address (no signature since signBlob not available)
      expect(headers).toEqual({
        'X-Stellar-Address': mockAddress,
      });
    });

    it('should return empty headers when not connected', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      let headers: any = {};

      await act(async () => {
        headers = await result.current.getAuthHeaders();
      });

      expect(headers).toEqual({});
    });
  });

  describe('State Persistence', () => {
    it('should restore saved connection on mount', async () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      mockLocalStorage['stellar_wallet_address'] = mockAddress;
      mockLocalStorage['stellar_wallet_id'] = 'freighter';

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await waitFor(() => {
        expect(result.current.address).toBe(mockAddress);
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should clear invalid address from localStorage', () => {
      mockLocalStorage['stellar_wallet_address'] = 'invalid_address';
      mockLocalStorage['stellar_wallet_id'] = 'freighter';

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(mockLocalStorage['stellar_wallet_address']).toBeUndefined();
      expect(mockLocalStorage['stellar_wallet_id']).toBeUndefined();
    });

    it('should clear invalid wallet ID from localStorage', () => {
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      mockLocalStorage['stellar_wallet_address'] = mockAddress;
      mockLocalStorage['stellar_wallet_id'] = 'invalid_wallet';

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(mockLocalStorage['stellar_wallet_address']).toBeUndefined();
      expect(mockLocalStorage['stellar_wallet_id']).toBeUndefined();
    });
  });

  describe('Mobile Wallet Support', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true,
      });
    });

    it('should detect iOS device', () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      expect(result.current.isMobile).toBe(true);
    });

    it('should open LOBSTR wallet via deep link', async () => {
      const mockLocationAssign = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { href: '', assign: mockLocationAssign },
        writable: true,
      });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      act(() => {
        result.current.openMobileWallet('lobstr');
      });

      await waitFor(() => {
        expect(window.location.href).toContain('lobstr://');
      });
    });

    it('should open xBull wallet via deep link', async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      act(() => {
        result.current.openMobileWallet('xbull');
      });

      await waitFor(() => {
        expect(window.location.href).toContain('xbull://');
      });
    });
  });

  describe('Context Usage', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        renderHook(() => useWallet());
      }).toThrow('useWallet must be used within a WalletProvider');

      console.error = originalError;
    });
  });

  describe('Auth Header Sync', () => {
    it('should set auth headers when address changes', async () => {
      const { setAuthHeaders } = await import('@/lib/graphql/client');
      const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const mockKit = new StellarWalletsKit({} as any);

      (mockKit.openModal as any).mockImplementation(async ({ onWalletSelected }: any) => {
        await onWalletSelected({ id: 'freighter', name: 'Freighter' });
      });
      (mockKit.getAddress as any).mockResolvedValue({ address: mockAddress });

      const { result } = renderHook(() => useWallet(), {
        wrapper: WalletProvider,
      });

      await act(async () => {
        await result.current.connect();
      });

      await waitFor(() => {
        expect(setAuthHeaders).toHaveBeenCalledWith({
          'X-Stellar-Address': mockAddress,
        });
      });
    });
  });
});
