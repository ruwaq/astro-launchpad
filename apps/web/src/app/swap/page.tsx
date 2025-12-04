'use client';

// Force dynamic rendering to avoid build-time errors with contract service
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useWallet } from '@/contexts/WalletContext';
import { useTokens } from '@/hooks/useApi';
import { sacFactoryService, toStroopsBigInt, TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { xlmToStroops, stroopsToXlm } from '@/lib/stellar/utils';
import { sanitizeNumericInput } from '@/lib/utils/format';
import { getClientDeadline } from '@/lib/stellar/client';
import { getNetworkConfig } from '@/lib/config/network';
import { rpc, TransactionBuilder } from '@stellar/stellar-sdk';
import toast from 'react-hot-toast';
import { ArrowDownUp, Loader2, Info, TrendingUp, Search, ChevronDown } from 'lucide-react';

type SwapDirection = 'xlm-to-token' | 'token-to-xlm';

// Token from GraphQL response
interface TokenFromAPI {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string | null;
  graduated?: boolean;
}

export default function SwapPage() {
  const { address, isConnected, connect, isConnecting, signTransaction } = useWallet();

  // Fetch tokens from GraphQL API (FIXED: was previously broken)
  const { data: tokensData, loading: loadingTokens } = useTokens({ first: 50 });

  // Extract tokens from GraphQL connection pattern (edges/nodes)
  const availableTokens: TokenFromAPI[] = (tokensData?.tokens?.edges || []).map(
    (edge: { node: TokenFromAPI }) => edge.node
  );

  // State
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [selectedTokenInfo, setSelectedTokenInfo] = useState<TokenInfo | null>(null);
  const [direction, setDirection] = useState<SwapDirection>('xlm-to-token');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1.0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [calculating, setCalculating] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');

  // Filter tokens based on search
  const filteredTokens = availableTokens.filter(
    (t) =>
      t.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
      t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
      t.address.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  // Get selected token details from available tokens
  const selectedTokenData = availableTokens.find((t) => t.address === selectedToken);

  // Fetch token info when selected
  useEffect(() => {
    if (selectedToken) {
      fetchTokenInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken]);

  // Calculate output when input changes
  useEffect(() => {
    if (inputAmount && selectedTokenInfo) {
      calculateOutput();
    } else {
      setOutputAmount('');
      setPriceImpact(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputAmount, selectedTokenInfo, direction]);

  const fetchTokenInfo = useCallback(async () => {
    if (!selectedToken) return;

    try {
      const info = await sacFactoryService.getTokenInfo(selectedToken);
      if (info) {
        setSelectedTokenInfo(info);
      }
    } catch (error: any) {
      console.error('Error fetching token info:', error);
      toast.error('Failed to load token details');
    }
  }, [selectedToken]);

  const calculateOutput = useCallback(async () => {
    if (!selectedTokenInfo || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      return;
    }

    setCalculating(true);
    try {
      if (direction === 'xlm-to-token') {
        // Buy tokens with XLM
        const xlmStroops = BigInt(xlmToStroops(inputAmount));
        const tokensOutGross = sacFactoryService.calculateBuyOutput(selectedTokenInfo, xlmStroops);
        // CRITICAL: Apply 0.3% trading fee to show NET amount user will receive
        const tokensOutNet = sacFactoryService.applyTradingFee(tokensOutGross);
        setOutputAmount((Number(tokensOutNet) / 10000000).toFixed(6));

        // Calculate price impact using GROSS tokens (matches contract behavior)
        const currentPrice = Number(selectedTokenInfo.bonding_curve.xlm_reserve) /
                           Number(selectedTokenInfo.bonding_curve.token_reserve);
        const newReserveXlm = Number(selectedTokenInfo.bonding_curve.xlm_reserve) + Number(xlmStroops);
        const newReserveToken = Number(selectedTokenInfo.bonding_curve.token_reserve) - Number(tokensOutGross);
        const newPrice = newReserveXlm / newReserveToken;
        const impact = ((newPrice - currentPrice) / currentPrice) * 100;
        setPriceImpact(impact);
      } else {
        // Sell tokens for XLM
        // SAFE: Use string-based conversion to avoid floating-point precision loss
        const tokenAmount = toStroopsBigInt(inputAmount);
        const xlmOutGross = sacFactoryService.calculateSellOutput(selectedTokenInfo, tokenAmount);
        // CRITICAL: Apply 0.3% trading fee to show NET amount user will receive
        const xlmOutNet = sacFactoryService.applyTradingFee(xlmOutGross);
        setOutputAmount(stroopsToXlm(xlmOutNet.toString()));

        // Calculate price impact
        const currentPrice = Number(selectedTokenInfo.bonding_curve.xlm_reserve) /
                           Number(selectedTokenInfo.bonding_curve.token_reserve);
        const newReserveXlm = Number(selectedTokenInfo.bonding_curve.xlm_reserve) - Number(xlmOutGross);
        const newReserveToken = Number(selectedTokenInfo.bonding_curve.token_reserve) + Number(tokenAmount);
        const newPrice = newReserveXlm / newReserveToken;
        const impact = ((currentPrice - newPrice) / currentPrice) * 100;
        setPriceImpact(impact);
      }
    } catch (error: any) {
      console.error('Error calculating output:', error);
      setOutputAmount('0');
    } finally {
      setCalculating(false);
    }
  }, [selectedTokenInfo, inputAmount, direction]);

  const handleSwap = async () => {
    if (!address || !selectedToken || !inputAmount || !outputAmount) {
      toast.error('Please fill all fields');
      return;
    }

    if (!selectedTokenInfo) {
      toast.error('Token info not loaded');
      return;
    }

    setIsSwapping(true);

    try {
      const config = getNetworkConfig();
      const server = new rpc.Server(config.rpcUrl);

      // Get account
      const account = await server.getAccount(address);

      // Build transaction based on direction
      let operation: any;

      // SAFE: Use getClientDeadline for consistent deadline calculation
      const deadline = getClientDeadline(300);

      if (direction === 'xlm-to-token') {
        // Buy tokens with XLM
        // SAFE: Use string-based conversion to avoid floating-point precision loss
        const xlmStroops = BigInt(xlmToStroops(inputAmount));
        const minTokensAmount = parseFloat(outputAmount) * (1 - slippage / 100);
        const minTokens = toStroopsBigInt(minTokensAmount);

        operation = sacFactoryService.buildBuyOperation(
          address,
          selectedToken,
          xlmStroops,
          minTokens,
          deadline // NEW: MEV protection
        );

        toast.loading('Building buy transaction...');
      } else {
        // Sell tokens for XLM
        // SAFE: Use string-based conversion to avoid floating-point precision loss
        const tokenAmount = toStroopsBigInt(inputAmount);
        const minXlmAmount = parseFloat(outputAmount) * (1 - slippage / 100);
        const minXlm = toStroopsBigInt(minXlmAmount);

        operation = sacFactoryService.buildSellOperation(
          address,
          selectedToken,
          tokenAmount,
          minXlm,
          deadline // NEW: MEV protection
        );

        toast.loading('Building sell transaction...');
      }

      // Build transaction
      const transaction = new TransactionBuilder(account, {
        fee: '10000000', // 1 XLM fee for contract calls
        networkPassphrase: config.passphrase,
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

      toast.dismiss();
      toast.loading('Simulating transaction...');

      // Simulate
      const simulated = await server.simulateTransaction(transaction);

      if (rpc.Api.isSimulationError(simulated)) {
        throw new Error('Transaction simulation failed');
      }

      // Prepare transaction
      const preparedTx = rpc.assembleTransaction(transaction, simulated).build();

      toast.dismiss();
      toast.loading('Waiting for signature...');

      // Sign transaction
      const signedXDR = await signTransaction(preparedTx.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);

      toast.dismiss();
      toast.loading('Submitting to network...');

      // Submit
      const sendResponse = await server.sendTransaction(signedTx as any);

      if (sendResponse.status === 'ERROR') {
        throw new Error('Transaction submission failed');
      }

      toast.dismiss();
      toast.loading('Confirming transaction...');

      // Poll for result
      let getResponse = await server.getTransaction(sendResponse.hash);
      let attempts = 0;
      const maxAttempts = 30;

      while (getResponse.status === 'NOT_FOUND' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        getResponse = await server.getTransaction(sendResponse.hash);
        attempts++;
      }

      toast.dismiss();

      if (getResponse.status === 'SUCCESS') {
        toast.success(
          direction === 'xlm-to-token'
            ? `Successfully bought ${outputAmount} ${selectedTokenInfo.symbol}!`
            : `Successfully sold ${inputAmount} ${selectedTokenInfo.symbol}!`
        );

        // Reset form
        setInputAmount('');
        setOutputAmount('');
        setPriceImpact(0);

        // Refresh token info
        await fetchTokenInfo();
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      toast.dismiss();
      toast.error(error.message || 'Swap failed. Please try again.');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleFlipDirection = () => {
    setDirection(direction === 'xlm-to-token' ? 'token-to-xlm' : 'xlm-to-token');
    setInputAmount('');
    setOutputAmount('');
    setPriceImpact(0);
  };

  const handleConnectWallet = async () => {
    try {
      await connect();
      toast.success('Wallet connected!');
    } catch (error: any) {
      // Error already handled by WalletContext
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary">
            Swap Tokens
          </h1>
          <p className="text-ui-text-secondary mt-1">
            Trade XLM for SAC tokens using the bonding curve
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          {/* Swap Card */}
          <div className="bg-white rounded-xl p-4 sm:p-6 border border-ui-border shadow-sm">
            {/* Connection check */}
            {!isConnected ? (
              <div className="text-center py-8">
                <p className="text-ui-text-secondary mb-4">
                  Connect your wallet to start swapping
                </p>
                <button
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="px-6 py-3 min-h-[44px] bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            ) : (
              <>
                {/* Token Selection - FIXED: Now uses GraphQL data */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-ui-text-secondary mb-2">
                    Select Token
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTokenSelector(!showTokenSelector)}
                      className="w-full px-4 py-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white flex items-center justify-between min-h-[48px]"
                    >
                      {selectedTokenData ? (
                        <div className="flex items-center gap-3">
                          {selectedTokenData.imageUrl ? (
                            <img
                              src={selectedTokenData.imageUrl}
                              alt={selectedTokenData.symbol}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-blue rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {selectedTokenData.symbol.charAt(0)}
                            </div>
                          )}
                          <div className="text-left">
                            <p className="font-semibold text-ui-text-primary">{selectedTokenData.name}</p>
                            <p className="text-xs text-ui-text-secondary">${selectedTokenData.symbol}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-ui-text-secondary">
                          {loadingTokens ? 'Loading tokens...' : 'Select a token'}
                        </span>
                      )}
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showTokenSelector ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Token Selector Dropdown */}
                    {showTokenSelector && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-ui-border rounded-lg shadow-lg max-h-80 overflow-hidden">
                        {/* Search Input */}
                        <div className="p-3 border-b border-ui-border">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search by name, symbol, or address..."
                              className="w-full pl-9 pr-4 py-2 text-sm border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                              value={tokenSearch}
                              onChange={(e) => setTokenSearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Token List */}
                        <div className="max-h-60 overflow-y-auto">
                          {filteredTokens.length === 0 ? (
                            <div className="p-4 text-center text-ui-text-secondary text-sm">
                              {loadingTokens ? 'Loading...' : 'No tokens found'}
                            </div>
                          ) : (
                            filteredTokens.map((token) => (
                              <button
                                key={token.address}
                                type="button"
                                onClick={() => {
                                  setSelectedToken(token.address);
                                  setShowTokenSelector(false);
                                  setTokenSearch('');
                                }}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                                  selectedToken === token.address ? 'bg-brand-primary-50' : ''
                                }`}
                              >
                                {token.imageUrl ? (
                                  <img
                                    src={token.imageUrl}
                                    alt={token.symbol}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-blue rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {token.symbol.charAt(0)}
                                  </div>
                                )}
                                <div className="flex-1 text-left">
                                  <p className="font-medium text-ui-text-primary">{token.name}</p>
                                  <p className="text-xs text-ui-text-secondary">${token.symbol}</p>
                                </div>
                                {token.graduated && (
                                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                    Graduated
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>

                        {/* Manual Address Entry */}
                        <div className="p-3 border-t border-ui-border">
                          <input
                            type="text"
                            placeholder="Or paste token address (C...)"
                            className="w-full px-3 py-2 text-sm border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.startsWith('C')) {
                                setSelectedToken(e.currentTarget.value);
                                setShowTokenSelector(false);
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected Token Info */}
                  {selectedTokenInfo && !showTokenSelector && (
                    <div className="mt-2 p-3 bg-brand-primary-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ui-text-secondary">Contract:</span>
                        <span className="text-xs font-mono text-ui-text-primary">
                          {selectedToken.slice(0, 8)}...{selectedToken.slice(-8)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* From (Input) */}
                <div className="mb-2">
                  <label className="block text-sm font-medium text-ui-text-secondary mb-2">
                    {direction === 'xlm-to-token' ? 'You Pay' : 'You Sell'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.0"
                      className="w-full px-4 py-4 pr-20 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-lg"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(sanitizeNumericInput(e.target.value))}
                      disabled={!selectedTokenInfo}
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 font-semibold text-ui-text-primary">
                      {direction === 'xlm-to-token' ? 'XLM' : selectedTokenInfo?.symbol || 'TOKEN'}
                    </div>
                  </div>
                </div>

                {/* Flip Button */}
                <div className="flex justify-center my-3">
                  <button
                    onClick={handleFlipDirection}
                    className="p-3 min-h-[44px] min-w-[44px] bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg transition-colors flex items-center justify-center"
                    disabled={!selectedTokenInfo}
                  >
                    <ArrowDownUp className="h-5 w-5 text-brand-primary" />
                  </button>
                </div>

                {/* To (Output) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-ui-text-secondary mb-2">
                    {direction === 'xlm-to-token' ? 'You Receive' : 'You Get'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="0.0"
                      className="w-full px-4 py-4 pr-20 border border-ui-border rounded-lg bg-gray-50 text-lg"
                      value={calculating ? 'Calculating...' : outputAmount}
                      readOnly
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 font-semibold text-ui-text-primary">
                      {direction === 'xlm-to-token' ? selectedTokenInfo?.symbol || 'TOKEN' : 'XLM'}
                    </div>
                  </div>
                </div>

                {/* Trade Details */}
                {inputAmount && outputAmount && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ui-text-secondary">Price Impact</span>
                      <span className={`font-medium ${
                        priceImpact > 5 ? 'text-red-600' :
                        priceImpact > 2 ? 'text-yellow-600' : 'text-brand-green'
                      }`}>
                        {priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ui-text-secondary">Slippage Tolerance</span>
                      <span className="font-medium text-ui-text-primary">{slippage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ui-text-secondary">Minimum Received</span>
                      <span className="font-medium text-ui-text-primary">
                        {(parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6)}{' '}
                        {direction === 'xlm-to-token' ? selectedTokenInfo?.symbol : 'XLM'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Slippage Settings */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-ui-text-secondary mb-2">
                    Slippage Tolerance
                  </label>
                  <div className="flex gap-2">
                    {[0.5, 1.0, 2.0].map((value) => (
                      <button
                        key={value}
                        className={`flex-1 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                          slippage === value
                            ? 'bg-brand-primary text-white'
                            : 'bg-gray-100 text-ui-text-secondary hover:bg-gray-200'
                        }`}
                        onClick={() => setSlippage(value)}
                      >
                        {value}%
                      </button>
                    ))}
                    <input
                      type="number"
                      className="w-16 sm:w-20 px-2 py-2.5 min-h-[44px] border border-ui-border rounded-lg text-sm"
                      placeholder="Custom"
                      step="0.1"
                      min="0.1"
                      max="50"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val >= 0.1 && val <= 50) {
                          setSlippage(val);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Swap Button */}
                <button
                  onClick={handleSwap}
                  disabled={!selectedToken || !inputAmount || !outputAmount || isSwapping || calculating}
                  className={`w-full py-4 min-h-[52px] rounded-lg font-semibold text-lg transition-colors ${
                    !selectedToken || !inputAmount || !outputAmount || isSwapping || calculating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-brand-primary text-white hover:bg-brand-primary-600'
                  }`}
                >
                  {isSwapping ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Swapping...
                    </span>
                  ) : !selectedToken ? (
                    'Enter Token Address'
                  ) : !inputAmount ? (
                    'Enter Amount'
                  ) : calculating ? (
                    'Calculating...'
                  ) : (
                    'Swap'
                  )}
                </button>

                {/* Price Impact Warning */}
                {priceImpact > 5 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900">High Price Impact</p>
                        <p className="text-xs text-red-700 mt-1">
                          This trade will significantly affect the token price. Consider splitting into smaller trades.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-brand-blue-50 rounded-xl p-4 border border-brand-blue-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-blue rounded-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-brand-blue-900 text-sm">
                    Bonding Curve
                  </h3>
                  <p className="text-xs text-brand-blue-700 mt-1">
                    Prices determined by constant product formula (x * y = k)
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-brand-green-50 rounded-xl p-4 border border-brand-green-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-green rounded-lg">
                  <Info className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-brand-green-900 text-sm">
                    No Pool Needed
                  </h3>
                  <p className="text-xs text-brand-green-700 mt-1">
                    Trade directly with the bonding curve contract
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
