'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useWallet } from '@/contexts/WalletContext';
import { sacFactoryService, TokenInfo } from '@/lib/stellar/services/sac-factory.service';
import { xlmToStroops, stroopsToXlm, formatCompactNumber } from '@/lib/stellar/utils';
import { getNetworkConfig } from '@/lib/config/network';
import { SorobanRpc, TransactionBuilder, Networks, Operation } from '@stellar/stellar-sdk';
import toast from 'react-hot-toast';
import { ArrowDownUp, Loader2, Info, TrendingUp } from 'lucide-react';

type SwapDirection = 'xlm-to-token' | 'token-to-xlm';

export default function SwapPage() {
  const { address, isConnected, connect, isConnecting, signTransaction } = useWallet();

  // State
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [selectedTokenInfo, setSelectedTokenInfo] = useState<TokenInfo | null>(null);
  const [direction, setDirection] = useState<SwapDirection>('xlm-to-token');
  const [inputAmount, setInputAmount] = useState<string>('');
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1.0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [calculating, setCalculating] = useState(false);

  // Fetch available tokens on mount
  useEffect(() => {
    if (isConnected) {
      fetchTokens();
    }
  }, [isConnected]);

  // Fetch token info when selected
  useEffect(() => {
    if (selectedToken) {
      fetchTokenInfo();
    }
  }, [selectedToken]);

  // Calculate output when input changes
  useEffect(() => {
    if (inputAmount && selectedTokenInfo) {
      calculateOutput();
    } else {
      setOutputAmount('');
      setPriceImpact(0);
    }
  }, [inputAmount, selectedTokenInfo, direction]);

  const fetchTokens = async () => {
    setLoadingTokens(true);
    try {
      const count = await sacFactoryService.getTokenCount();
      if (count === 0) {
        setTokens([]);
        return;
      }

      // For demo, fetch first 20 tokens
      // In production, implement pagination or search
      const tokenPromises: Promise<TokenInfo | null>[] = [];

      // Fetch tokens by getting creator tokens from a known set
      // For now, we'll just show tokens we can find
      // This could be improved with an indexer or event listener

      setTokens([]);
    } catch (error: any) {
      console.error('Error fetching tokens:', error);
      toast.error('Failed to load tokens');
    } finally {
      setLoadingTokens(false);
    }
  };

  const fetchTokenInfo = async () => {
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
  };

  const calculateOutput = async () => {
    if (!selectedTokenInfo || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      return;
    }

    setCalculating(true);
    try {
      if (direction === 'xlm-to-token') {
        // Buy tokens with XLM
        const xlmStroops = BigInt(xlmToStroops(inputAmount));
        const tokensOut = sacFactoryService.calculateBuyOutput(selectedTokenInfo, xlmStroops);
        setOutputAmount((Number(tokensOut) / 10000000).toFixed(6));

        // Calculate price impact
        const currentPrice = Number(selectedTokenInfo.bonding_curve.xlm_reserve) /
                           Number(selectedTokenInfo.bonding_curve.token_reserve);
        const newReserveXlm = Number(selectedTokenInfo.bonding_curve.xlm_reserve) + Number(xlmStroops);
        const newReserveToken = Number(selectedTokenInfo.bonding_curve.token_reserve) - Number(tokensOut);
        const newPrice = newReserveXlm / newReserveToken;
        const impact = ((newPrice - currentPrice) / currentPrice) * 100;
        setPriceImpact(impact);
      } else {
        // Sell tokens for XLM
        const tokenAmount = BigInt(Math.floor(parseFloat(inputAmount) * 10000000));
        const xlmOut = sacFactoryService.calculateSellOutput(selectedTokenInfo, tokenAmount);
        setOutputAmount(stroopsToXlm(xlmOut.toString()));

        // Calculate price impact
        const currentPrice = Number(selectedTokenInfo.bonding_curve.xlm_reserve) /
                           Number(selectedTokenInfo.bonding_curve.token_reserve);
        const newReserveXlm = Number(selectedTokenInfo.bonding_curve.xlm_reserve) - Number(xlmOut);
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
  };

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
      const server = new SorobanRpc.Server(config.rpcUrl);

      // Get account
      const account = await server.getAccount(address);

      // Build transaction based on direction
      let operation: any;

      // Calculate deadline: current time + 5 minutes (MEV protection)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      if (direction === 'xlm-to-token') {
        // Buy tokens with XLM
        const xlmStroops = BigInt(xlmToStroops(inputAmount));
        const minTokens = BigInt(Math.floor(parseFloat(outputAmount) * (1 - slippage / 100) * 10000000));

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
        const tokenAmount = BigInt(Math.floor(parseFloat(inputAmount) * 10000000));
        const minXlm = BigInt(xlmToStroops((parseFloat(outputAmount) * (1 - slippage / 100)).toString()));

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

      if (SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error('Transaction simulation failed');
      }

      // Prepare transaction
      const preparedTx = SorobanRpc.assembleTransaction(transaction, simulated).build();

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
          <div className="bg-white rounded-xl p-6 border border-ui-border shadow-sm">
            {/* Connection check */}
            {!isConnected ? (
              <div className="text-center py-8">
                <p className="text-ui-text-secondary mb-4">
                  Connect your wallet to start swapping
                </p>
                <button
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            ) : (
              <>
                {/* Token Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-ui-text-secondary mb-2">
                    Select Token
                  </label>
                  <input
                    type="text"
                    placeholder="Enter token address..."
                    className="w-full px-4 py-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                  />
                  {selectedTokenInfo && (
                    <div className="mt-2 p-3 bg-brand-primary-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-blue rounded-lg flex items-center justify-center text-white font-bold">
                          {selectedTokenInfo.symbol.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-ui-text-primary">
                            {selectedTokenInfo.name}
                          </p>
                          <p className="text-sm text-ui-text-secondary">
                            ${selectedTokenInfo.symbol}
                          </p>
                        </div>
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
                      onChange={(e) => setInputAmount(e.target.value)}
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
                    className="p-2 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg transition-colors"
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
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                      className="w-20 px-2 py-2 border border-ui-border rounded-lg text-sm"
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
                  className={`w-full py-4 rounded-lg font-semibold text-lg transition-colors ${
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
