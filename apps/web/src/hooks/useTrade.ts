/**
 * useTrade Hook
 *
 * Encapsulates trading logic for buy/sell operations via bonding curve
 * Handles transaction building, signing, submission, and status tracking
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { TransactionBuilder, SorobanRpc } from '@stellar/stellar-sdk';
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, toStroopsBigInt, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient, getClientDeadline } from '@/lib/stellar/client';
import { getNetworkConfig } from '@/lib/config/network';
import { ensureTrustlineExists } from '@/lib/stellar/utils/trustline';
import { parseContractError, extractSimulationError } from '@/components/widgets/trading/error-utils';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export type TransactionStatus = 'idle' | 'preparing' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error';
export type TradeType = 'buy' | 'sell';

export interface UseTradeOptions {
  tokenAddress: string;
  tokenSymbol: string;
  tokenInfo: TokenInfo | null;
  onSuccess?: (type: TradeType, amount: number) => void;
  soundEnabled?: boolean;
  playBuy?: () => void;
  playSell?: () => void;
  playError?: () => void;
  playMilestone?: () => void;
  haptics?: {
    mediumTap: () => void;
    success: () => void;
    error: () => void;
  };
}

export interface UseTradeReturn {
  txStatus: TransactionStatus;
  isProcessing: boolean;
  executeTrade: (params: {
    tradeType: TradeType;
    inputAmount: string;
    outputAmount: string;
    slippage: number;
  }) => Promise<boolean>;
  statusMessage: string;
  resetStatus: () => void;
}

const STATUS_MESSAGES: Record<TransactionStatus, string> = {
  idle: '',
  preparing: 'Preparing transaction...',
  signing: 'Please sign in wallet...',
  submitting: 'Submitting to network...',
  confirming: 'Waiting for confirmation...',
  success: 'Transaction successful!',
  error: 'Transaction failed',
};

export function useTrade({
  tokenAddress,
  tokenSymbol,
  tokenInfo,
  onSuccess,
  soundEnabled = true,
  playBuy,
  playSell,
  playError,
  playMilestone,
  haptics,
}: UseTradeOptions): UseTradeReturn {
  const { address, isConnected, signTransaction } = useWallet();
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');

  // RACE CONDITION FIX: Use ref-based lock for synchronous double-click prevention
  const isTransactionInProgressRef = useRef(false);

  const isProcessing = ['preparing', 'signing', 'submitting', 'confirming'].includes(txStatus);

  const resetStatus = useCallback(() => {
    setTxStatus('idle');
    isTransactionInProgressRef.current = false;
  }, []);

  const executeTrade = useCallback(async ({
    tradeType,
    inputAmount,
    outputAmount,
    slippage,
  }: {
    tradeType: TradeType;
    inputAmount: string;
    outputAmount: string;
    slippage: number;
  }): Promise<boolean> => {
    // RACE CONDITION FIX: Use ref-based lock
    if (isTransactionInProgressRef.current) {
      console.warn('[useTrade] Transaction already in progress (ref lock), ignoring');
      return false;
    }
    if (txStatus !== 'idle') {
      console.warn('[useTrade] Transaction already in progress (state), ignoring');
      return false;
    }

    // Acquire lock IMMEDIATELY
    isTransactionInProgressRef.current = true;

    if (!address || !isConnected) {
      toast.error('Connect your wallet first');
      isTransactionInProgressRef.current = false;
      return false;
    }

    if (!tokenInfo) {
      toast.error('Token info not loaded');
      isTransactionInProgressRef.current = false;
      return false;
    }

    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      isTransactionInProgressRef.current = false;
      return false;
    }

    const expectedOutput = parseFloat(outputAmount);
    if (isNaN(expectedOutput) || expectedOutput <= 0) {
      toast.error('Unable to calculate output. Please try again.');
      isTransactionInProgressRef.current = false;
      return false;
    }

    const minOutput = expectedOutput * (1 - slippage / 100);

    try {
      setTxStatus('preparing');
      haptics?.mediumTap();

      const config = getNetworkConfig();
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();
      const deadline = getClientDeadline(300);

      // Setup trustline for buy
      if (tradeType === 'buy' && tokenInfo.issuer?.startsWith('G')) {
        await ensureTrustlineExists(
          address,
          tokenInfo.symbol,
          tokenInfo.issuer,
          signTransaction
        );
      }

      // Build operation
      let operation;
      if (tradeType === 'buy') {
        const xlmStroops = toStroopsBigInt(amount);
        const minTokens = toStroopsBigInt(minOutput);
        operation = sacFactoryService.buildBuyOperation(
          address,
          tokenAddress,
          xlmStroops,
          minTokens,
          deadline
        );
      } else {
        const tokenStroops = toStroopsBigInt(amount);
        const minXlm = toStroopsBigInt(minOutput);
        operation = sacFactoryService.buildSellOperation(
          address,
          tokenAddress,
          tokenStroops,
          minXlm,
          deadline
        );
      }

      // Build transaction
      const account = await server.getAccount(address);
      const txBuilder = new TransactionBuilder(account, {
        fee: '1000000',
        networkPassphrase: config.passphrase,
      });

      const transaction = txBuilder
        .addOperation(operation as Parameters<typeof txBuilder.addOperation>[0])
        .setTimeout(30)
        .build();

      // Simulate
      const simulated = await server.simulateTransaction(transaction);

      if (!simulated) {
        throw new Error('No simulation response from network');
      }

      if ('error' in simulated && simulated.error) {
        const errorMsg = extractSimulationError(simulated);
        console.error('Simulation error details:', JSON.stringify(simulated, null, 2));
        throw new Error(errorMsg);
      }

      if (SorobanRpc.Api.isSimulationRestore(simulated)) {
        throw new Error('Transaction needs state restoration. Please try again.');
      }

      if (!SorobanRpc.Api.isSimulationSuccess(simulated)) {
        console.error('Simulation failed:', simulated);
        throw new Error('Transaction simulation failed');
      }

      const preparedTx = SorobanRpc.assembleTransaction(transaction, simulated).build();

      // Sign
      setTxStatus('signing');
      const signedXDR = await signTransaction(preparedTx.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);

      // Submit
      setTxStatus('submitting');
      const sendResponse = await server.sendTransaction(signedTx as Parameters<typeof server.sendTransaction>[0]);

      if (sendResponse.status === 'ERROR') {
        throw new Error('Transaction rejected');
      }

      // Wait for confirmation
      setTxStatus('confirming');
      let attempts = 0;
      let success = false;

      while (attempts < 30) {
        try {
          const getResponse = await server.getTransaction(sendResponse.hash);

          if (getResponse.status === 'SUCCESS') {
            success = true;
            break;
          } else if (getResponse.status === 'FAILED') {
            throw new Error('Transaction failed');
          }
        } catch (err) {
          const error = err as { message?: string };
          if (error.message?.includes('Bad union switch')) {
            success = true;
            break;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!success) {
        throw new Error('Transaction timeout');
      }

      // Success!
      setTxStatus('success');

      // Play sounds and haptics
      if (soundEnabled) {
        if (tradeType === 'buy') {
          playBuy?.();
        } else {
          playSell?.();
        }

        if (amount >= 100) {
          setTimeout(() => playMilestone?.(), 300);
        }
      }
      haptics?.success();

      // Confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: tradeType === 'buy' ? ['#10b981', '#22c55e', '#4ade80'] : ['#8b5cf6', '#a855f7', '#c084fc'],
      });

      toast.success(
        `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${outputAmount} ${tokenSymbol}!`,
        { icon: tradeType === 'buy' ? '🚀' : '💰' }
      );

      // Callback
      onSuccess?.(tradeType, amount);

      // Reset after animation
      setTimeout(() => {
        setTxStatus('idle');
        isTransactionInProgressRef.current = false;
      }, 2000);

      return true;

    } catch (error) {
      setTxStatus('error');
      if (soundEnabled) playError?.();
      haptics?.error();

      const err = error as { message?: string };
      const errorMessage = parseContractError(err);
      console.error('Trade error:', error);
      toast.error(errorMessage);

      setTimeout(() => {
        setTxStatus('idle');
        isTransactionInProgressRef.current = false;
      }, 2000);

      return false;
    }
  }, [
    address,
    isConnected,
    signTransaction,
    tokenAddress,
    tokenSymbol,
    tokenInfo,
    txStatus,
    onSuccess,
    soundEnabled,
    playBuy,
    playSell,
    playError,
    playMilestone,
    haptics,
  ]);

  return {
    txStatus,
    isProcessing,
    executeTrade,
    statusMessage: STATUS_MESSAGES[txStatus],
    resetStatus,
  };
}
