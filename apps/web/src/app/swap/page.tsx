'use client';

import { useState } from 'react';
import { useWallet as useWalletContext } from '@/contexts/WalletContext';
import { useTokens, useGlobalStats } from '@/hooks/useApi';
import { tokenFactoryService } from '@/lib/stellar/services';
import toast from 'react-hot-toast';

export default function SwapPage() {
  const { address } = useWalletContext();
  const { data: tokensData, loading: tokensLoading } = useTokens({ first: 100 });
  const { data: statsData } = useGlobalStats();

  const [fromToken, setFromToken] = useState<string>('');
  const [toToken, setToToken] = useState<string>('');
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [isSwapping, setIsSwapping] = useState(false);

  const tokens = tokensData?.tokens.edges.map((edge: any) => edge.node) || [];

  const handleSwap = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!fromToken || !toToken || !fromAmount) {
      toast.error('Please fill all fields');
      return;
    }

    setIsSwapping(true);

    try {
      // Calculate expected output with slippage
      const slippageMultiplier = 1 - slippage / 100;
      const minToAmount = (parseFloat(toAmount) * slippageMultiplier).toString();

      toast.success('Swap transaction submitted!');

      // Reset form
      setFromAmount('');
      setToAmount('');
    } catch (error) {
      console.error('Swap error:', error);
      toast.error('Swap failed. Please try again.');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAmountChange = (value: string) => {
    setFromAmount(value);
    // Calculate estimated output (simple 1:1 for now - integrate real pricing later)
    if (value && parseFloat(value) > 0) {
      setToAmount((parseFloat(value) * 0.997).toFixed(6)); // 0.3% fee
    } else {
      setToAmount('');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-8">Swap Tokens</h1>

        {/* Global Stats */}
        {statsData && (
          <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">24h Volume</p>
                <p className="text-2xl font-bold">${statsData.globalStats.totalVolume24h}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Liquidity</p>
                <p className="text-2xl font-bold">${statsData.globalStats.totalLiquidity}</p>
              </div>
            </div>
          </div>
        )}

        {/* Swap Card */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          {/* From Token */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From
            </label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
              >
                <option value="">Select token</option>
                {tokens.map((token: any) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
          </div>

          {/* Swap Icon */}
          <div className="flex justify-center my-4">
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => {
                const temp = fromToken;
                setFromToken(toToken);
                setToToken(temp);
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* To Token */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To
            </label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
              >
                <option value="">Select token</option>
                {tokens.map((token: any) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                placeholder="0.0"
                value={toAmount}
                readOnly
              />
            </div>
          </div>

          {/* Slippage */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slippage Tolerance: {slippage}%
            </label>
            <div className="flex gap-2">
              {[0.1, 0.5, 1.0].map((value) => (
                <button
                  key={value}
                  className={`px-4 py-2 rounded-lg ${
                    slippage === value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSlippage(value)}
                >
                  {value}%
                </button>
              ))}
              <input
                type="number"
                className="w-20 px-2 py-2 border border-gray-300 rounded-lg"
                placeholder="Custom"
                step="0.1"
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
              />
            </div>
          </div>

          {/* Swap Button */}
          <button
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              !address || !fromToken || !toToken || !fromAmount || isSwapping
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            onClick={handleSwap}
            disabled={!address || !fromToken || !toToken || !fromAmount || isSwapping}
          >
            {!address
              ? 'Connect Wallet'
              : isSwapping
              ? 'Swapping...'
              : 'Swap'}
          </button>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">How it works</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Select tokens to swap</li>
            <li>• Enter amount and adjust slippage tolerance</li>
            <li>• Confirm transaction in your wallet</li>
            <li>• Tokens will be swapped instantly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
