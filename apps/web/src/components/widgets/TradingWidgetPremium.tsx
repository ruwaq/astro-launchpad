/**
 * Premium Trading Widget
 *
 * Enhanced trading interface with:
 * - Quick-buy preset amounts (pump.fun style)
 * - Framer Motion animations
 * - Real-time price animations
 * - Haptic feedback on mobile
 * - Visual feedback for success/error states
 * - Support for both bonding curve AND AMM trading (graduated tokens)
 *
 * Trading Modes:
 * - Bonding: Pre-graduation tokens use deterministic bonding curve pricing
 * - AMM: Post-graduation tokens trade on constant product AMM (x*y=k)
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
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { tradingLogger } from '@/lib/logger';
import { emitBalanceRefresh } from '@/lib/events/balanceRefresh';
import { sacFactoryService, toStroopsBigInt, type TokenInfo, TokenStatus } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient, getClientDeadline } from '@/lib/stellar/client';
import { TransactionBuilder, rpc, Operation, nativeToScVal, Address } from '@stellar/stellar-sdk';
import { ensureTrustlineExists } from '@/lib/stellar/utils/trustline';
import { getNetworkConfig } from '@/lib/config/network';
import { CONTRACT_IDS } from '@/lib/stellar/config';
import { TRANSACTION_FEE_STROOPS } from '@/lib/constants/app';
import { stroopsToXlm, GRADUATION_THRESHOLD_XLM, addressToScVal } from '@/lib/stellar/utils';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useTradingSounds, useHaptics } from '@/hooks/useTradingSounds';
import { sanitizeNumericInput } from '@/lib/utils/format';
import { showGraduationToast } from '@/lib/notifications/graduationToast';

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

/**
 * Trading context for graduated tokens on AMM
 */
interface AmmTradingContext {
  ammPairAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

/**
 * Trading mode determines which protocol handles the swap
 */
type TradingMode = 'bonding' | 'amm' | 'disabled';

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
  // Slippage protection:
  // - Bonding curve: Fixed 0.5% (only for race conditions - price is deterministic)
  // - AMM: User-configurable (real slippage due to price impact)
  const [slippage, setSlippage] = useState(0.5);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [txStatus, setTxStatus] = useState<TransactionStatusType>('idle');
  const [previousPrice, setPreviousPrice] = useState<bigint>(BigInt(0));
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  // User's token balance for MAX/percentage sells (in stroops)
  const [userTokenBalance, setUserTokenBalance] = useState<string>('0');
  // User's XLM balance for buy validation (in XLM, not stroops)
  const [userXlmBalance, setUserXlmBalance] = useState<string>('0');

  // Trading mode state (bonding curve vs AMM)
  const [tradingMode, setTradingMode] = useState<TradingMode>('bonding');
  const [ammContext, setAmmContext] = useState<AmmTradingContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

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

