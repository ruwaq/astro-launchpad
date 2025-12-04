/**
 * Trading Widget for Dashboard
 *
 * Professional swap interface with:
 * - Token selector (dropdown of available tokens)
 * - Real-time price calculations from bonding curve
 * - Buy/Sell tabs
 * - Slippage protection
 * - Transaction monitoring
 * - Real Stellar testnet transactions
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, toStroopsBigInt, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient, getClientDeadline } from '@/lib/stellar/client';
import { TransactionBuilder, SorobanRpc } from '@stellar/stellar-sdk';
import { ensureTrustlineExists } from '@/lib/stellar/utils/trustline';
import { getNetworkConfig } from '@/lib/config/network';
import toast from 'react-hot-toast';
import { useQuery, gql } from '@apollo/client';

// PERFORMANCE: Dynamic import for confetti - only loaded on successful trade
const triggerConfetti = () => {
  import('canvas-confetti').then((confettiModule) => {
    confettiModule.default({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#10b981', '#8b5cf6', '#f59e0b'],
    });
  });
};

import {
  TradeTypeTabs,
  AmountInput,
  SlippageSelector,
  TokenInfoCard,
  SwapButton,
  PriceImpactWarning,
  ConnectWalletAlert,
  TestnetTokenAlert,
  NoLiquidityAlert,
  GraduationProgress,
  TESTNET_TOKENS,
  SIMULATED_PRICES,
  DEFAULT_SIMULATED_PRICE,
  type TradeState,
  type TokenOption,
} from './trading';

const GET_TOKENS_QUERY = gql`
  query GetTokens($limit: Int!, $orderBy: TokenOrderBy!) {
    tokens(limit: $limit, orderBy: $orderBy) {
      edges {
        cursor
        node {
          address
          name
          symbol
          imageUrl
          logoUrl
          currentPrice
          priceChange24h
          volume24h
          marketCap
          circulatingSupply
          xlmReserve
          graduated
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
      totalCount
    }
  }
`;

export function TradingWidget() {
  const { address, isConnected, connect, signTransaction } = useWallet();

  const { data: tokensData, loading: tokensLoading } = useQuery(GET_TOKENS_QUERY, {
    variables: {
      limit: 50,
      orderBy: 'VOLUME_DESC',
    },
    pollInterval: 30000,
  });

  const [state, setState] = useState<TradeState>({
    type: 'buy',
    inputAmount: '',
    outputAmount: '',
    selectedToken: null,
    isCalculating: false,
    isProcessing: false,
    slippage: 1,
  });

  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  const getSimulatedPrice = useCallback((symbol: string): number => {
    return SIMULATED_PRICES[symbol] || DEFAULT_SIMULATED_PRICE;
  }, []);

  // REFACTORED: Use centralized trustline utility to avoid code duplication
  const ensureTrustline = async (
    userAddress: string,
    tokenSymbol: string,
    tokenIssuer: string
  ): Promise<boolean> => {
    const result = await ensureTrustlineExists(
      userAddress,
      tokenSymbol,
      tokenIssuer,
      signTransaction
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to create trustline');
    }
    return true;
  };

  const loadTokenInfo = useCallback(async (tokenAddress: string) => {
    try {
      const info = await sacFactoryService.getTokenInfo(tokenAddress);
      setTokenInfo(info || null);
    } catch {
      setTokenInfo(null);
    }
  }, []);

  useEffect(() => {
    if (state.selectedToken?.address) {
      loadTokenInfo(state.selectedToken.address);
    }
  }, [state.selectedToken, loadTokenInfo]);

  const calculateOutput = useCallback(async () => {
    if (!state.inputAmount || parseFloat(state.inputAmount) <= 0) return;

    setState((prev) => ({ ...prev, isCalculating: true }));

    try {
      const inputAmount = parseFloat(state.inputAmount);

      if (tokenInfo) {
        let output: bigint;

        if (state.type === 'buy') {
          // SAFE: Use string-based conversion to avoid floating-point precision loss
          const xlmAmountStroops = toStroopsBigInt(inputAmount);
          output = sacFactoryService.calculateBuyOutput(tokenInfo, xlmAmountStroops);
        } else {
          // SAFE: Use string-based conversion to avoid floating-point precision loss
          const tokenAmountSmallest = toStroopsBigInt(inputAmount);
          output = sacFactoryService.calculateSellOutput(tokenInfo, tokenAmountSmallest);
        }

        const outputAfterFee = sacFactoryService.applyTradingFee(output);
        const outputHuman = Number(outputAfterFee) / 10_000_000;

        // SAFETY: Validate output is a valid number before displaying
        const outputStr = Number.isFinite(outputHuman) && outputHuman >= 0
          ? outputHuman.toFixed(4)
          : '0';

        setState((prev) => ({
          ...prev,
          outputAmount: outputStr,
          isCalculating: false,
        }));
      } else if (state.selectedToken?.isTestnet && state.selectedToken?.classicIssuer) {
        const simulatedPrice = getSimulatedPrice(state.selectedToken.symbol);
        const output =
          state.type === 'buy' ? inputAmount * simulatedPrice : inputAmount / simulatedPrice;

        // SAFETY: Validate output is a valid number before displaying
        const outputStr = Number.isFinite(output) && output >= 0
          ? output.toFixed(4)
          : '0';

        setState((prev) => ({
          ...prev,
          outputAmount: outputStr,
          isCalculating: false,
        }));
      } else {
        setState((prev) => ({ ...prev, outputAmount: '0', isCalculating: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, outputAmount: '0', isCalculating: false }));
    }
  }, [state.inputAmount, state.type, state.selectedToken, tokenInfo, getSimulatedPrice]);

  useEffect(() => {
    if (state.inputAmount && parseFloat(state.inputAmount) > 0 && state.selectedToken) {
      if (tokenInfo || (state.selectedToken?.isTestnet && state.selectedToken?.classicIssuer)) {
        calculateOutput();
      } else {
        setState((prev) => ({ ...prev, outputAmount: '' }));
      }
    } else {
      setState((prev) => ({ ...prev, outputAmount: '' }));
    }
  }, [state.inputAmount, state.type, tokenInfo, state.selectedToken, calculateOutput]);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected!');
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to connect wallet');
    }
  };

  const handleSelectToken = (token: TokenOption) => {
    setState((prev) => ({ ...prev, selectedToken: token, inputAmount: '', outputAmount: '' }));
    setShowTokenSelector(false);
  };

  const handleSwitch = () => {
    setState((prev) => ({
      ...prev,
      type: prev.type === 'buy' ? 'sell' : 'buy',
      inputAmount: prev.outputAmount,
      outputAmount: prev.inputAmount,
    }));
  };

  const handleTrade = async () => {
    // RACE CONDITION FIX: Prevent double-clicks and concurrent transactions
    // This prevents sequence number conflicts on Stellar
    if (state.isProcessing) {
      console.warn('[TradingWidget] Transaction already in progress, ignoring click');
      return;
    }

    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!state.selectedToken) {
      toast.error('Please select a token');
      return;
    }

    if (!state.inputAmount || parseFloat(state.inputAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Set processing state IMMEDIATELY to prevent race conditions
    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      const config = getNetworkConfig();
      const inputAmount = parseFloat(state.inputAmount);
      const outputAmount = parseFloat(state.outputAmount);
      const minOutput = outputAmount * (1 - state.slippage / 100);

      let loadingToast = '';

      if (tokenInfo) {
        const soroban = stellarClient.getSoroban();
        const server = soroban.getServer();
        // SAFE: Use getClientDeadline for consistent deadline calculation
        const deadline = getClientDeadline(300);

        let operation;

        if (state.type === 'buy') {
          // SAFE: Use string-based conversion to avoid floating-point precision loss
          const xlmAmountStroops = toStroopsBigInt(inputAmount);
          const minTokens = toStroopsBigInt(minOutput);

          if (tokenInfo?.issuer && tokenInfo.issuer.startsWith('G')) {
            loadingToast = toast.loading('Setting up trustline for token...');
            await ensureTrustline(address, tokenInfo.symbol, tokenInfo.issuer);
            toast.loading('Trustline ready. Preparing swap...', { id: loadingToast });
          }

          operation = sacFactoryService.buildBuyOperation(
            address,
            state.selectedToken.address,
            xlmAmountStroops,
            minTokens,
            deadline
          );
        } else {
          // SAFE: Use string-based conversion to avoid floating-point precision loss
          const tokenAmountSmallest = toStroopsBigInt(inputAmount);
          const minXlm = toStroopsBigInt(minOutput);

          operation = sacFactoryService.buildSellOperation(
            address,
            state.selectedToken.address,
            tokenAmountSmallest,
            minXlm,
            deadline
          );
        }

        const account = await server.getAccount(address);
        const txBuilder = new TransactionBuilder(account, {
          fee: '1000000',
          networkPassphrase: config.passphrase,
        });

        const transaction = txBuilder
          .addOperation(operation as Parameters<typeof txBuilder.addOperation>[0])
          .setTimeout(30)
          .build();

        if (!loadingToast) {
          loadingToast = toast.loading('Simulating bonding curve swap...');
        } else {
          toast.loading('Simulating bonding curve swap...', { id: loadingToast });
        }

        const simulated = await server.simulateTransaction(transaction);

        // Enhanced error handling for simulation failures
        if (!simulated) {
          throw new Error('Simulation returned empty response. Network may be congested.');
        }

        if (SorobanRpc.Api.isSimulationError(simulated)) {
          // Extract meaningful error message from simulation
          const errorMsg = simulated.error || 'Unknown simulation error';

          // Provide user-friendly error messages for common failures
          // Use case-insensitive matching for contract error strings
          const errorLower = errorMsg.toLowerCase();

          // MAX HOLDINGS ERROR
          if (errorLower.includes('max') && errorLower.includes('holdings')) {
            throw new Error('You\'ve reached the maximum token holdings (50%). This limit helps maintain fair distribution.');
          }

          // WHALE TAX INFO (not an error, but informational)
          if (errorLower.includes('whale') || errorLower.includes('antiwhale')) {
            throw new Error('Large purchase detected. A small whale fee will be applied to help distribution.');
          }

          // INSUFFICIENT BALANCE
          if (errorLower.includes('insufficient') || errorLower.includes('balance')) {
            throw new Error('Insufficient balance. Please check your XLM balance.');
          }

          // SLIPPAGE
          if (errorLower.includes('slippage') || errorLower.includes('min_output') || errorLower.includes('slippageexceeded')) {
            throw new Error('Price moved too much. Try increasing slippage or reducing amount.');
          }

          // LIQUIDITY
          if (errorLower.includes('liquidity')) {
            throw new Error('Not enough liquidity in the pool for this trade size.');
          }

          // GRADUATED TOKEN
          if (errorLower.includes('graduated')) {
            throw new Error('This token has graduated to the DEX. Trade on AstroSwap instead!');
          }

          throw new Error(`Transaction failed: ${errorMsg}`);
        }

        const preparedTx = SorobanRpc.assembleTransaction(transaction, simulated).build();

        toast.loading('Please sign in your wallet...', { id: loadingToast });
        const signedXDR = await signTransaction(preparedTx.toXDR());
        const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);

        toast.loading('Submitting to network...', { id: loadingToast });
        const sendResponse = await server.sendTransaction(signedTx as Parameters<typeof server.sendTransaction>[0]);

        if (sendResponse.status === 'ERROR') {
          throw new Error('Transaction failed');
        }

        toast.loading('Waiting for confirmation...', { id: loadingToast });

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
            // Don't assume success on SDK errors - verify via Horizon
            if (error.message?.includes('Bad union switch')) {
              try {
                const horizonUrl = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
                  ? 'https://horizon.stellar.org'
                  : 'https://horizon-testnet.stellar.org';
                const horizonResponse = await fetch(`${horizonUrl}/transactions/${sendResponse.hash}`);
                if (horizonResponse.ok) {
                  const txData = await horizonResponse.json();
                  if (txData.successful === true) {
                    success = true;
                    break;
                  }
                }
              } catch {
                // Continue polling if Horizon check fails
              }
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        }

        if (!success) {
          throw new Error('Transaction timeout');
        }

        toast.dismiss(loadingToast);
      } else if (state.selectedToken?.isTestnet && state.selectedToken?.classicIssuer) {
        toast.error('External token swaps coming soon! Use bonding curve tokens for now.');
        setState((prev) => ({ ...prev, isProcessing: false }));
        return;
      } else {
        throw new Error('Invalid token configuration');
      }

      toast.success(
        `Successfully ${state.type === 'buy' ? 'bought' : 'sold'} ${state.selectedToken.symbol}!`
      );

      // PERFORMANCE: Confetti loaded dynamically only on success
      triggerConfetti();

      setState((prev) => ({
        ...prev,
        inputAmount: '',
        outputAmount: '',
        isProcessing: false,
      }));

      if (state.selectedToken) {
        loadTokenInfo(state.selectedToken.address);
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || `Failed to ${state.type}`);
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  // PERFORMANCE: Memoize token list to prevent unnecessary re-renders
  const allTokens = useMemo<TokenOption[]>(() => {
    const platformTokens = (tokensData?.tokens?.edges || []).map(
      (edge: { node: TokenOption }) => edge.node
    );
    return [...TESTNET_TOKENS, ...platformTokens];
  }, [tokensData?.tokens?.edges]);

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm">
      <div className="p-4 border-b border-ui-border">
        <h3 className="font-bold text-ui-text-primary">Trade</h3>
        <p className="text-sm text-ui-text-secondary">Buy & sell tokens on bonding curve</p>
      </div>

      <div className="p-4 space-y-4">
        {!isConnected && <ConnectWalletAlert onConnect={handleConnect} />}

        {state.selectedToken?.isTestnet &&
          !tokenInfo &&
          state.selectedToken?.classicIssuer && (
            <TestnetTokenAlert
              token={state.selectedToken}
              simulatedPrice={getSimulatedPrice(state.selectedToken.symbol)}
            />
          )}

        {state.selectedToken?.isTestnet &&
          !tokenInfo &&
          !state.selectedToken?.classicIssuer && <NoLiquidityAlert />}

        <TradeTypeTabs
          tradeType={state.type}
          onChange={(type) => setState((prev) => ({ ...prev, type }))}
        />

        <AmountInput
          label={state.type === 'buy' ? 'You pay' : 'You sell'}
          value={state.inputAmount}
          onChange={(value) => setState((prev) => ({ ...prev, inputAmount: value }))}
          disabled={!isConnected || state.isProcessing}
          tradeType={state.type}
          selectedToken={state.selectedToken}
          tokens={allTokens}
          tokensLoading={tokensLoading}
          showTokenSelector={false}
          onToggleSelector={() => {}}
          onSelectToken={handleSelectToken}
          displayMode="input"
          showQuickAmounts
          onQuickAmount={(amount) =>
            setState((prev) => ({ ...prev, inputAmount: amount.toString() }))
          }
        />

        <div className="flex justify-center">
          <button
            onClick={handleSwitch}
            disabled={!isConnected || state.isProcessing}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <ArrowDown className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        <AmountInput
          label={state.type === 'buy' ? 'You receive' : 'You get'}
          value={state.outputAmount}
          readOnly
          isCalculating={state.isCalculating}
          disabled={!isConnected || state.isProcessing}
          tradeType={state.type}
          selectedToken={state.selectedToken}
          tokens={allTokens}
          tokensLoading={tokensLoading}
          showTokenSelector={showTokenSelector}
          onToggleSelector={() => setShowTokenSelector(!showTokenSelector)}
          onSelectToken={handleSelectToken}
          displayMode="output"
        />

        <SlippageSelector
          value={state.slippage}
          onChange={(slippage) => setState((prev) => ({ ...prev, slippage }))}
          disabled={!isConnected || state.isProcessing}
        />

        {/* Price Impact Warning */}
        {tokenInfo && state.inputAmount && state.outputAmount && tokenInfo.bonding_curve && (
          <PriceImpactWarning
            inputAmount={state.inputAmount}
            outputAmount={state.outputAmount}
            xlmReserve={tokenInfo.bonding_curve.xlm_reserve}
            tokenReserve={tokenInfo.bonding_curve.token_reserve}
            tradeType={state.type}
          />
        )}

        <SwapButton
          onClick={handleTrade}
          isConnected={isConnected}
          isProcessing={state.isProcessing}
          selectedToken={state.selectedToken}
          inputAmount={state.inputAmount}
          hasTokenInfo={!!tokenInfo}
          tradeType={state.type}
        />

        {state.selectedToken && tokenInfo && (
          <TokenInfoCard selectedToken={state.selectedToken} tokenInfo={tokenInfo} />
        )}

        {/* Graduation Progress - Show bonding curve progress */}
        {tokenInfo && (
          <GraduationProgress
            xlmRaised={tokenInfo.xlm_raised}
            isGraduated={tokenInfo.status === 'Graduated'}
            className="mt-4"
          />
        )}
      </div>
    </div>
  );
}
