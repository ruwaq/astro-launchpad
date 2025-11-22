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
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, type TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { stellarDEXService } from '@/lib/stellar/services/stellar-dex.service';
import { stellarClient } from '@/lib/stellar/client';
import { TransactionBuilder, SorobanRpc, Asset } from '@stellar/stellar-sdk';
import { getNetworkConfig } from '@/lib/config/network';
import {
  TrendingUp,
  TrendingDown,
  Info,
  Loader2,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useQuery, gql } from '@apollo/client';

// GraphQL query for tokens - uses proper backend schema format
const GET_TOKENS_QUERY = gql`
  query GetTokens($limit: Int!, $orderBy: TokenOrderBy!) {
    tokens(limit: $limit, orderBy: $orderBy) {
      edges {
        address
        name
        symbol
        imageUrl
        currentPrice
        priceChange24h
        volume24h
        marketCap
        circulatingSupply
        xlmReserve
        graduated
      }
      pageInfo {
        total
        hasNextPage
      }
    }
  }
`;

type TradeType = 'buy' | 'sell';

interface TradeState {
  type: TradeType;
  inputAmount: string;
  outputAmount: string;
  selectedToken: any | null;
  isCalculating: boolean;
  isProcessing: boolean;
  slippage: number;
}

// Popular Stellar Testnet Tokens for testing
// These are real Stellar Asset Contract (SAC) addresses on testnet
const TESTNET_TOKENS = [
  {
    address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA', // USDC SAC on testnet
    classicIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    name: 'USD Coin (Testnet)',
    symbol: 'USDC',
    imageUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    isTestnet: true,
    decimals: 7,
    description: 'Get testnet USDC from Circle Faucet',
  },
  {
    // Native XLM wrapped as SAC for testing
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    name: 'Native Stellar Lumens',
    symbol: 'XLM',
    imageUrl: 'https://stellar.org/favicon.ico',
    isTestnet: true,
    decimals: 7,
    description: 'Get testnet XLM from Stellar Friendbot',
  },
  {
    // Example custom testnet token
    address: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
    name: 'Testnet Token A',
    symbol: 'TTA',
    imageUrl: 'https://via.placeholder.com/32/3b82f6/ffffff?text=TTA',
    isTestnet: true,
    decimals: 7,
    description: 'Example testnet token for testing swaps',
  },
  {
    // Example custom testnet token
    address: 'CBGTG5WCUFKYTQGIOAOYUD7GZ4KXOYAIQX2ESMNKTVFHOXDS7G2Y7BOQ',
    name: 'Testnet Token B',
    symbol: 'TTB',
    imageUrl: 'https://via.placeholder.com/32/8b5cf6/ffffff?text=TTB',
    isTestnet: true,
    decimals: 7,
    description: 'Another testnet token for testing',
  },
];