  // Load token info and trading context (handles both bonding curve and AMM)
  const loadTradingContext = useCallback(async () => {
    try {
      setIsLoadingContext(true);

      // Get complete trading context (includes graduated status and AMM info)
      const context = await sacFactoryService.getTradingContext(tokenAddress);

      if (!context.tokenInfo) {
        setTokenInfo(null);
        setTradingMode('disabled');
        setAmmContext(null);
        return;
      }

      // Handle price flash animation
      if (tokenInfo && context.tokenInfo) {
        const oldPrice = calculatePriceFromReserves(tokenInfo.bonding_curve);
        const newPrice = calculatePriceFromReserves(context.tokenInfo.bonding_curve);

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

      setTokenInfo(context.tokenInfo);
      setTradingMode(context.tradingMode);

      // Setup AMM context if token is graduated
      if (context.tradingMode === 'amm' && context.ammPairInfo && context.ammPairAddress) {
        setAmmContext({
          ammPairAddress: context.ammPairAddress,
          token0: context.ammPairInfo.token0,
          token1: context.ammPairInfo.token1,
          reserve0: context.ammPairInfo.reserve0,
          reserve1: context.ammPairInfo.reserve1,
          totalSupply: context.ammPairInfo.totalSupply,
        });

        // For AMM, default slippage should be higher (1% default)
        if (slippage === 0.5) {
          setSlippage(1.0);
        }

        tradingLogger.info('Token graduated - trading on AMM', {
          tokenAddress,
          ammPairAddress: context.ammPairAddress,
          reserves: {
            reserve0: context.ammPairInfo.reserve0.toString(),
            reserve1: context.ammPairInfo.reserve1.toString(),
          },
        });
      } else {
        setAmmContext(null);
      }
    } catch (error) {
      tradingLogger.error('Error loading trading context:', error);
      setTokenInfo(null);
      setTradingMode('disabled');
      setAmmContext(null);
    } finally {
      setIsLoadingContext(false);
    }
  }, [tokenAddress, tokenInfo, slippage]);

  // Legacy alias for compatibility
  const loadTokenInfo = loadTradingContext;

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

  // Calculate output based on trading mode (bonding curve or AMM)
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

      if (tradingMode === 'amm' && ammContext) {
        // AMM trading (graduated tokens)
        const amountInStroops = toStroopsBigInt(amount);

        // Determine which reserve is which based on token direction
        // XLM SAC address for comparison
        const xlmSac = CONTRACT_IDS.xlmSacAddress;

        if (tradeType === 'buy') {
          // Buying tokens with XLM: XLM is input, token is output
          const isToken0Xlm = ammContext.token0 === xlmSac;
          const reserveIn = isToken0Xlm ? ammContext.reserve0 : ammContext.reserve1;
          const reserveOut = isToken0Xlm ? ammContext.reserve1 : ammContext.reserve0;

          output = sacFactoryService.calculateAmmSwapOutput(
            amountInStroops,
            reserveIn,
            reserveOut
          );
        } else {
          // Selling tokens for XLM: token is input, XLM is output
          const isToken0Xlm = ammContext.token0 === xlmSac;
          const reserveIn = isToken0Xlm ? ammContext.reserve1 : ammContext.reserve0;
          const reserveOut = isToken0Xlm ? ammContext.reserve0 : ammContext.reserve1;

          output = sacFactoryService.calculateAmmSwapOutput(
            amountInStroops,
            reserveIn,
            reserveOut
          );
        }

        // AMM fee is already included in calculateAmmSwapOutput (0.3%)
        const outputHuman = Number(output) / 10_000_000;
        setOutputAmount(outputHuman.toFixed(4));
      } else {
        // Bonding curve trading (pre-graduation)
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
      }
    } catch (error) {
      tradingLogger.error('Error calculating output:', error);
      setOutputAmount('0');
    } finally {
      setIsCalculating(false);
    }
  }, [inputAmount, tradeType, tokenInfo, tradingMode, ammContext]);

  useEffect(() => {
    const timer = setTimeout(calculateOutput, 300);
    return () => clearTimeout(timer);
  }, [calculateOutput]);

  // Format price display (different for AMM vs bonding curve)
  const currentPrice = useMemo(() => {
    if (!tokenInfo) return '0.0000000';

    if (tradingMode === 'amm' && ammContext) {
      // AMM price: XLM reserve / token reserve
      const xlmSac = CONTRACT_IDS.xlmSacAddress;
      const xlmReserve = ammContext.token0 === xlmSac ? ammContext.reserve0 : ammContext.reserve1;
      const tokenReserve = ammContext.token0 === xlmSac ? ammContext.reserve1 : ammContext.reserve0;

      if (tokenReserve === 0n) return '0.0000000';
      const price = Number(xlmReserve) / Number(tokenReserve);
      return price.toFixed(7);
    }

    // Bonding curve price
    const price = calculatePriceFromReserves(tokenInfo.bonding_curve);
    return (Number(price) / 10_000_000).toFixed(7);
  }, [tokenInfo, tradingMode, ammContext]);

  const priceChangePercent = useMemo(() => {
    if (!tokenInfo || previousPrice === BigInt(0)) return 0;
    const current = Number(calculatePriceFromReserves(tokenInfo.bonding_curve));
    const previous = Number(previousPrice);
    return ((current - previous) / previous) * 100;
  }, [tokenInfo, previousPrice]);

  // Calculate remaining XLM until graduation
  const graduationInfo = useMemo(() => {
    if (!tokenInfo) return { remaining: 0, isNearGraduation: false, wouldTriggerGraduation: false };

    const xlmRaised = parseFloat(stroopsToXlm(tokenInfo.xlm_raised));
    const remaining = Math.max(GRADUATION_THRESHOLD_XLM - xlmRaised, 0);
    const isNearGraduation = remaining < GRADUATION_THRESHOLD_XLM * 0.1; // Less than 10% remaining
    const buyAmount = tradeType === 'buy' ? parseFloat(inputAmount || '0') : 0;
    const wouldTriggerGraduation = buyAmount > 0 && buyAmount >= remaining;

    return { remaining, isNearGraduation, wouldTriggerGraduation };
  }, [tokenInfo, inputAmount, tradeType]);

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

      // Build operation based on trading mode
      let operation;

      if (tradingMode === 'amm' && ammContext) {
        // AMM swap for graduated tokens
        const xlmSac = CONTRACT_IDS.xlmSacAddress;
        const amountInStroops = toStroopsBigInt(amount);
        const minAmountOutStroops = toStroopsBigInt(minOutput);

        if (tradeType === 'buy') {
          // Buying tokens with XLM
          operation = sacFactoryService.buildAmmSwapOperation(
            ammContext.ammPairAddress,
            address,
            amountInStroops,
            minAmountOutStroops,
            xlmSac, // Input token is XLM
            deadline
          );
        } else {
          // Selling tokens for XLM
          operation = sacFactoryService.buildAmmSwapOperation(
            ammContext.ammPairAddress,
            address,
            amountInStroops,
            minAmountOutStroops,
            tokenAddress, // Input token is the launched token
            deadline
          );
        }

        tradingLogger.info('Built AMM swap operation', {
          ammPair: ammContext.ammPairAddress,
          tradeType,
          amountIn: amountInStroops.toString(),
          minAmountOut: minAmountOutStroops.toString(),
        });
      } else {
        // Bonding curve trade for pre-graduation tokens
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
      }

      // Build transaction
      const account = await server.getAccount(address);
      const txBuilder = new TransactionBuilder(account, {
        fee: TRANSACTION_FEE_STROOPS,
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
              const horizonUrl = getNetworkConfig().horizonUrl;
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

      // Trigger balance refresh across all components immediately
      emitBalanceRefresh();

      // GRADUATION DETECTION: Check if this trade triggered graduation
      const wasPreGraduation = tradingMode === 'bonding';

      setTimeout(async () => {
        setTxStatus('idle');
        setInputAmount('');
        setOutputAmount('');

        // Reload token info to detect graduation
        await loadTokenInfo();

        // Note: After loadTokenInfo, tradingMode state will be updated, but this closure
        // still has the old value. We check wasPreGraduation (old state) and if ammContext
        // exists (which means graduation occurred during loadTokenInfo).
        if (wasPreGraduation && ammContext) {
          tradingLogger.info('Graduation detected after trade!', {
            tokenSymbol,
            ammPairAddress: ammContext.ammPairAddress,
          });

          // Play milestone sound for graduation
          playMilestone();

          // Show celebration graduation toast
          showGraduationToast({
            tokenSymbol,
            tokenName,
            ammPairAddress: ammContext.ammPairAddress,
            onCtaClick: () => {
              // Refresh the page to show AMM trading interface
              window.location.reload();
            },
          });
        }

        isTransactionInProgressRef.current = false;
      }, 2000);

    } catch (error) {
      setTxStatus('error');
      playError();
      haptics.error();

      const err = error as { message?: string };
      const errorMessage = parseContractError(err);
      tradingLogger.error('Trade error:', error);
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

      {/* Graduated Token Banner */}
      {tradingMode === 'amm' && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-3 lg:px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">
                Graduated to AMM
              </span>
            </div>
            <button
              onClick={() => loadTradingContext()}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              title="Refresh reserves"
            >
              <RefreshCcw className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
          <p className="text-xs text-white/80 mt-1">
            Trading on decentralized liquidity pool with 0.3% swap fee
          </p>
        </div>
      )}

      {/* Graduation Failed Warning Banner */}
      {tokenInfo?.status === TokenStatus.GraduationFailed && (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-3 lg:px-4 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-white" />
            <span className="text-sm font-medium text-white">
              Graduation Failed
            </span>
          </div>
          <p className="text-xs text-white/80 mt-1">
            Token graduation failed. Trading on bonding curve is still available.
            Contact the team for recovery assistance.
          </p>
        </div>
      )}

      {/* Loading Context Indicator */}
      {isLoadingContext && !tokenInfo && (
        <div className="px-3 lg:px-4 py-2 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading trading context...</span>
          </div>
        </div>
      )}

      <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
        {/* AMM Slippage Controls - Only show for AMM trading */}
        {tradingMode === 'amm' && (
          <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Slippage Tolerance</span>
              </div>
              <span className="text-sm font-bold text-amber-900">{slippage}%</span>
            </div>
            <div className="flex gap-2">
              {[0.5, 1, 2, 3].map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    playClick();
                    setSlippage(value);
                  }}
                  disabled={isProcessing}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                    slippage === value
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-amber-700 hover:bg-amber-100'
                  } disabled:opacity-50`}
                >
                  {value}%
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              AMM prices change with each trade. Higher slippage = more likely to succeed.
            </p>
          </motion.div>
        )}

        {/* AMM Liquidity Info */}
        {tradingMode === 'amm' && ammContext && (
          <motion.div variants={itemVariants} className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              Pool Liquidity
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">XLM Reserve</p>
                <p className="font-semibold">
                  {(Number(ammContext.token0 === CONTRACT_IDS.xlmSacAddress ? ammContext.reserve0 : ammContext.reserve1) / 10_000_000).toLocaleString()} XLM
                </p>
              </div>
              <div>
                <p className="text-gray-500">{tokenSymbol} Reserve</p>
                <p className="font-semibold">
                  {(Number(ammContext.token0 === CONTRACT_IDS.xlmSacAddress ? ammContext.reserve1 : ammContext.reserve0) / 10_000_000).toLocaleString()} {tokenSymbol}
                </p>
              </div>
            </div>
          </motion.div>
        )}

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
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-ui-text-secondary">
              {tradeType === 'buy' ? 'You pay (XLM)' : `You sell (${tokenSymbol})`}
            </label>
            {isConnected && (
              <button
                onClick={() => {
                  const maxAmount = tradeType === 'buy'
                    ? (parseFloat(userXlmBalance) * 0.95).toFixed(2) // Leave 5% for fees
                    : (parseFloat(stroopsToXlm(userTokenBalance))).toFixed(2);
                  setInputAmount(maxAmount);
                }}
                disabled={isProcessing}
                className="text-xs font-medium text-brand-primary hover:text-brand-hover active:text-brand-hover/80 disabled:opacity-50 transition-colors touch-manipulation"
                aria-label="Use maximum balance"
              >
                MAX ({tradeType === 'buy' ? `${userXlmBalance} XLM` : `${(parseFloat(stroopsToXlm(userTokenBalance))).toFixed(2)} ${tokenSymbol}`})
              </button>
            )}
          </div>
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

        {/* Graduation Warning - Only for bonding curve mode (not yet graduated) */}
        {tradingMode === 'bonding' && tradeType === 'buy' && graduationInfo.remaining > 0 && (
          <motion.div variants={itemVariants}>
            {graduationInfo.wouldTriggerGraduation ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      This purchase will trigger graduation!
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Only {graduationInfo.remaining.toFixed(2)} XLM needed to graduate.
                      Your purchase of {parseFloat(inputAmount).toFixed(2)} XLM exceeds this amount.
                      The token will move to the AMM after this trade.
                    </p>
                    <button
                      type="button"
                      onClick={() => setInputAmount(Math.max(graduationInfo.remaining - 1, 0.1).toFixed(2))}
                      className="mt-2 text-xs font-medium text-yellow-700 hover:text-yellow-800 underline"
                    >
                      Set to max: {Math.max(graduationInfo.remaining - 1, 0.1).toFixed(2)} XLM
                    </button>
                  </div>
                </div>
              </div>
            ) : graduationInfo.isNearGraduation ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-blue-700">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-sm">
                    <span className="font-medium">Almost graduated!</span>
                    {' '}Only {graduationInfo.remaining.toFixed(2)} XLM left
                  </p>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}

        {/* Trade Protection Info - Context-aware message */}
        <motion.div variants={itemVariants} className="text-xs text-gray-500 text-center py-1">
          {tradingMode === 'amm' ? (
            <>Price from AMM pool (x*y=k). Slippage: {slippage}%</>
          ) : (
            <>Price is calculated instantly from bonding curve (no external liquidity)</>
          )}
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
            inputAmount={inputAmount}
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
