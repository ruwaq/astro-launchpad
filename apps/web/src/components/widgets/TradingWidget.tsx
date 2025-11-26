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

import { useState, useEffect, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient } from '@/lib/stellar/client';
import { TransactionBuilder, SorobanRpc, Asset, Horizon, BASE_FEE, Operation } from '@stellar/stellar-sdk';
import { getNetworkConfig } from '@/lib/config/network';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useQuery, gql } from '@apollo/client';

import {
  TradeTypeTabs,
  AmountInput,
  SlippageSelector,
  TokenInfoCard,
  SwapButton,
  ConnectWalletAlert,
  TestnetTokenAlert,
  NoLiquidityAlert,
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
        total
        hasNextPage
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

  const ensureTrustline = async (
    userAddress: string,
    tokenSymbol: string,
    tokenIssuer: string
  ): Promise<boolean> => {
    const config = getNetworkConfig();
    const horizonServer = new Horizon.Server(config.horizonUrl);

    try {
      const account = await horizonServer.loadAccount(userAddress);
      const asset = new Asset(tokenSymbol, tokenIssuer);

      const hasTrustline = account.balances.some((balance: Horizon.HorizonApi.BalanceLine) => {
        if (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') {
          const assetBalance = balance as Horizon.HorizonApi.BalanceLineAsset;
          return assetBalance.asset_code === tokenSymbol && assetBalance.asset_issuer === tokenIssuer;
        }
        return false;
      });

      if (hasTrustline) return true;

      const trustlineTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: config.passphrase,
      })
        .addOperation(Operation.changeTrust({ asset }))
        .setTimeout(30)
        .build();

      const signedXDR = await signTransaction(trustlineTx.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);
      await horizonServer.submitTransaction(signedTx as Parameters<typeof horizonServer.submitTransaction>[0]);
      return true;
    } catch (error) {
      const err = error as { response?: { status?: number }; message?: string };
      if (err.response?.status === 404) {
        throw new Error('Your account is not funded. Please fund your account first.');
      }
      throw new Error(`Failed to create trustline: ${err.message}`);
    }
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
          const xlmAmountStroops = BigInt(Math.floor(inputAmount * 10_000_000));
          output = sacFactoryService.calculateBuyOutput(tokenInfo, xlmAmountStroops);
        } else {
          const tokenAmountSmallest = BigInt(Math.floor(inputAmount * 10_000_000));
          output = sacFactoryService.calculateSellOutput(tokenInfo, tokenAmountSmallest);
        }

        const outputAfterFee = sacFactoryService.applyTradingFee(output);
        const outputHuman = Number(outputAfterFee) / 10_000_000;

        setState((prev) => ({
          ...prev,
          outputAmount: outputHuman.toFixed(4),
          isCalculating: false,
        }));
      } else if (state.selectedToken?.isTestnet && state.selectedToken?.classicIssuer) {
        const simulatedPrice = getSimulatedPrice(state.selectedToken.symbol);
        const output =
          state.type === 'buy' ? inputAmount * simulatedPrice : inputAmount / simulatedPrice;

        setState((prev) => ({
          ...prev,
          outputAmount: output.toFixed(4),
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
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

        let operation;

        if (state.type === 'buy') {
          const xlmAmountStroops = BigInt(Math.floor(inputAmount * 10_000_000));
          const minTokens = BigInt(Math.floor(minOutput * 10_000_000));

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
          const tokenAmountSmallest = BigInt(Math.floor(inputAmount * 10_000_000));
          const minXlm = BigInt(Math.floor(minOutput * 10_000_000));

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

        if (!simulated || 'error' in simulated) {
          throw new Error('Simulation failed');
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

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#10b981', '#8b5cf6', '#f59e0b'],
      });

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

  const platformTokens = (tokensData?.tokens?.edges || []).map(
    (edge: { node: TokenOption }) => edge.node
  );
  const allTokens: TokenOption[] = [...TESTNET_TOKENS, ...platformTokens];

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm">
      <div className="p-4 border-b border-ui-border">
        <h3 className="font-bold text-ui-text-primary">Swap</h3>
        <p className="text-sm text-ui-text-secondary">Trade tokens on bonding curve</p>
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
      </div>
    </div>
  );
}