export function TradingWidget() {
  const { address, isConnected, connect, signTransaction } = useWallet();

  // Fetch available tokens - ALL tokens from the platform (not filtered by user)
  const { data: tokensData, loading: tokensLoading } = useQuery(GET_TOKENS_QUERY, {
    variables: {
      limit: 50, // Get all tokens (not just from current user)
      orderBy: 'VOLUME_DESC' // Use enum value from backend schema
    },
    pollInterval: 30000, // Refresh every 30s
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
  const [tokenSearch, setTokenSearch] = useState('');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  // Load token info when selected
  useEffect(() => {
    if (state.selectedToken?.address) {
      loadTokenInfo(state.selectedToken.address);
    }
  }, [state.selectedToken]);

  // Calculate output when input changes
  useEffect(() => {
    if (state.inputAmount && parseFloat(state.inputAmount) > 0 && state.selectedToken) {
      // Calculate for bonding curve tokens OR testnet tokens
      if (tokenInfo || (state.selectedToken?.isTestnet && state.selectedToken?.classicIssuer)) {
        calculateOutput();
      } else {
        setState(prev => ({ ...prev, outputAmount: '' }));
      }
    } else {
      setState(prev => ({ ...prev, outputAmount: '' }));
    }
  }, [state.inputAmount, state.type, tokenInfo, state.selectedToken, calculateOutput]);

  const loadTokenInfo = async (tokenAddress: string) => {
    try {
      const info = await sacFactoryService.getTokenInfo(tokenAddress);
      if (!info) {
        // Token not found in SAC Factory (probably external testnet token)
        setTokenInfo(null);
        return;
      }
      setTokenInfo(info);
    } catch (error) {
      console.error('Error loading token info:', error);
      setTokenInfo(null);
      // Don't show error toast for external tokens
    }
  };

  // Simulated prices for testnet tokens (for demo purposes when no real liquidity exists)
  const getSimulatedPrice = (tokenSymbol: string): number => {
    const prices: Record<string, number> = {
      'USDC': 12.5,    // 1 XLM = 12.5 USDC (simulated testnet price)
      'EURC': 11.8,    // 1 XLM = 11.8 EURC
      'XLM': 1,        // 1 XLM = 1 XLM
      'TTA': 50,       // 1 XLM = 50 TTA
      'TTB': 25,       // 1 XLM = 25 TTB
      'AQUA': 100,     // 1 XLM = 100 AQUA
    };
    return prices[tokenSymbol] || 10; // Default: 1 XLM = 10 tokens
  };

  const calculateOutput = useCallback(async () => {
    if (!state.inputAmount || parseFloat(state.inputAmount) <= 0) return;

    setState(prev => ({ ...prev, isCalculating: true }));

    try {
      const inputAmount = parseFloat(state.inputAmount);

      // If token has bonding curve, use bonding curve calculation
      if (tokenInfo) {
        const xlmReserve = BigInt(tokenInfo.bonding_curve.xlm_reserve);
        const tokenReserve = BigInt(tokenInfo.bonding_curve.token_reserve);
        const k = BigInt(tokenInfo.bonding_curve.k);

        let output: bigint;

        if (state.type === 'buy') {
          // User inputs XLM, gets tokens
          const xlmAmountStroops = BigInt(Math.floor(inputAmount * 10_000_000));
          output = sacFactoryService.calculateBuyOutput(tokenInfo, xlmAmountStroops);
        } else {
          // User inputs tokens, gets XLM
          const tokenAmountSmallest = BigInt(Math.floor(inputAmount * 10_000_000));
          output = sacFactoryService.calculateSellOutput(tokenInfo, tokenAmountSmallest);
        }

        // Apply trading fee (1%)
        const outputAfterFee = sacFactoryService.applyTradingFee(output);

        // Convert to human-readable
        const outputHuman = Number(outputAfterFee) / 10_000_000;

        setState(prev => ({
          ...prev,
          outputAmount: outputHuman.toFixed(4),
          isCalculating: false,
        }));
      }
      // If external token (no bonding curve), use Stellar DEX or simulated price
      else if (state.selectedToken?.isTestnet && state.selectedToken?.classicIssuer) {
        const sourceAssetCode = state.type === 'buy' ? 'XLM' : state.selectedToken.symbol;
        const sourceIssuer = state.type === 'buy' ? undefined : state.selectedToken.classicIssuer;
        const destAssetCode = state.type === 'buy' ? state.selectedToken.symbol : 'XLM';
        const destIssuer = state.type === 'buy' ? state.selectedToken.classicIssuer : undefined;

        try {
          const result = await stellarDEXService.calculateSwapOutput(
            sourceAssetCode,
            sourceIssuer,
            inputAmount.toFixed(7),
            destAssetCode,
            destIssuer
          );

          // If we got a valid result, use it
          if (result.estimatedOutput && parseFloat(result.estimatedOutput) > 0) {
            setState(prev => ({
              ...prev,
              outputAmount: parseFloat(result.estimatedOutput).toFixed(4),
              isCalculating: false,
            }));
          } else {
            // No liquidity found - use simulated prices for demo
            const simulatedPrice = getSimulatedPrice(state.selectedToken.symbol);
            const output = state.type === 'buy'
              ? inputAmount * simulatedPrice  // XLM -> Token
              : inputAmount / simulatedPrice; // Token -> XLM

            setState(prev => ({
              ...prev,
              outputAmount: output.toFixed(4),
              isCalculating: false,
            }));
          }
        } catch (error) {
          console.error('DEX calculation error:', error);
          // Fallback to simulated prices
          const simulatedPrice = getSimulatedPrice(state.selectedToken.symbol);
          const output = state.type === 'buy'
            ? inputAmount * simulatedPrice
            : inputAmount / simulatedPrice;

          setState(prev => ({
            ...prev,
            outputAmount: output.toFixed(4),
            isCalculating: false,
          }));
        }
      } else {
        setState(prev => ({ ...prev, outputAmount: '0', isCalculating: false }));
      }
    } catch (error) {
      console.error('Error calculating output:', error);
      setState(prev => ({ ...prev, outputAmount: '0', isCalculating: false }));
    }
  }, [state.inputAmount, state.type, state.selectedToken, tokenInfo]);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect wallet');
    }
  };

  const handleSelectToken = (token: any) => {
    setState(prev => ({ ...prev, selectedToken: token, inputAmount: '', outputAmount: '' }));
    setShowTokenSelector(false);
    setTokenSearch('');
  };

  const handleSwitch = () => {
    setState(prev => ({
      ...prev,
      type: prev.type === 'buy' ? 'sell' : 'buy',
      inputAmount: prev.outputAmount,
      outputAmount: prev.inputAmount,
    }));
  };

  const handleQuickAmount = (amount: number) => {
    setState(prev => ({ ...prev, inputAmount: amount.toString() }));
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

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      const config = getNetworkConfig();
      const inputAmount = parseFloat(state.inputAmount);
      const outputAmount = parseFloat(state.outputAmount);
      const minOutput = outputAmount * (1 - state.slippage / 100);

      let loadingToast: string;
      let transaction: any;

      // ============ BONDING CURVE SWAP (Astro Shiba Tokens) ============
      if (tokenInfo) {
        const soroban = stellarClient.getSoroban();
        const server = soroban.getServer();
        const account = await server.getAccount(address);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes

        let operation;
        if (state.type === 'buy') {
          const xlmAmountStroops = BigInt(Math.floor(inputAmount * 10_000_000));
          const minTokens = BigInt(Math.floor(minOutput * 10_000_000));

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

        transaction = new TransactionBuilder(account, {
          fee: '1000000',
          networkPassphrase: config.passphrase,
        })
          .addOperation(operation as any)
          .setTimeout(30)
          .build();

        loadingToast = toast.loading('Simulating bonding curve swap...');

        const simulated = await server.simulateTransaction(transaction);

        if (!simulated || 'error' in simulated) {
          throw new Error('Simulation failed');
        }

        const preparedTx = SorobanRpc.assembleTransaction(transaction, simulated).build();

        toast.loading('Please sign in your wallet...', { id: loadingToast });
        const signedXDR = await signTransaction(preparedTx.toXDR());
        const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);

        toast.loading('Submitting to network...', { id: loadingToast });
        const sendResponse = await server.sendTransaction(signedTx as any);

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
          } catch (err: any) {
            if (err.message?.includes('Bad union switch')) {
              success = true;
              break;
            }
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        if (!success) {
          throw new Error('Transaction timeout');
        }

        toast.dismiss(loadingToast);
      }
      // ============ STELLAR DEX SWAP (External Tokens) ============
      else if (state.selectedToken?.isTestnet && state.selectedToken?.classicIssuer) {
        const Horizon = await import('@stellar/stellar-sdk');
        const horizonServer = new Horizon.Server(config.horizonUrl);
        const account = await horizonServer.loadAccount(address);

        const sourceAssetCode = state.type === 'buy' ? 'XLM' : state.selectedToken.symbol;
        const sourceIssuer = state.type === 'buy' ? undefined : state.selectedToken.classicIssuer;
        const destAssetCode = state.type === 'buy' ? state.selectedToken.symbol : 'XLM';
        const destIssuer = state.type === 'buy' ? state.selectedToken.classicIssuer : undefined;

        loadingToast = toast.loading('Finding best swap path...');

        const operation = stellarDEXService.buildPathPaymentOperation(
          sourceAssetCode,
          sourceIssuer,
          inputAmount.toFixed(7),
          address,
          destAssetCode,
          destIssuer,
          minOutput.toFixed(7)
        );

        transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: config.passphrase,
        })
          .addOperation(operation)
          .setTimeout(30)
          .build();

        toast.loading('Please sign in your wallet...', { id: loadingToast });
        const signedXDR = await signTransaction(transaction.toXDR());
        const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);

        toast.loading('Submitting swap...', { id: loadingToast });
        const result = await horizonServer.submitTransaction(signedTx as any);

        if (!result.successful) {
          throw new Error('DEX swap failed');
        }

        toast.dismiss(loadingToast);
      } else {
        throw new Error('Invalid token configuration');
      }

      // Success!
      toast.success(
        `Successfully ${state.type === 'buy' ? 'bought' : 'sold'} ${state.selectedToken.symbol}!`
      );

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#10b981', '#8b5cf6', '#f59e0b'],
      });

      // Reset form
      setState(prev => ({
        ...prev,
        inputAmount: '',
        outputAmount: '',
        isProcessing: false,
      }));

      // Refresh token info
      if (state.selectedToken) {
        loadTokenInfo(state.selectedToken.address);
      }
    } catch (error: any) {
      console.error('Trade error:', error);
      toast.error(error.message || `Failed to ${state.type}`);
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Combine platform tokens with testnet tokens
  // edges is already an array of Token objects (not {node: Token})
  const platformTokens = tokensData?.tokens?.edges || [];
  const allTokens = [...TESTNET_TOKENS, ...platformTokens];

  const filteredTokens = allTokens.filter((token: any) =>
    token.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    token.symbol.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-ui-border">
        <h3 className="font-bold text-ui-text-primary">Swap</h3>
        <p className="text-sm text-ui-text-secondary">Trade tokens on bonding curve</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Not Connected State */}
        {!isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-800 mb-3">
                  Connect wallet to start trading
                </p>
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Connect Wallet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Testnet Token Info */}
        {state.selectedToken?.isTestnet && !tokenInfo && state.selectedToken?.classicIssuer && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  Testnet Token - Simulated Pricing
                </p>
                <p className="text-sm text-blue-800">
                  {state.selectedToken.symbol} uses simulated prices for demo (1 XLM = {getSimulatedPrice(state.selectedToken.symbol)} {state.selectedToken.symbol}).
                  Real swaps require testnet liquidity pools.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Testnet Token No Liquidity Warning */}
        {state.selectedToken?.isTestnet && !tokenInfo && !state.selectedToken?.classicIssuer && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-900 mb-1">
                  Token Not Available
                </p>
                <p className="text-sm text-orange-800">
                  This token doesn&apos;t have sufficient liquidity or issuer information.
                  Try tokens from the 🚀 Astro Shiba section instead.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Trade Type Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setState(prev => ({ ...prev, type: 'buy' }))}
            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
              state.type === 'buy'
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Buy
            </div>
          </button>
          <button
            onClick={() => setState(prev => ({ ...prev, type: 'sell' }))}
            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
              state.type === 'sell'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Sell
            </div>
          </button>
        </div>

        {/* Input (From) */}
        <div>
          <label className="block text-xs font-medium text-ui-text-secondary mb-2">
            {state.type === 'buy' ? 'You pay' : 'You sell'}
          </label>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={state.inputAmount}
                onChange={(e) => setState(prev => ({ ...prev, inputAmount: e.target.value }))}
                placeholder="0.00"
                disabled={!isConnected || state.isProcessing}
                className="flex-1 bg-transparent text-2xl font-bold outline-none disabled:opacity-50"
              />
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
                {state.type === 'buy' ? (
                  <>
                    <img src="https://stellar.org/favicon.ico" alt="XLM" className="w-5 h-5" />
                    <span className="font-semibold text-sm">XLM</span>
                  </>
                ) : state.selectedToken ? (
                  <>
                    {state.selectedToken.imageUrl && (
                      <img src={state.selectedToken.imageUrl} alt={state.selectedToken.symbol} className="w-5 h-5 rounded-full" />
                    )}
                    <span className="font-semibold text-sm">{state.selectedToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">Select token</span>
                )}
              </div>
            </div>

            {/* Quick amounts */}
            {state.type === 'buy' && (
              <div className="flex gap-1">
                {[1, 10, 100].map(amount => (
                  <button
                    key={amount}
                    onClick={() => handleQuickAmount(amount)}
                    disabled={!isConnected || state.isProcessing}
                    className="flex-1 py-1 px-2 bg-white rounded text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {amount} XLM
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwitch}
            disabled={!isConnected || state.isProcessing}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <ArrowDown className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Output (To) */}
        <div>
          <label className="block text-xs font-medium text-ui-text-secondary mb-2">
            {state.type === 'buy' ? 'You receive' : 'You get'}
          </label>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 text-2xl font-bold text-gray-400">
                {state.isCalculating ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : state.outputAmount ? (
                  `~${state.outputAmount}`
                ) : (
                  '0.00'
                )}
              </div>
              <button
                onClick={() => setShowTokenSelector(!showTokenSelector)}
                disabled={!isConnected || state.isProcessing}
                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {state.type === 'sell' ? (
                  <>
                    <img src="https://stellar.org/favicon.ico" alt="XLM" className="w-5 h-5" />
                    <span className="font-semibold text-sm">XLM</span>
                  </>
                ) : state.selectedToken ? (
                  <>
                    {state.selectedToken.imageUrl && (
                      <img src={state.selectedToken.imageUrl} alt={state.selectedToken.symbol} className="w-5 h-5 rounded-full" />
                    )}
                    <span className="font-semibold text-sm">{state.selectedToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">Select token</span>
                )}
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Token Selector Modal */}
        {showTokenSelector && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTokenSelector(false)}>
            <div className="bg-white rounded-xl max-w-md w-full max-h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold mb-3">Select a token</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    placeholder="Search by name or symbol"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {tokensLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : filteredTokens.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No tokens found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Testnet Tokens Section */}
                    {filteredTokens.filter((t: any) => t.isTestnet).length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          🧪 Stellar Testnet Tokens
                        </div>
                        <div className="space-y-1">
                          {filteredTokens.filter((t: any) => t.isTestnet).map((token: any) => (
                            <button
                              key={token.address}
                              onClick={() => handleSelectToken(token)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                            >
                              {token.imageUrl && (
                                <img src={token.imageUrl} alt={token.symbol} className="w-8 h-8 rounded-full" />
                              )}
                              <div className="flex-1 text-left">
                                <div className="font-semibold">{token.symbol}</div>
                                <div className="text-xs text-gray-500">{token.name}</div>
                              </div>
                              <div className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Testnet
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Platform Tokens Section */}
                    {filteredTokens.filter((t: any) => !t.isTestnet).length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          🚀 Astro Shiba Tokens
                        </div>
                        <div className="space-y-1">
                          {filteredTokens.filter((t: any) => !t.isTestnet).map((token: any) => (
                            <button
                              key={token.address}
                              onClick={() => handleSelectToken(token)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                              {token.imageUrl && (
                                <img src={token.imageUrl} alt={token.symbol} className="w-8 h-8 rounded-full" />
                              )}
                              <div className="flex-1 text-left">
                                <div className="font-semibold">{token.symbol}</div>
                                <div className="text-xs text-gray-500">{token.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{token.currentPrice ? `${(parseFloat(token.currentPrice) / 10_000_000).toFixed(6)} XLM` : '-'}</div>
                                {token.priceChange24h && (
                                  <div className={`text-xs ${token.priceChange24h > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Slippage */}
        <div>
          <label className="block text-xs font-medium text-ui-text-secondary mb-2">
            Slippage Tolerance
          </label>
          <div className="flex gap-2">
            {[0.5, 1, 2, 5].map(percent => (
              <button
                key={percent}
                onClick={() => setState(prev => ({ ...prev, slippage: percent }))}
                disabled={!isConnected || state.isProcessing}
                className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                  state.slippage === percent
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleTrade}
          disabled={
            !isConnected ||
            state.isProcessing ||
            !state.selectedToken ||
            !state.inputAmount ||
            parseFloat(state.inputAmount) <= 0 ||
            (state.selectedToken?.isTestnet && !tokenInfo) // Disable swap for testnet tokens (simulated only)
          }
          className={`w-full py-3 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            state.type === 'buy'
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          {state.isProcessing ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing...
            </div>
          ) : !isConnected ? (
            'Connect Wallet'
          ) : !state.selectedToken ? (
            'Select a token'
          ) : state.selectedToken?.isTestnet && !tokenInfo ? (
            'Demo Only (Simulated Prices)'
          ) : (
            `Swap ${state.type === 'buy' ? 'XLM' : state.selectedToken.symbol}`
          )}
        </button>

        {/* Token Info */}
        {state.selectedToken && tokenInfo && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Market Cap</span>
              <span className="font-semibold">{(parseFloat(tokenInfo.market_cap) / 10_000_000).toFixed(2)} XLM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">24h Volume</span>
              <span className="font-semibold">{(parseFloat(state.selectedToken.volume24h || '0') / 10_000_000).toFixed(2)} XLM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className={`font-semibold ${tokenInfo.status === 'Bonding' ? 'text-blue-600' : 'text-green-600'}`}>
                {tokenInfo.status === 'Bonding' ? '🔵 Bonding' : '🎓 Graduated'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
