/**
 * TokenCard Component - REAL DATA
 *
 * Displays token information from Stellar contract
 * All data is live from the blockchain
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Users, DollarSign } from 'lucide-react';
import { useToken } from '@/hooks/useToken';
import { usePrice } from '@/hooks/usePrice';

interface TokenCardProps {
  tokenAddress: string;
  /**
   * Compact mode shows less info
   */
  compact?: boolean;
  /**
   * Click handler
   */
  onClick?: () => void;
}

export function TokenCard({ tokenAddress, compact = false, onClick }: TokenCardProps) {
  const { token, isLoading, error } = useToken(tokenAddress, {
    refreshInterval: 30000, // Refresh every 30s
  });

  const { price, priceDirection, priceChange24h } = usePrice(tokenAddress, {
    interval: 5000, // Price updates every 5s
  });

  // Loading skeleton
  if (isLoading || !token) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-4 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
        {!compact && (
          <div className="mt-4 space-y-2">
            <div className="h-2 bg-gray-200 rounded" />
            <div className="h-2 bg-gray-200 rounded w-2/3" />
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-4">
        <p className="text-sm text-red-600">Failed to load token</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  // Calculate graduation progress
  const GRADUATION_THRESHOLD = BigInt(100_000_000_000); // 10,000 XLM in stroops
  const xlmRaised = BigInt(token.xlm_raised);
  const graduationPercent = Math.min(
    Number((xlmRaised * BigInt(100)) / GRADUATION_THRESHOLD),
    100
  );

  // Format price (stroops to XLM)
  const formattedPrice = (Number(price) / 10_000_000).toFixed(7);

  // Format market cap
  const formattedMarketCap = (Number(token.market_cap) / 10_000_000).toFixed(2);

  // Is token graduated?
  const isGraduated = token.status === 'Graduated';

  return (
    <Link
      href={`/t/${tokenAddress}`}
      onClick={onClick}
      className="block bg-white rounded-xl border border-ui-border hover:border-brand-primary hover:shadow-lg transition-all duration-200 overflow-hidden group"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Token Image */}
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <Image
              src={token.image_url}
              alt={token.name}
              fill
              className="object-cover"
              sizes="48px"
              onError={(e) => {
                // Fallback to default image on error
                (e.target as HTMLImageElement).src = '/images/default-token.png';
              }}
            />
          </div>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-ui-text-primary truncate group-hover:text-brand-primary transition-colors">
                  {token.name}
                </h3>
                <p className="text-sm text-ui-text-secondary">${token.symbol}</p>
              </div>

              {/* Trending indicator */}
              {priceDirection === 'up' && (
                <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <TrendingUp className="h-3 w-3" />
                  {priceChange24h > 0 && `+${priceChange24h.toFixed(1)}%`}
                </div>
              )}
              {priceDirection === 'down' && (
                <div className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  <TrendingDown className="h-3 w-3" />
                  {priceChange24h < 0 && `${priceChange24h.toFixed(1)}%`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description (if not compact) */}
        {!compact && token.description && (
          <p className="text-sm text-ui-text-secondary mt-3 line-clamp-2">
            {token.description}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <p className="text-xs text-ui-text-secondary">Price</p>
            <p className="font-semibold text-ui-text-primary">{formattedPrice} XLM</p>
          </div>
          <div>
            <p className="text-xs text-ui-text-secondary">Market Cap</p>
            <p className="font-semibold text-ui-text-primary">${formattedMarketCap}</p>
          </div>
        </div>

        {/* Graduation Progress */}
        {!isGraduated ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-ui-text-secondary">Graduation Progress</span>
              <span className="font-medium text-brand-primary">{graduationPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-primary to-brand-blue transition-all duration-300"
                style={{ width: `${graduationPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-lg py-2">
            <span className="text-lg">🎓</span>
            <span className="text-sm font-semibold text-green-700">GRADUATED</span>
          </div>
        )}

        {/* Additional Stats (if not compact) */}
        {!compact && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-ui-border">
            <div className="flex items-center gap-1 text-xs text-ui-text-secondary">
              <Users className="h-3 w-3" />
              <span>{token.holders_count} holders</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-ui-text-secondary">
              <DollarSign className="h-3 w-3" />
              <span>{(Number(xlmRaised) / 10_000_000).toFixed(0)} XLM raised</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
