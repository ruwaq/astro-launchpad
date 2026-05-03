/**
 * TradingWidgetPremium Component
 *
 * Premium trading widget for buying/selling tokens on bonding curves.
 * This is NOT a swap/DEX - bonding curves mint/burn tokens directly.
 *
 * Features:
 * - Buy/Sell tabs with preset amounts
 * - Real-time price calculation from bonding curve
 * - Wallet connection required for trading
 * - Proper Soroban transaction flow (simulate → sign → submit → confirm)
 * - Balance display via UserBalanceDisplay component
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { TransactionBuilder } from '@stellar/stellar-sdk';
import * as rpc from '@stellar/stellar-sdk/rpc';
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import { stroopsToXlm, xlmToStroops } from '@/lib/stellar/utils';
import { toStroopsBigInt } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient } from '@/lib/stellar/client';
import { getNetworkConfig } from '@/lib/config/network';
import { TRANSACTION_FEE_STROOPS } from '@/lib/constants/app';
import { extractSimulationError } from './trading/error-utils';
import { TradeTypeTabs } from './trading/TradeTypeTabs';
import { QuickBuyButtons } from './trading/QuickBuyButtons';
import { QuickSellButtons } from './trading/QuickSellButtons';
import { TradeButton } from './trading/TradeButton';
import { UserBalanceDisplay } from './trading/UserBalanceDisplay';
import { ConnectWalletAlert } from './trading/TradingAlerts';
import { TradeInfoPanel } from './trading/TradeInfoPanel';
import { DisabledTradingState } from './trading/DisabledTradingState';
import { logger } from '@/lib/logger';
import type { TradeType } from './trading/types';
import type { TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { Loader2, AlertCircle } from 'lucide-react';
import { useBalanceRefresh } from '@/lib/events/balanceRefresh';

interface TradingWidgetPremiumProps {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage?: string;
  disabled?: boolean;
  onTradeSuccess?: (type: 'buy' | 'sell', amount: string) => void;
}

const tradeLogger = logger.child({ domain: 'trading' });

export function TradingWidgetPremium({
  tokenAddress,
  tokenSymbol,
  tokenName,
  tokenImage,
  disabled = false,
  onTradeSuccess,
}: TradingWidgetPremiumProps) {
  const { isConnected, address, connect, isConnecting, signTransaction } = useWallet();

  // Trade state
  const [tradeType, setTradeType] = useState<TradeType>('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token data
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [xlmBalance, setXlmBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  // Prevent double submission
  const isSubmittingRef = useRef(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate output amount when input changes
  const calculateOutput = useCallback(async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setOutputAmount(null);
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      // Fetch token info first (needed for calculation)
      const fetchedTokenInfo = await sacFactoryService.getTokenInfo(tokenAddress);
      if (!fetchedTokenInfo) {
        setOutputAmount(null);
        setError('Token not found');
        return;
      }

      setTokenInfo(fetchedTokenInfo);

      const amountInStroops = BigInt(xlmToStroops(amount));

      if (tradeType === 'buy') {
        const buyResult = sacFactoryService.calculateBuyOutputNet(fetchedTokenInfo, amountInStroops);
        if (buyResult.tokensOut > BigInt(0)) {
          setOutputAmount(stroopsToXlm(buyResult.tokensOut.toString()));
        } else {
          setOutputAmount(null);
          setError('Insufficient liquidity');
        }
      } else {
        const sellResult = sacFactoryService.calculateSellOutputNet(fetchedTokenInfo, BigInt(parseFloat(amount) * 10_000_000));
        if (sellResult.xlmOut > BigInt(0)) {
          setOutputAmount(stroopsToXlm(sellResult.xlmOut.toString()));
        } else {
          setOutputAmount(null);
          setError('Insufficient liquidity');
        }
      }
    } catch (err) {
      tradeLogger.error('Calculation failed:', err);
      setOutputAmount(null);
      setError('Calculation failed. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  }, [tokenAddress, tradeType]);

  // Debounced calculation
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      calculateOutput(inputAmount);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputAmount, calculateOutput]);

  // Fetch current price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await sacFactoryService.getPrice(tokenAddress);
        if (price > BigInt(0)) {
          setCurrentPrice(Number(stroopsToXlm(price.toString())));
        }
      } catch (err) {
        tradeLogger.error('Failed to fetch price:', err);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, [tokenAddress]);

  // Refresh balance on trade success
  useBalanceRefresh(() => {
    // Balance refresh is handled by UserBalanceDisplay polling
  });

  // Handle trade execution - full Soroban transaction flow
  const handleTrade = useCallback(async () => {
    if (!isConnected || !address || !inputAmount || parseFloat(inputAmount) <= 0) return;
    if (!tokenInfo) return;

    // Prevent double submission
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setIsProcessing(true);
    setError(null);

    try {
      const config = getNetworkConfig();
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      // Calculate minimum output for race condition protection
      const outputNum = outputAmount ? parseFloat(outputAmount) : 0;
      const minOutput = outputNum > 0
        ? toStroopsBigInt(outputNum * 0.995) // 0.5% tolerance
        : BigInt(0);

      // Build operation
      let operation;
      if (tradeType === 'buy') {
        const xlmStroops = toStroopsBigInt(parseFloat(inputAmount));
        operation = sacFactoryService.buildBuyOperation(
          address,
          tokenAddress,
          xlmStroops,
          minOutput,
          deadline
        );
      } else {
        const tokenStroops = toStroopsBigInt(parseFloat(inputAmount));
        const minXlm = minOutput;
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
        fee: TRANSACTION_FEE_STROOPS,
        networkPassphrase: config.networkPassphrase,
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
        throw new Error(extractSimulationError(simulated));
      }

      if (rpc.Api.isSimulationRestore(simulated)) {
        throw new Error('Transaction needs state restoration. Please try again.');
      }

      if (!rpc.Api.isSimulationSuccess(simulated)) {
        throw new Error('Transaction simulation failed');
      }

      // Assemble transaction from simulation
      const preparedTx = rpc.assembleTransaction(transaction, simulated).build();

      // Sign via wallet
      const signedXDR = await signTransaction(preparedTx.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXDR, config.networkPassphrase);

      // Submit
      const sendResponse = await server.sendTransaction(
        signedTx as Parameters<typeof server.sendTransaction>[0]
      );

      if (sendResponse.status === 'ERROR') {
        throw new Error('Transaction rejected by network');
      }

      // Poll for confirmation
      let attempts = 0;
      let confirmed = false;

      while (attempts < 30) {
        try {
          const getResponse = await server.getTransaction(sendResponse.hash);

          if (getResponse.status === 'SUCCESS') {
            confirmed = true;
            break;
          } else if (getResponse.status === 'FAILED') {
            throw new Error('Transaction failed on-chain');
          }
        } catch {
          // NOT_FOUND is expected while pending
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      if (!confirmed) {
        throw new Error('Transaction confirmation timed out. Your trade may still have succeeded.');
      }

      // Success
      onTradeSuccess?.(tradeType, inputAmount);
      setInputAmount('');
      setOutputAmount(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Trade failed. Please try again.';
      setError(message);
      tradeLogger.error('Trade failed:', err);
    } finally {
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  }, [isConnected, address, inputAmount, tradeType, tokenAddress, tokenInfo, outputAmount, signTransaction, onTradeSuccess]);

  // Handle max click
  const handleMaxClick = useCallback(() => {
    const balance = tradeType === 'buy' ? xlmBalance : tokenBalance;
    setInputAmount(balance);
  }, [tradeType, xlmBalance, tokenBalance]);

  // Handle quick amount click
  const handleQuickAmount = useCallback((amount: number) => {
    setInputAmount(amount.toString());
  }, []);

  // Reset output when trade type changes
  const handleTradeTypeChange = useCallback((type: TradeType) => {
    setTradeType(type);
    setInputAmount('');
    setOutputAmount(null);
    setError(null);
  }, []);

  // Not connected state
  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-ui-border">
          <h3 className="font-bold text-ui-text-primary">Trade {tokenSymbol}</h3>
          <p className="text-sm text-ui-text-secondary mt-1">
            Connect your wallet to trade
          </p>
        </div>
        <div className="p-6 text-center">
          <ConnectWalletAlert onConnect={connect} />
          <button
            onClick={connect}
            disabled={isConnecting}
            className="mt-4 w-full px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary-dark transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  // Disabled state
  if (disabled) {
    return <DisabledTradingState />;
  }

  const isBuy = tradeType === 'buy';
  const displayBalance = isBuy ? xlmBalance : tokenBalance;

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-ui-border">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ui-text-primary">Trade {tokenSymbol}</h3>
        </div>
        {currentPrice !== null && (
          <p className="text-sm text-ui-text-secondary mt-1">
            Current Price: <span className="font-semibold text-ui-text-primary">{currentPrice.toFixed(7)} XLM</span>
          </p>
        )}
      </div>

      {/* Balance Display */}
      <UserBalanceDisplay
        userAddress={address}
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
        isConnected={isConnected}
        onTokenBalanceChange={setTokenBalance}
        onXlmBalanceChange={setXlmBalance}
      />

      {/* Trade Type Tabs */}
      <div className="px-4 pt-4">
        <TradeTypeTabs
          tradeType={tradeType}
          onChange={handleTradeTypeChange}
        />
      </div>

      {/* Input Section */}
      <div className="p-4 space-y-3">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
            {isBuy ? 'Amount to Spend' : 'Amount to Sell'}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={inputAmount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setInputAmount(val);
                }
              }}
              placeholder="0.0"
              disabled={isProcessing}
              className={`w-full px-4 py-3 pr-20 rounded-xl border text-lg font-semibold
                border-ui-border bg-white text-ui-text-primary focus:ring-brand-primary focus:border-brand-primary
                disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
                outline-none transition-colors`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleMaxClick}
                disabled={isProcessing || parseFloat(displayBalance) <= 0}
                className="px-2 py-1 text-xs font-semibold text-brand-primary bg-brand-primary/10 rounded-md hover:bg-brand-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                MAX
              </button>
              <span className="text-sm text-ui-text-secondary font-medium">
                {isBuy ? 'XLM' : tokenSymbol}
              </span>
            </div>
          </div>
          {parseFloat(displayBalance) > 0 && (
            <p className="text-xs text-ui-text-secondary mt-1">
              Balance: {parseFloat(displayBalance) < 0.0001 ? '<0.0001' : parseFloat(displayBalance).toFixed(4)} {isBuy ? 'XLM' : tokenSymbol}
            </p>
          )}
        </div>

        {/* Quick Amount Buttons */}
        {isBuy ? (
          <QuickBuyButtons
            selectedAmount={inputAmount}
            tradeType={tradeType}
            disabled={isProcessing}
            onSelect={handleQuickAmount}
            currentPrice={currentPrice ?? undefined}
            tokenSymbol={tokenSymbol}
          />
        ) : (
          <QuickSellButtons
            tokenBalance={tokenBalance}
            tokenSymbol={tokenSymbol}
            onSelect={setInputAmount}
            selectedAmount={inputAmount}
            disabled={isProcessing}
          />
        )}

        {/* Output Display */}
        {outputAmount && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-ui-text-secondary">
                You {isBuy ? 'receive' : 'receive'}
              </span>
              <span className="font-semibold text-ui-text-primary">
                {outputAmount} {isBuy ? tokenSymbol : 'XLM'}
              </span>
            </div>
          </div>
        )}

        {/* Calculating indicator */}
        {isCalculating && (
          <div className="flex items-center gap-2 text-sm text-ui-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating...
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Trade Button */}
        <TradeButton
          onClick={handleTrade}
          isConnected={isConnected}
          isProcessing={isProcessing}
          selectedToken={{
            address: tokenAddress,
            name: tokenName,
            symbol: tokenSymbol,
            imageUrl: tokenImage,
          }}
          inputAmount={inputAmount}
          hasTokenInfo={true}
          tradeType={tradeType}
        />
      </div>

      {/* Info Panel */}
      {tokenInfo && outputAmount && (
        <TradeInfoPanel
          tokenInfo={tokenInfo}
          tokenSymbol={tokenSymbol}
          inputAmount={inputAmount}
          outputAmount={outputAmount}
          tradeType={tradeType}
        />
      )}
    </div>
  );
}