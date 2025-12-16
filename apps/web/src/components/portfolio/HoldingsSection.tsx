/**
 * Holdings Section Component
 *
 * Displays user's token holdings with:
 * - Token list with balances
 * - Current prices (bonding curve or AMM)
 * - Total value in XLM
 * - Profit/Loss indicators
 * - Token status badges (Bonding/Graduated)
 * - Quick trade buttons
 */

'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  RefreshCw,
  DollarSign,
  GraduationCap,
  Zap,
  Wallet,
} from 'lucide-react';
import { useUserHoldings } from '@/hooks/useUserHoldings';
import { stroopsToXlm, formatCompactNumber } from '@/lib/stellar/utils';
import { getIpfsUrl as getImageUrl } from '@/lib/utils/ipfs';

interface HoldingsSectionProps {
  address: string;
}

export function HoldingsSection({ address }: HoldingsSectionProps) {
  const { holdings, isLoading, error, totalPortfolioValue, refetch } = useUserHoldings(address);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-ui-border p-4 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
        <p className="text-red-600 font-medium mb-2">Failed to load holdings</p>
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (holdings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-ui-text-primary mb-2">No Holdings Yet</h3>
        <p className="text-ui-text-secondary mb-6">
          Start trading to see your token holdings here
        </p>
        <Link
          href="/explore"
          className="inline-block px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium"
        >
          Explore Tokens
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-brand-primary to-brand-blue rounded-xl p-6 text-white"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium opacity-90">Total Portfolio Value</h3>
          <button
            onClick={refetch}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh holdings"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{formatCompactNumber(parseFloat(totalPortfolioValue))}</span>
          <span className="text-lg opacity-90">XLM</span>
        </div>
        <p className="text-sm opacity-75 mt-1">{holdings.length} tokens held</p>
      </motion.div>

      {/* Holdings List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {holdings.map((holding, index) => (
            <motion.div
              key={holding.tokenAddress}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
            >
              <HoldingCard holding={holding} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface HoldingCardProps {
  holding: any;
}

function HoldingCard({ holding }: HoldingCardProps) {
  const priceChange = holding.priceChange24h;
  const isPriceUp = priceChange > 0;
  const isPriceDown = priceChange < 0;

  // Calculate profit/loss if purchase history is available
  const profitLoss = holding.purchaseHistory ? (() => {
    const currentValue = parseFloat(holding.totalValue);
    const costBasis = parseFloat(holding.purchaseHistory.totalSpent);
    const pnl = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return { pnl, pnlPercent, hasPnl: true };
  })() : { pnl: 0, pnlPercent: 0, hasPnl: false };

  return (
    <Link
      href={`/t/${holding.tokenAddress}`}
      className="block bg-white rounded-xl border border-ui-border hover:border-brand-primary hover:shadow-lg transition-all duration-200 p-4 group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Token Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Token Image */}
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 ring-2 ring-transparent group-hover:ring-brand-primary/30 transition-all duration-300">
            <Image
              src={getImageUrl(holding.tokenImage) || '/images/default-token.svg'}
              alt={holding.tokenName}
              fill
              className="object-cover"
              sizes="48px"
              unoptimized={true}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/default-token.svg';
              }}
            />
          </div>

          {/* Token Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-ui-text-primary truncate group-hover:text-brand-primary transition-colors">
                {holding.tokenName}
              </h3>
              {/* Status Badge */}
              {holding.isGraduated ? (
                <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  <GraduationCap className="h-3 w-3" />
                  DEX
                </span>
              ) : (
                <span className="text-xs font-bold text-brand-primary bg-brand-primary-50 px-2 py-0.5 rounded-full">
                  Bonding
                </span>
              )}
            </div>
            <p className="text-sm text-ui-text-secondary">${holding.tokenSymbol}</p>
          </div>
        </div>

        {/* Right: Balance & Value */}
        <div className="text-right flex-shrink-0">
          {/* Balance */}
          <div className="font-bold text-ui-text-primary mb-1">
            {formatCompactNumber(parseFloat(holding.balance))}
          </div>

          {/* Current Price */}
          <div className="text-xs text-ui-text-secondary mb-2">
            {stroopsToXlm(holding.currentPrice, 7)} XLM
          </div>

          {/* Total Value */}
          <div className="flex items-center justify-end gap-1 text-sm font-semibold text-brand-primary">
            <DollarSign className="h-3 w-3" />
            {formatCompactNumber(parseFloat(holding.totalValue))} XLM
          </div>
        </div>
      </div>

      {/* Bottom Row: Price Change, P/L & Action */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-ui-border">
        {/* Price Change & Profit/Loss */}
        <div className="flex items-center gap-2">
          {/* 24h Price Change */}
          {isPriceUp && (
            <div className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" />
              +{priceChange.toFixed(1)}%
            </div>
          )}
          {isPriceDown && (
            <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
              <TrendingDown className="h-3 w-3" />
              {priceChange.toFixed(1)}%
            </div>
          )}
          {!isPriceUp && !isPriceDown && (
            <div className="text-xs text-ui-text-secondary px-2 py-1">0%</div>
          )}

          {/* Profit/Loss */}
          {profitLoss.hasPnl && (
            <div
              className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${
                profitLoss.pnl >= 0
                  ? 'text-green-700 bg-green-100'
                  : 'text-red-700 bg-red-100'
              }`}
            >
              {profitLoss.pnl >= 0 ? '+' : ''}
              {profitLoss.pnl.toFixed(2)} XLM ({profitLoss.pnlPercent >= 0 ? '+' : ''}
              {profitLoss.pnlPercent.toFixed(1)}%)
            </div>
          )}
        </div>

        {/* Trade Button */}
        <div className="flex items-center gap-2">
          {holding.isGraduated ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 group-hover:text-green-700 transition-colors">
              Trade on DEX
              <ExternalLink className="h-3 w-3" />
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-brand-primary group-hover:text-brand-primary-600 transition-colors">
              <Zap className="h-3 w-3" />
              Quick Trade
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
