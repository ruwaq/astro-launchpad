/**
 * Premium Trading Widget
 *
 * Enhanced trading interface with:
 * - Quick-buy preset amounts (pump.fun style)
 * - Framer Motion animations
 * - Real-time price animations
 * - Haptic feedback on mobile
 * - Visual feedback for success/error states
 *
 * Refactored to use modular sub-components for maintainability.
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownUp,
  Zap,
  TrendingUp,
  TrendingDown,
  Loader2,
  Wallet,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { tradingLogger } from '@/lib/logger';
import { sacFactoryService, toStroopsBigInt, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient, getClientDeadline } from '@/lib/stellar/client';
import { TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import { ensureTrustlineExists } from '@/lib/stellar/utils/trustline';
import { getNetworkConfig } from '@/lib/config/network';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useTradingSounds, useHaptics } from '@/hooks/useTradingSounds';
import { sanitizeNumericInput } from '@/lib/utils/format';

// Import modular components
import {
  QuickBuyButtons,
  QuickSellButtons,
  TradingHeader,
  TransactionStatus,
  TradeInfoPanel,
  DisabledTradingState,
  UserBalanceDisplay,
  parseContractError,
  extractSimulationError,
  type TradeType,
} from './trading';
import type { TransactionStatusType } from './trading/TransactionStatus';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

const buttonVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

interface TradingWidgetPremiumProps {
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenImage?: string;
  disabled?: boolean;
  onTradeSuccess?: (type: 'buy' | 'sell', amount: number) => void;
}

export function TradingWidgetPremium({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  tokenName = 'Token',
  tokenImage,
  disabled = false,
  onTradeSuccess,
}: TradingWidgetPremiumProps) {
  const { address, isConnected, connect, signTransaction } = useWallet();
  const { playBuy, playSell, playClick, playError, playMilestone } = useTradingSounds();
  const haptics = useHaptics();

  // State
  const [tradeType, setTradeType] = useState<TradeType>('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  // Fixed minimal slippage protection (0.5%) - bonding curves are deterministic
  // This only protects against race conditions, not price impact
  const slippage = 0.5;
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [txStatus, setTxStatus] = useState<TransactionStatusType>('idle');
  const [previousPrice, setPreviousPrice] = useState<bigint>(BigInt(0));
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  // User's token balance for MAX/percentage sells (in stroops)
  const [userTokenBalance, setUserTokenBalance] = useState<string>('0');
  // User's XLM balance for buy validation (in XLM, not stroops)
  const [userXlmBalance, setUserXlmBalance] = useState<string>('0');

  // RACE CONDITION FIX: Use ref-based lock for synchronous double-click prevention
  const isTransactionInProgressRef = useRef(false);
  // FIX: Track price flash timeout to prevent memory leaks
  const priceFlashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to calculate price from reserves
  const calculatePriceFromReserves = (bc: { xlm_reserve: string; token_reserve: string }): bigint => {
    const xlm = BigInt(bc.xlm_reserve);
    const token = BigInt(bc.token_reserve);
    if (token === BigInt(0)) return BigInt(0);
    return (xlm * BigInt(10_000_000)) / token;
  };

  // Load token info and tracked holdings
  const loadTokenInfo = useCallback(async () => {
    try {
      const info = await sacFactoryService.getTokenInfo(tokenAddress);

      if (info && tokenInfo) {
        const oldPrice = calculatePriceFromReserves(tokenInfo.bonding_curve);
        const newPrice = calculatePriceFromReserves(info.bonding_curve);

        // FIX: Clear previous timeout before creating new one to prevent memory leaks
        if (priceFlashTimeoutRef.current) {
          clearTimeout(priceFlashTimeoutRef.current);
        }

        if (newPrice > oldPrice) {
          setPriceFlash('up');
          priceFlashTimeoutRef.current = setTimeout(() => setPriceFlash(null), 500);
        } else if (newPrice < oldPrice) {
          setPriceFlash('down');
          priceFlashTimeoutRef.current = setTimeout(() => setPriceFlash(null), 500);
        }

        setPreviousPrice(oldPrice);
      }

      setTokenInfo(info || null);
    } catch {
      setTokenInfo(null);
    }
  }, [tokenAddress, tokenInfo]);

  useEffect(() => {
    loadTokenInfo();
    const interval = setInterval(loadTokenInfo, 30000);
    return () => {
      clearInterval(interval);
      // FIX: Cleanup price flash timeout on unmount to prevent memory leaks
      if (priceFlashTimeoutRef.current) {
        clearTimeout(priceFlashTimeoutRef.current);
      }
    };
  }, [loadTokenInfo]);

  // Calculate output
  const calculateOutput = useCallback(async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0 || !tokenInfo) {
      setOutputAmount('');
      return;
    }

    setIsCalculating(true);

    try {
      const amount = parseFloat(inputAmount);
      if (isNaN(amount) || amount <= 0) {
        setOutputAmount('0');
        return;
      }

      let output: bigint;

      if (tradeType === 'buy') {
        const xlmStroops = toStroopsBigInt(amount);
        output = sacFactoryService.calculateBuyOutput(tokenInfo, xlmStroops);
      } else {
        const tokenStroops = toStroopsBigInt(amount);
        output = sacFactoryService.calculateSellOutput(tokenInfo, tokenStroops);
      }

      const outputAfterFee = sacFactoryService.applyTradingFee(output);
      const outputHuman = Number(outputAfterFee) / 10_000_000;

      setOutputAmount(outputHuman.toFixed(4));
    } catch {
      setOutputAmount('0');
    } finally {
      setIsCalculating(false);
    }
  }, [inputAmount, tradeType, tokenInfo]);

  useEffect(() => {
    const timer = setTimeout(calculateOutput, 300);
    return () => clearTimeout(timer);
  }, [calculateOutput]);

  // Format price display
  const currentPrice = useMemo(() => {
    if (!tokenInfo) return '0.0000000';
    const price = calculatePriceFromReserves(tokenInfo.bonding_curve);
    return (Number(price) / 10_000_000).toFixed(7);
  }, [tokenInfo]);

  const priceChangePercent = useMemo(() => {
    if (!tokenInfo || previousPrice === BigInt(0)) return 0;
    const current = Number(calculatePriceFromReserves(tokenInfo.bonding_curve));
    const previous = Number(previousPrice);
    return ((current - previous) / previous) * 100;
  }, [tokenInfo, previousPrice]);

  // Handle quick buy
  const handleQuickBuy = (amount: number) => {
    playClick();
    haptics.lightTap();
    setTradeType('buy');
    setInputAmount(amount.toString());
  };

  // Handle trade type switch
  const handleSwitchType = () => {
    playClick();
    haptics.lightTap();
    setTradeType((prev) => (prev === 'buy' ? 'sell' : 'buy'));
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
  };

  // Execute trade
  const handleTrade = async () => {
    if (isTransactionInProgressRef.current) {
      tradingLogger.warn('Transaction already in progress (ref lock), ignoring click');
      return;
    }
    if (txStatus !== 'idle') {
      tradingLogger.warn('Transaction already in progress (state), ignoring click');
      return;
    }

    isTransactionInProgressRef.current = true;

    if (!address || !isConnected) {
      toast.error('Connect your wallet first');
      isTransactionInProgressRef.current = false;
      return;
    }

    if (!tokenInfo) {
      toast.error('Token info not loaded');
      isTransactionInProgressRef.current = false;
      return;
    }

    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      isTransactionInProgressRef.current = false;
      return;
    }

    // CRITICAL: Validate user has sufficient balance before trading
    if (tradeType === 'buy') {
      const xlmBalance = parseFloat(userXlmBalance);
      // Reserve 1 XLM for transaction fees and minimum balance
      const availableXlm = xlmBalance - 1;
      if (amount > availableXlm) {
        toast.error(`Insufficient XLM balance. You have ${xlmBalance.toFixed(2)} XLM (${availableXlm.toFixed(2)} available after reserves)`);
        playError();
        haptics.error();
        isTransactionInProgressRef.current = false;
        return;
      }
    } else {
      // Selling tokens - validate token balance
      const tokenBalanceHuman = parseFloat(userTokenBalance) / 10_000_000;
      if (amount > tokenBalanceHuman) {
        toast.error(`Insufficient ${tokenSymbol} balance. You have ${tokenBalanceHuman.toFixed(4)} ${tokenSymbol}`);
        playError();
        haptics.error();
        isTransactionInProgressRef.current = false;
        return;
      }
    }

    const expectedOutput = parseFloat(outputAmount);
    if (isNaN(expectedOutput) || expectedOutput <= 0) {
      toast.error('Unable to calculate output. Please try again.');
      isTransactionInProgressRef.current = false;
      return;
    }

    const minOutput = expectedOutput * (1 - slippage / 100);

    try {
      setTxStatus('preparing');
      haptics.mediumTap();

      const config = getNetworkConfig();
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();
      const deadline = getClientDeadline(300);

      // Setup trustline for buy
      if (tradeType === 'buy' && tokenInfo.issuer?.startsWith('G')) {
        const result = await ensureTrustlineExists(
          address,
          tokenInfo.symbol,
          tokenInfo.issuer,
          signTransaction
        );
        if (!result.success) {
          throw new Error(result.error || 'Failed to create trustline');
        }
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
        tradingLogger.error('Simulation error', simulated, { details: 'full simulation response' });
        throw new Error(errorMsg);
      }

      if (rpc.Api.isSimulationRestore(simulated)) {
        throw new Error('Transaction needs state restoration. Please try again.');
      }

      if (!rpc.Api.isSimulationSuccess(simulated)) {
        tradingLogger.error('Simulation failed', simulated);
        throw new Error('Transaction simulation failed');
      }

      const preparedTx = rpc.assembleTransaction(transaction, simulated).build();

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
          // SDK version incompatibility - verify via Horizon API instead of assuming success
          if (error.message?.includes('Bad union switch')) {
            tradingLogger.warn('SDK version incompatibility detected, verifying via Horizon API');
            try {
              const horizonUrl = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
                ? 'https://horizon.stellar.org'
                : 'https://horizon-testnet.stellar.org';
              const horizonResponse = await fetch(`${horizonUrl}/transactions/${sendResponse.hash}`);
              if (horizonResponse.ok) {
                const txData = await horizonResponse.json();
                if (txData.successful === true) {
                  success = true;
                  tradingLogger.info('Transaction verified successful via Horizon');
                  break;
                } else {
                  throw new Error('Transaction failed on chain');
                }
              }
              // If Horizon doesn't have it yet, continue polling
            } catch (horizonErr) {
              tradingLogger.warn('Horizon fallback check failed, continuing to poll');
            }
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

      if (tradeType === 'buy') {
        playBuy();
      } else {
        playSell();
      }
      if (amount >= 100) {
        setTimeout(() => playMilestone(), 300);
      }
      haptics.success();

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

      onTradeSuccess?.(tradeType, amount);

      setTimeout(() => {
        setTxStatus('idle');
        setInputAmount('');
        setOutputAmount('');
        loadTokenInfo();
        isTransactionInProgressRef.current = false;
      }, 2000);

    } catch (error) {
      setTxStatus('error');
      playError();
      haptics.error();

      const err = error as { message?: string };
      const errorMessage = parseContractError(err);
      console.error('Trade error:', error);
      toast.error(errorMessage);

      setTimeout(() => {
        setTxStatus('idle');
        isTransactionInProgressRef.current = false;
      }, 2000);
    }
  };

  const isProcessing = ['preparing', 'signing', 'submitting', 'confirming'].includes(txStatus);

  // Disabled state
  if (disabled) {
    return <DisabledTradingState />;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-white rounded-xl lg:rounded-2xl border border-ui-border shadow-lg overflow-hidden"
    >
      {/* Header */}
      <TradingHeader
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        tokenImage={tokenImage}
        currentPrice={currentPrice}
        priceFlash={priceFlash}
        priceChangePercent={priceChangePercent}
      />

      <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
        {/* User Balance Display */}
        <motion.div variants={itemVariants}>
          <UserBalanceDisplay
            userAddress={address}
            tokenAddress={tokenAddress}
            tokenSymbol={tokenSymbol}
            isConnected={isConnected}
            onTokenBalanceChange={setUserTokenBalance}
            onXlmBalanceChange={setUserXlmBalance}
          />
        </motion.div>

        {/* Quick Buy/Sell Buttons */}
        <motion.div variants={itemVariants}>
          {tradeType === 'buy' ? (
            <QuickBuyButtons
              selectedAmount={inputAmount}
              tradeType={tradeType}
              disabled={!isConnected || isProcessing}
              onSelect={handleQuickBuy}
              currentPrice={parseFloat(currentPrice)}
              tokenSymbol={tokenSymbol}
            />
          ) : (
            <QuickSellButtons
              tokenBalance={userTokenBalance}
              tokenSymbol={tokenSymbol}
              onSelect={(amount) => {
                playClick();
                haptics.lightTap();
                setInputAmount(amount);
              }}
              selectedAmount={inputAmount}
              disabled={!isConnected || isProcessing}
            />
          )}
        </motion.div>

        {/* Trade Type Tabs */}
        <motion.div variants={itemVariants} className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          {(['buy', 'sell'] as TradeType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                playClick();
                haptics.lightTap();
                setTradeType(type);
              }}
              disabled={isProcessing}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all min-h-[44px] ${
                tradeType === type
                  ? type === 'buy'
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'bg-purple-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } disabled:opacity-50`}
            >
              {type === 'buy' ? (
                <span className="flex items-center justify-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Buy
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <TrendingDown className="h-4 w-4" /> Sell
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* Input Amount */}
        <motion.div variants={itemVariants} className="space-y-2">
          <label className="text-sm font-medium text-ui-text-secondary">
            {tradeType === 'buy' ? 'You pay (XLM)' : `You sell (${tokenSymbol})`}
          </label>
          <div className="relative">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(sanitizeNumericInput(e.target.value))}
              placeholder="0.00"
              disabled={!isConnected || isProcessing}
              className="w-full p-4 pr-16 text-2xl font-bold bg-gray-50 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:opacity-50"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
              {tradeType === 'buy' ? 'XLM' : tokenSymbol}
            </span>
          </div>
        </motion.div>

        {/* Switch Button */}
        <div className="flex justify-center">
          <motion.button
            variants={buttonVariants}
            initial="idle"
            whileHover="hover"
            whileTap="tap"
            onClick={handleSwitchType}
            disabled={isProcessing}
            className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
            aria-label="Switch trade direction"
          >
            <ArrowDownUp className="h-5 w-5 text-gray-600" />
          </motion.button>
        </div>

        {/* Output Amount */}
        <motion.div variants={itemVariants} className="space-y-2">
          <label className="text-sm font-medium text-ui-text-secondary">
            {tradeType === 'buy' ? `You receive (${tokenSymbol})` : 'You get (XLM)'}
          </label>
          <div className="relative">
            <input
              type="text"
              value={isCalculating ? 'Calculating...' : outputAmount}
              readOnly
              className="w-full p-4 pr-16 text-2xl font-bold bg-gray-50 border border-ui-border rounded-xl cursor-not-allowed"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
              {tradeType === 'buy' ? tokenSymbol : 'XLM'}
            </span>
          </div>

          {/* Note: No price impact warning needed - bonding curve pricing is deterministic */}
        </motion.div>

        {/* Trade Protection Info - Bonding curve is deterministic */}
        <motion.div variants={itemVariants} className="text-xs text-gray-500 text-center py-1">
          Price is calculated instantly from bonding curve (no external liquidity)
        </motion.div>

        {/* Transaction Status */}
        <TransactionStatus status={txStatus} />

        {/* Trade Button */}
        <motion.button
          variants={buttonVariants}
          initial="idle"
          whileHover={!isProcessing && isConnected ? "hover" : "idle"}
          whileTap={!isProcessing && isConnected ? "tap" : "idle"}
          onClick={isConnected ? handleTrade : connect}
          disabled={isProcessing || (!isConnected && false)}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
            !isConnected
              ? 'bg-brand-primary text-white hover:bg-brand-primary/90'
              : tradeType === 'buy'
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
              : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:from-purple-600 hover:to-violet-600'
          } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
        >
          {!isConnected ? (
            <>
              <Wallet className="h-5 w-5" /> Connect Wallet
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Processing...
            </>
          ) : (
            <>
              <Zap className="h-5 w-5" />
              {tradeType === 'buy' ? 'Buy' : 'Sell'} {tokenSymbol}
            </>
          )}
        </motion.button>

        {/* Trade Info */}
        {tokenInfo && (
          <TradeInfoPanel
            tokenInfo={tokenInfo}
            tokenSymbol={tokenSymbol}
            outputAmount={outputAmount}
            slippage={slippage}
            tradeType={tradeType}
          />
        )}
      </div>
    </motion.div>
  );
}

export default TradingWidgetPremium;
