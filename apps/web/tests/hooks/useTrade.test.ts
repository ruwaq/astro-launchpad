/**
 * Tests for useTrade Hook
 *
 * Comprehensive tests for trading functionality including buy/sell flows,
 * race condition protection, error handling, and transaction lifecycle.
 *
 * CRITICAL NOTES:
 * - minOutputTolerance is for race condition protection, NOT slippage
 * - Bonding curves are deterministic (no slippage in traditional sense)
 * - Fee: 0.30% total (0.05% protocol + 0.25% LP)
 * - Graduation triggered at $30k XLM raised (pump.fun style)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { useTrade, TransactionStatus } from '@/hooks/useTrade';
import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { TokenStatus } from '@/lib/stellar/services/sac-factory.service';

// Mock dependencies
vi.mock('@/contexts/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/lib/stellar/services/sac-factory.service', () => ({
  sacFactoryService: {
    buildBuyOperation: vi.fn(),
    buildSellOperation: vi.fn(),
  },
  toStroopsBigInt: vi.fn((amount: number) => BigInt(Math.floor(amount * 10_000_000))),
  TokenStatus: {
    Bonding: 'Bonding',
    Graduated: 'Graduated',
  },
}));

vi.mock('@/lib/stellar/client', () => ({
  stellarClient: {
    getSoroban: vi.fn(() => ({
      getServer: vi.fn(() => ({
        getAccount: vi.fn(),
        simulateTransaction: vi.fn(),
        sendTransaction: vi.fn(),
        getTransaction: vi.fn(),
      })),
    })),
  },
  getClientDeadline: vi.fn(() => BigInt(Date.now() + 300000)),
}));

vi.mock('@/lib/config/network', () => ({
  getNetworkConfig: vi.fn(() => ({
    passphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
  })),
}));

vi.mock('@/lib/stellar/utils/trustline', () => ({
  ensureTrustlineExists: vi.fn(),
}));

vi.mock('@/components/widgets/trading/error-utils', () => ({
  parseContractError: vi.fn((err) => {
    const msg = typeof err === 'string' ? err : err?.message || 'Unknown error';
    if (msg.includes('rejected')) return 'Transaction cancelled';
    if (msg.includes('#140')) return 'Anti-whale: max buy amount exceeded';
    if (msg.includes('#40')) return 'Price changed - another trade occurred first';
    return msg;
  }),
  extractSimulationError: vi.fn((sim) => {
    if ('error' in sim && sim.error) {
      if (typeof sim.error === 'string' && sim.error.includes('insufficient')) {
        return 'Insufficient balance';
      }
      return sim.error as string;
    }
    return 'Simulation failed';
  }),
}));

vi.mock('@/hooks/useRateLimit', () => ({
  useRateLimit: vi.fn(() => ({
    checkAndRecord: vi.fn(() => true),
    getRemainingActions: vi.fn(() => 5),
  })),
  RATE_LIMIT_CONFIGS: {
    trade: {
      maxActions: 5,
      windowMs: 60000,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  tradingLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');

  // Create a mock TransactionBuilder class
  class MockTransactionBuilder {
    constructor(...args: any[]) {
      // Fully mocked - no super call needed
    }

    addOperation(...args: any[]) {
      return this;
    }

    setTimeout(...args: any[]) {
      return this;
    }

    build(...args: any[]) {
      return {
        toXDR: () => 'mock-tx-xdr',
      };
    }

    static fromXDR(...args: any[]) {
      return {};
    }
  }

  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      assembleTransaction: vi.fn((tx, sim) => ({
        build: () => ({ toXDR: () => 'mock-assembled-xdr' }),
      })),
      Api: {
        ...actual.rpc.Api,
        isSimulationSuccess: vi.fn(() => true),
        isSimulationRestore: vi.fn(() => false),
        isSimulationError: vi.fn(() => false),
      },
    },
    TransactionBuilder: MockTransactionBuilder,
  };
});

// Import mocked modules
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, toStroopsBigInt } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient } from '@/lib/stellar/client';
import { ensureTrustlineExists } from '@/lib/stellar/utils/trustline';
import { parseContractError, extractSimulationError } from '@/components/widgets/trading/error-utils';
import { useRateLimit } from '@/hooks/useRateLimit';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { TransactionBuilder } from '@stellar/stellar-sdk';

describe('useTrade', () => {
  // Test fixtures
  const mockAddress = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const mockTokenAddress = 'CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const mockTokenSymbol = 'TEST';

  const mockTokenInfo: TokenInfo = {
    id: 1,
    creator: mockAddress,
    token_address: mockTokenAddress,
    name: 'Test Token',
    symbol: mockTokenSymbol,
    issuer: 'GIXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    image_url: 'https://example.com/image.png',
    description: 'Test token description',
    created_at: Date.now(),
    status: TokenStatus.Bonding,
    bonding_curve: {
      xlm_reserve: '100000000000', // 10,000 XLM
      token_reserve: '800000000000000', // 80M tokens
      k: '80000000000000000000000', // k = x * y
    },
    xlm_raised: '20000000000', // 2,000 XLM
    market_cap: '25000000000', // 2,500 XLM
    holders_count: 10,
  };

  const mockSignTransaction = vi.fn();
  const mockServer = {
    getAccount: vi.fn(),
    simulateTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup wallet mock
    (useWallet as any).mockReturnValue({
      address: mockAddress,
      isConnected: true,
      signTransaction: mockSignTransaction,
    });

    // Setup stellar client mock
    (stellarClient.getSoroban as any).mockReturnValue({
      getServer: () => mockServer,
    });

    // Setup successful account response
    mockServer.getAccount.mockResolvedValue({
      accountId: () => mockAddress,
      sequenceNumber: () => '12345',
      incrementSequenceNumber: vi.fn(),
    });

    // Setup rate limit mock
    (useRateLimit as any).mockReturnValue({
      checkAndRecord: vi.fn(() => true),
      getRemainingActions: vi.fn(() => 5),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should start with idle status', () => {
      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      expect(result.current.txStatus).toBe('idle');
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.statusMessage).toBe('');
    });
  });

  describe('Buy Flow - Complete Success', () => {
    it('should execute complete buy flow successfully', async () => {
      const onSuccess = vi.fn();
      const mockTxXDR = 'AAAA...mock-xdr...';
      const mockSignedXDR = 'AAAA...signed-xdr...';
      const mockTxHash = 'abc123hash';

      // Mock successful simulation
      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      // Mock signing
      mockSignTransaction.mockResolvedValue(mockSignedXDR);

      // Mock successful submission
      mockServer.sendTransaction.mockResolvedValue({
        status: 'PENDING',
        hash: mockTxHash,
      });

      // Mock transaction confirmation
      mockServer.getTransaction.mockResolvedValue({
        status: 'SUCCESS',
        ledger: 12346,
      });

      // Mock TransactionBuilder
      const mockBuild = vi.fn().mockReturnValue({
        toXDR: () => mockTxXDR,
      });
      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockImplementation(mockBuild);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
          onSuccess,
        })
      );

      let success = false;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
          minOutputTolerance: 0.5,
        });
      });

      await waitFor(() => {
        expect(result.current.txStatus).toBe('success');
      });

      expect(success).toBe(true);
      expect(mockServer.simulateTransaction).toHaveBeenCalled();
      expect(mockSignTransaction).toHaveBeenCalled();
      expect(mockServer.sendTransaction).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith('buy', 100);
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Bought'),
        expect.any(Object)
      );
      expect(confetti).toHaveBeenCalled();
    });

    it('should create trustline before buy if needed', async () => {
      (ensureTrustlineExists as any).mockResolvedValue(true);

      // Setup successful flow
      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      mockSignTransaction.mockResolvedValue('signed-xdr');

      mockServer.sendTransaction.mockResolvedValue({
        status: 'PENDING',
        hash: 'hash123',
      });

      mockServer.getTransaction.mockResolvedValue({
        status: 'SUCCESS',
        ledger: 12346,
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);
      vi.spyOn(TransactionBuilder, 'fromXDR').mockReturnValue({} as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      await act(async () => {
        await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      await waitFor(() => {
        expect(ensureTrustlineExists).toHaveBeenCalledWith(
          mockAddress,
          mockTokenSymbol,
          mockTokenInfo.issuer,
          mockSignTransaction
        );
      });
    });

    it('should apply minOutputTolerance correctly (0.5% default)', async () => {
      const buildBuyOpMock = vi.fn();
      (sacFactoryService.buildBuyOperation as any).mockImplementation(buildBuyOpMock);
      (toStroopsBigInt as any).mockImplementation((amount: number) =>
        BigInt(Math.floor(amount * 10_000_000))
      );

      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      mockSignTransaction.mockResolvedValue('signed-xdr');
      mockServer.sendTransaction.mockResolvedValue({
        status: 'PENDING',
        hash: 'hash',
      });
      mockServer.getTransaction.mockResolvedValue({
        status: 'SUCCESS',
        ledger: 12346,
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);
      vi.spyOn(TransactionBuilder, 'fromXDR').mockReturnValue({} as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      await act(async () => {
        await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
          minOutputTolerance: 0.5, // 0.5% tolerance
        });
      });

      await waitFor(() => {
        expect(buildBuyOpMock).toHaveBeenCalled();
      });

      // Verify minTokens calculation: 10000 * (1 - 0.005) = 9950
      const callArgs = buildBuyOpMock.mock.calls[0];
      const minTokens = callArgs[3]; // 4th argument is minTokens

      // Expected: 10000 tokens * 10^7 stroops * 0.995 = 99500000000
      expect(minTokens).toBe(BigInt(99_500_000_000));
    });
  });

  describe('Sell Flow - Complete Success', () => {
    it('should execute complete sell flow successfully', async () => {
      const onSuccess = vi.fn();

      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      mockSignTransaction.mockResolvedValue('signed-xdr');

      mockServer.sendTransaction.mockResolvedValue({
        status: 'PENDING',
        hash: 'hash123',
      });

      mockServer.getTransaction.mockResolvedValue({
        status: 'SUCCESS',
        ledger: 12346,
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);
      vi.spyOn(TransactionBuilder, 'fromXDR').mockReturnValue({} as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
          onSuccess,
        })
      );

      let success = false;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'sell',
          inputAmount: '10000',
          outputAmount: '100',
        });
      });

      await waitFor(() => {
        expect(result.current.txStatus).toBe('success');
      });

      expect(success).toBe(true);
      expect(onSuccess).toHaveBeenCalledWith('sell', 10000);
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Sold'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle user rejection', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);

      // User rejects signing
      mockSignTransaction.mockRejectedValue(new Error('User rejected'));

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      await waitFor(() => {
        expect(result.current.txStatus).toBe('error');
      });

      expect(success).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle simulation error', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        error: 'Insufficient balance',
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      await waitFor(() => {
        expect(result.current.txStatus).toBe('error');
      });

      expect(success).toBe(false);
      expect(extractSimulationError).toHaveBeenCalled();
    });

    it('should handle network error', async () => {
      mockServer.getAccount.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      await waitFor(() => {
        expect(result.current.txStatus).toBe('error');
      });

      expect(success).toBe(false);
    });

    it('should handle min output not met (race condition)', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        error: 'Error(Contract, #40)', // Price changed error
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      await waitFor(() => {
        expect(result.current.txStatus).toBe('error');
      });

      expect(success).toBe(false);
      expect(parseContractError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('#40'),
        })
      );
    });

    it('should handle anti-whale error', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        error: 'Error(Contract, #140)', // Anti-whale error
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      await act(async () => {
        await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      await waitFor(() => {
        expect(parseContractError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('#140'),
          })
        );
      });
    });
  });

  describe('Wallet Disconnection', () => {
    it('should prevent trade if wallet not connected', async () => {
      (useWallet as any).mockReturnValue({
        address: null,
        isConnected: false,
        signTransaction: mockSignTransaction,
      });

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      expect(success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Connect your wallet first');
    });

    it('should handle wallet disconnection during signing', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);

      mockSignTransaction.mockRejectedValue(new Error('Wallet not connected'));

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      await waitFor(() => {
        expect(result.current.txStatus).toBe('error');
      });

      expect(success).toBe(false);
    });
  });

  describe('Transaction Status Tracking', () => {
    it('should track status through all phases', async () => {
      const statuses: TransactionStatus[] = [];

      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      mockSignTransaction.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'signed-xdr';
      });

      mockServer.sendTransaction.mockResolvedValue({
        status: 'PENDING',
        hash: 'hash123',
      });

      mockServer.getTransaction.mockResolvedValue({
        status: 'SUCCESS',
        ledger: 12346,
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);
      vi.spyOn(TransactionBuilder, 'fromXDR').mockReturnValue({} as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      // Track status changes
      const statusTracker = vi.fn(() => {
        statuses.push(result.current.txStatus);
      });

      await act(async () => {
        statusTracker();
        await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
        statusTracker();
      });

      await waitFor(() => {
        expect(result.current.txStatus).toBe('success');
      });

      // Should have gone through: idle → preparing → signing → submitting → confirming → success
      expect(statuses).toContain('idle');
      expect(statuses).toContain('preparing');
    });

    it('should set isProcessing correctly during transaction', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      mockSignTransaction.mockResolvedValue('signed-xdr');

      mockServer.sendTransaction.mockResolvedValue({
        status: 'PENDING',
        hash: 'hash123',
      });

      mockServer.getTransaction.mockResolvedValue({
        status: 'SUCCESS',
        ledger: 12346,
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);
      vi.spyOn(TransactionBuilder, 'fromXDR').mockReturnValue({} as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      expect(result.current.isProcessing).toBe(false);

      const promise = act(async () => {
        await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      // Should be processing during transaction
      await waitFor(() => {
        expect(
          ['preparing', 'signing', 'submitting', 'confirming'].includes(result.current.txStatus)
        ).toBe(true);
      });

      await promise;

      await waitFor(() => {
        expect(result.current.txStatus).toBe('success');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const checkAndRecord = vi.fn(() => false);
      (useRateLimit as any).mockReturnValue({
        checkAndRecord,
        getRemainingActions: vi.fn(() => 0),
      });

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      expect(success).toBe(false);
      expect(checkAndRecord).toHaveBeenCalled();
    });
  });

  describe('Race Condition Protection', () => {
    it('should prevent double-click with ref lock', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        results: [{ xdr: 'result-xdr' }],
        cost: { cpuInsns: '1000', memBytes: '2000' },
        latestLedger: 12345,
      });

      mockSignTransaction.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'signed-xdr';
      });

      mockServer.sendTransaction.mockResolvedValue({
        status: 'PENDING',
        hash: 'hash123',
      });

      mockServer.getTransaction.mockResolvedValue({
        status: 'SUCCESS',
        ledger: 12346,
      });

      vi.spyOn(TransactionBuilder.prototype, 'addOperation').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'setTimeout').mockReturnThis();
      vi.spyOn(TransactionBuilder.prototype, 'build').mockReturnValue({
        toXDR: () => 'xdr',
      } as any);
      vi.spyOn(TransactionBuilder, 'fromXDR').mockReturnValue({} as any);

      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      // Simulate double-click
      const promise1 = act(async () => {
        return await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      const promise2 = act(async () => {
        return await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // One should succeed, one should be blocked
      expect([result1, result2].filter((r) => r === true).length).toBe(1);
      expect([result1, result2].filter((r) => r === false).length).toBe(1);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset status to idle', async () => {
      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      // Manually set to error state
      await act(async () => {
        await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '0', // Invalid amount
          outputAmount: '10000',
        });
      });

      expect(result.current.txStatus).not.toBe('idle');

      act(() => {
        result.current.resetStatus();
      });

      expect(result.current.txStatus).toBe('idle');
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid input amount', async () => {
      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '-100', // Negative
          outputAmount: '10000',
        });
      });

      expect(success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Enter a valid amount');
    });

    it('should reject invalid output amount', async () => {
      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: mockTokenInfo,
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '0', // Zero
        });
      });

      expect(success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        'Unable to calculate output. Please try again.'
      );
    });

    it('should require token info', async () => {
      const { result } = renderHook(() =>
        useTrade({
          tokenAddress: mockTokenAddress,
          tokenSymbol: mockTokenSymbol,
          tokenInfo: null, // Missing
        })
      );

      let success = true;

      await act(async () => {
        success = await result.current.executeTrade({
          tradeType: 'buy',
          inputAmount: '100',
          outputAmount: '10000',
        });
      });

      expect(success).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Token info not loaded');
    });
  });
});
