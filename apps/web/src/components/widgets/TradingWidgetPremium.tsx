/**
 * Premium Trading Widget
 *
 * Enhanced trading interface with:
 * - Quick-buy preset amounts (pump.fun style)
 * - Sound effects on transactions
 * - Framer Motion animations
 * - Real-time price animations
 * - Haptic feedback on mobile
 * - Visual feedback for success/error states
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownUp,
  Zap,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wallet,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient } from '@/lib/stellar/client';
import { stroopsToXlm, formatCompactNumber } from '@/lib/stellar/utils';
import { TransactionBuilder, SorobanRpc } from '@stellar/stellar-sdk';
import { ensureTrustlineExists } from '@/lib/stellar/utils/trustline';
import { getNetworkConfig } from '@/lib/config/network';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useTradingSounds, useHaptics } from '@/hooks/useTradingSounds';

// Quick buy amounts in XLM
const QUICK_BUY_AMOUNTS = [10, 50, 100, 500, 1000];

// Contract error codes mapping (from sac-factory/src/errors.rs)
const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: 'Contract already initialized',
  2: 'Contract not initialized',
  10: 'Unauthorized action',
  11: 'Not an admin',
  20: 'Invalid token name',
  21: 'Invalid token symbol',
  22: 'Invalid amount',
  30: 'Token not found',
  31: 'Token already graduated',
  32: 'Insufficient liquidity',
  40: 'Slippage exceeded - price changed too much',
  41: 'Insufficient balance',
  50: 'Math overflow',
  51: 'Math underflow',
  52: 'Division by zero',
  70: 'Contract is paused',
  80: 'Insufficient fee',
  100: 'Transaction expired',
  101: 'Transfer failed',
  140: 'Anti-whale: max buy amount exceeded (try a smaller amount)',
  141: 'Anti-whale: max holdings exceeded (you cannot hold more than 50% of supply)',
  // Note: Error 142 (cooldown) is no longer applicable as cooldown is now 0 seconds
};

// Parse contract error from error message/code
function parseContractError(error: { message?: string } | string): string {
  const msg = typeof error === 'string' ? error : (error?.message || '');

  // Try to extract error code from message like "Error(Contract, #141)"
  const errorMatch = msg.match(/#(\d+)/);
  if (errorMatch) {
    const code = parseInt(errorMatch[1], 10);
    if (CONTRACT_ERROR_MESSAGES[code]) {
      return CONTRACT_ERROR_MESSAGES[code];
    }
    return `Contract error #${code}`;
  }

  // Check for common error patterns
  if (msg.includes('InsufficientBalance') || msg.includes('insufficient')) {
    return 'Insufficient balance';
  }
  if (msg.includes('rejected') || msg.includes('cancelled')) {
    return 'Transaction cancelled';
  }

  return msg || 'Transaction failed';
}

// Extract meaningful error from Soroban simulation response
function extractSimulationError(simulated: SorobanRpc.Api.SimulateTransactionResponse): string {
  // Check for error field (string or object)
  if ('error' in simulated && simulated.error) {
    const error = simulated.error;

    // If it's a string, parse it directly
    if (typeof error === 'string') {
      return parseContractError(error);
    }

    // If it's an object, try to extract error info
    if (typeof error === 'object') {
      // Check for nested error message
      const errObj = error as Record<string, unknown>;
      if (errObj.message && typeof errObj.message === 'string') {
        return parseContractError(errObj.message);
      }
      if (errObj.code && typeof errObj.code === 'number') {
        if (CONTRACT_ERROR_MESSAGES[errObj.code]) {
          return CONTRACT_ERROR_MESSAGES[errObj.code];
        }
        return `Contract error #${errObj.code}`;
      }
      // Try to stringify and parse
      const errorStr = JSON.stringify(error);
      if (errorStr && errorStr !== '{}') {
        return parseContractError(errorStr);
      }
    }
  }

  // Check for simulation error response type
  if (SorobanRpc.Api.isSimulationError(simulated)) {
    return parseContractError(simulated.error || 'Simulation failed');
  }

  // Check results array for errors
  const results = (simulated as { results?: Array<{ error?: string }> }).results;
  if (results && Array.isArray(results) && results[0]?.error) {
    return parseContractError(results[0].error);
  }

  return 'Transaction simulation failed - please try again';
}

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

const priceFlashVariants = {
  flash: {
    backgroundColor: ['rgba(34, 197, 94, 0.3)', 'transparent'],
    transition: { duration: 0.5 },
  },
};

interface TradingWidgetPremiumProps {
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenImage?: string;
  disabled?: boolean;
  onTradeSuccess?: (type: 'buy' | 'sell', amount: number) => void;
}

type TradeType = 'buy' | 'sell';
type TransactionStatus = 'idle' | 'preparing' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error';

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
  const [slippage, setSlippage] = useState(1);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [previousPrice, setPreviousPrice] = useState<bigint>(BigInt(0));
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const [trackedHoldings, setTrackedHoldings] = useState<bigint>(BigInt(0));
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Helper to calculate price from reserves
  const calculatePriceFromReserves = (bc: { xlm_reserve: string; token_reserve: string }): bigint => {
    const xlm = BigInt(bc.xlm_reserve);
    const token = BigInt(bc.token_reserve);
    if (token === BigInt(0)) return BigInt(0);
    // Price = xlm_reserve / token_reserve (in stroops)
    return (xlm * BigInt(10_000_000)) / token;
  };

  // Load token info and tracked holdings
  const loadTokenInfo = useCallback(async () => {
    try {
      const info = await sacFactoryService.getTokenInfo(tokenAddress);

      if (info && tokenInfo) {
        // Detect price change for animation
        const oldPrice = calculatePriceFromReserves(tokenInfo.bonding_curve);
        const newPrice = calculatePriceFromReserves(info.bonding_curve);

        if (newPrice > oldPrice) {
          setPriceFlash('up');
          setTimeout(() => setPriceFlash(null), 500);
        } else if (newPrice < oldPrice) {
          setPriceFlash('down');
          setTimeout(() => setPriceFlash(null), 500);
        }

        setPreviousPrice(oldPrice);
      }

      setTokenInfo(info || null);

      // Load tracked holdings for the connected wallet
      if (address) {
        try {
          const holdings = await sacFactoryService.getWalletTrackedHoldings(address);
          setTrackedHoldings(holdings);
        } catch {
          setTrackedHoldings(BigInt(0));
        }
      }
    } catch {
      setTokenInfo(null);
    }
  }, [tokenAddress, tokenInfo, address]);

  useEffect(() => {
    loadTokenInfo();
    // PERFORMANCE: Reduced from 5s to 30s - price refreshes on user action anyway
    const interval = setInterval(loadTokenInfo, 30000);
    return () => clearInterval(interval);
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
        const xlmStroops = BigInt(Math.floor(amount * 10_000_000));
        output = sacFactoryService.calculateBuyOutput(tokenInfo, xlmStroops);
      } else {
        const tokenStroops = BigInt(Math.floor(amount * 10_000_000));
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
    if (soundEnabled) playClick();
    haptics.lightTap();
    setTradeType('buy');
    setInputAmount(amount.toString());
  };

  // Handle trade type switch
  const handleSwitchType = () => {
    if (soundEnabled) playClick();
    haptics.lightTap();
    setTradeType((prev) => (prev === 'buy' ? 'sell' : 'buy'));
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
  };

  // REFACTORED: Use centralized trustline utility to avoid code duplication
  const ensureTrustline = async (
    userAddress: string,
    symbol: string,
    issuer: string
  ): Promise<boolean> => {
    const result = await ensureTrustlineExists(
      userAddress,
      symbol,
      issuer,
      signTransaction
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to create trustline');
    }
    return true;
  };

  // Execute trade
  const handleTrade = async () => {
    if (!address || !isConnected) {
      toast.error('Connect your wallet first');
      return;
    }

    if (!tokenInfo) {
      toast.error('Token info not loaded');
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const expectedOutput = parseFloat(outputAmount);
    if (isNaN(expectedOutput) || expectedOutput <= 0) {
      toast.error('Unable to calculate output. Please try again.');
      return;
    }

    const minOutput = expectedOutput * (1 - slippage / 100);

    try {
      setTxStatus('preparing');
      haptics.mediumTap();

      const config = getNetworkConfig();
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      // Setup trustline for buy
      if (tradeType === 'buy' && tokenInfo.issuer?.startsWith('G')) {
        await ensureTrustline(address, tokenInfo.symbol, tokenInfo.issuer);
      }

      // Build operation
      let operation;
      if (tradeType === 'buy') {
        const xlmStroops = BigInt(Math.floor(amount * 10_000_000));
        const minTokens = BigInt(Math.floor(minOutput * 10_000_000));
        operation = sacFactoryService.buildBuyOperation(
          address,
          tokenAddress,
          xlmStroops,
          minTokens,
          deadline
        );
      } else {
        const tokenStroops = BigInt(Math.floor(amount * 10_000_000));
        const minXlm = BigInt(Math.floor(minOutput * 10_000_000));
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
        // Extract meaningful error message using our parser
        const errorMsg = extractSimulationError(simulated);
        console.error('Simulation error details:', JSON.stringify(simulated, null, 2));
        throw new Error(errorMsg);
      }

      // Check for restore needed (expired state)
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
          playBuy();
        } else {
          playSell();
        }

        // Milestone sound for large trades
        if (amount >= 100) {
          setTimeout(() => playMilestone(), 300);
        }
      }
      haptics.success();

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
      onTradeSuccess?.(tradeType, amount);

      // Reset
      setTimeout(() => {
        setTxStatus('idle');
        setInputAmount('');
        setOutputAmount('');
        loadTokenInfo();
      }, 2000);

    } catch (error) {
      setTxStatus('error');
      if (soundEnabled) playError();
      haptics.error();

      const err = error as { message?: string };
      const errorMessage = parseContractError(err);
      console.error('Trade error:', error);
      toast.error(errorMessage);

      setTimeout(() => setTxStatus('idle'), 2000);
    }
  };

  // Status messages
  const statusMessages: Record<TransactionStatus, string> = {
    idle: '',
    preparing: 'Preparing transaction...',
    signing: 'Please sign in wallet...',
    submitting: 'Submitting to network...',
    confirming: 'Waiting for confirmation...',
    success: 'Transaction successful!',
    error: 'Transaction failed',
  };

  const isProcessing = ['preparing', 'signing', 'submitting', 'confirming'].includes(txStatus);

  // Disabled state - show read-only message
  if (disabled) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-gray-100 rounded-2xl border border-ui-border shadow-sm overflow-hidden"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="font-bold text-ui-text-primary mb-2">
            Trading Disabled
          </h3>
          <p className="text-sm text-ui-text-secondary mb-4">
            This token is not available on the current Stellar contract.
            Trading functionality has been disabled.
          </p>
          <div className="text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
            <p className="font-medium mb-1">Why is this happening?</p>
            <ul className="text-left space-y-1">
              <li>The token may have been created with an old contract</li>
              <li>The contract may have been redeployed</li>
              <li>Database contains stale data</li>
            </ul>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-white rounded-2xl border border-ui-border shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-ui-border bg-gradient-to-r from-brand-primary/5 to-brand-blue/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tokenImage && (
              <img
                src={tokenImage}
                alt={tokenName}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <h3 className="font-bold text-ui-text-primary flex items-center gap-2">
                Trade {tokenSymbol}
                <Sparkles className="h-4 w-4 text-brand-primary" />
              </h3>
              <motion.div
                animate={priceFlash ? priceFlashVariants.flash : {}}
                className={`text-sm font-mono ${
                  priceFlash === 'up' ? 'text-green-600' :
                  priceFlash === 'down' ? 'text-red-600' :
                  'text-ui-text-secondary'
                }`}
              >
                {currentPrice} XLM
                {priceChangePercent !== 0 && (
                  <span className={`ml-2 ${priceChangePercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {priceChangePercent > 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                  </span>
                )}
              </motion.div>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="h-5 w-5 text-gray-500" />
            ) : (
              <VolumeX className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Buy Buttons */}
        <motion.div variants={itemVariants} className="space-y-2">
          <p className="text-xs font-medium text-ui-text-secondary uppercase tracking-wide">
            Quick Buy
          </p>
          <div className="grid grid-cols-5 gap-2">
            {QUICK_BUY_AMOUNTS.map((amount) => (
              <motion.button
                key={amount}
                variants={buttonVariants}
                initial="idle"
                whileHover="hover"
                whileTap="tap"
                onClick={() => handleQuickBuy(amount)}
                disabled={!isConnected || isProcessing}
                className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                  inputAmount === amount.toString() && tradeType === 'buy'
                    ? 'bg-brand-primary text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {amount >= 1000 ? `${amount / 1000}K` : amount}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Trade Type Tabs */}
        <motion.div variants={itemVariants} className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          {(['buy', 'sell'] as TradeType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                if (soundEnabled) playClick();
                haptics.lightTap();
                setTradeType(type);
              }}
              disabled={isProcessing}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
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
              onChange={(e) => setInputAmount(e.target.value)}
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
        </motion.div>

        {/* Slippage */}
        <motion.div variants={itemVariants} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ui-text-secondary">Slippage Tolerance</span>
            <span className="font-medium">{slippage}%</span>
          </div>
          <div className="flex gap-2">
            {[0.5, 1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => {
                  if (soundEnabled) playClick();
                  setSlippage(s);
                }}
                disabled={isProcessing}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  slippage === s
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {s}%
              </button>
            ))}
          </div>
        </motion.div>

        {/* Transaction Status */}
        <AnimatePresence mode="wait">
          {txStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`p-3 rounded-lg flex items-center gap-3 ${
                txStatus === 'success' ? 'bg-green-50 text-green-700' :
                txStatus === 'error' ? 'bg-red-50 text-red-700' :
                'bg-blue-50 text-blue-700'
              }`}
            >
              {isProcessing && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {txStatus === 'success' && <CheckCircle2 className="h-5 w-5" />}
              {txStatus === 'error' && <AlertCircle className="h-5 w-5" />}
              <span className="text-sm font-medium">{statusMessages[txStatus]}</span>
            </motion.div>
          )}
        </AnimatePresence>

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
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl text-sm"
          >
            <div>
              <p className="text-ui-text-secondary">Token Reserve</p>
              <p className="font-semibold">
                {formatCompactNumber(parseFloat(stroopsToXlm(tokenInfo.bonding_curve.token_reserve)))}
              </p>
            </div>
            <div>
              <p className="text-ui-text-secondary">XLM Raised</p>
              <p className="font-semibold">
                {formatCompactNumber(parseFloat(stroopsToXlm(tokenInfo.xlm_raised)))} XLM
              </p>
            </div>
            <div>
              <p className="text-ui-text-secondary">Fee</p>
              <p className="font-semibold">0.3% (0.05% + 0.25%)</p>
            </div>
            <div>
              <p className="text-ui-text-secondary">Min Output</p>
              <p className="font-semibold">
                {outputAmount ? (parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(4) : '0'}{' '}
                {tradeType === 'buy' ? tokenSymbol : 'XLM'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Debug Info - Anti-whale tracking */}
        {isConnected && tokenInfo && (
          <motion.div variants={itemVariants}>
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="w-full text-xs text-ui-text-secondary hover:text-ui-text-primary text-left py-1"
            >
              {showDebugInfo ? '▼ Hide debug info' : '▶ Show debug info (anti-whale)'}
            </button>
            <AnimatePresence>
              {showDebugInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mt-2"
                >
                  <p className="text-xs font-semibold text-yellow-800 mb-2">
                    Anti-Whale Debug Info
                  </p>
                  <div className="space-y-1 text-xs font-mono text-yellow-700">
                    <p>
                      <span className="text-yellow-600">Tracked Holdings:</span>{' '}
                      {formatCompactNumber(Number(trackedHoldings) / 10_000_000)} {tokenSymbol}
                    </p>
                    <p>
                      <span className="text-yellow-600">Max Allowed (50%):</span>{' '}
                      {formatCompactNumber(parseFloat(stroopsToXlm(tokenInfo.bonding_curve.token_reserve)) * 0.5)} {tokenSymbol}
                    </p>
                    <p>
                      <span className="text-yellow-600">Total Supply:</span>{' '}
                      {formatCompactNumber(parseFloat(stroopsToXlm(tokenInfo.bonding_curve.token_reserve)))} {tokenSymbol}
                    </p>
                    {Number(trackedHoldings) > 0 && (
                      <p className={`${
                        Number(trackedHoldings) / 10_000_000 > parseFloat(stroopsToXlm(tokenInfo.bonding_curve.token_reserve)) * 0.5
                          ? 'text-red-600 font-bold'
                          : 'text-green-600'
                      }`}>
                        Holding: {((Number(trackedHoldings) / 10_000_000) / parseFloat(stroopsToXlm(tokenInfo.bonding_curve.token_reserve)) * 100).toFixed(2)}% of supply
                      </p>
                    )}
                    {Number(trackedHoldings) > parseFloat(stroopsToXlm(tokenInfo.bonding_curve.token_reserve)) * 10_000_000 * 0.5 && (
                      <p className="text-red-600 mt-2">
                        ⚠️ Internal tracking may be desynchronized. Contact admin to reset.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default TradingWidgetPremium;
