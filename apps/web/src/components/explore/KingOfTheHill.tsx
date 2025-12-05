/**
 * King of the Hill Component
 *
 * Featured token spotlight - Pump.fun style
 * Shows the #1 trending token with premium styling
 */

'use client';

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Crown, TrendingUp, Users, Flame, Zap, ExternalLink } from 'lucide-react';
import { formatCompactNumber, GRADUATION_THRESHOLD_XLM } from '@/lib/stellar/utils';
import type { Token } from '@/lib/graphql/types';

interface KingOfTheHillProps {
  token: Token | null;
  isLoading?: boolean;
}

export const KingOfTheHill = memo(function KingOfTheHill({
  token,
  isLoading = false,
}: KingOfTheHillProps) {
  if (isLoading) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 rounded-2xl border-2 border-amber-200 p-6 animate-pulse">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-24 h-24 bg-amber-200 rounded-xl" />
          <div className="flex-1 space-y-3">
            <div className="h-6 bg-amber-200 rounded w-48" />
            <div className="h-4 bg-amber-100 rounded w-32" />
            <div className="flex gap-4">
              <div className="h-16 bg-amber-100 rounded w-24" />
              <div className="h-16 bg-amber-100 rounded w-24" />
              <div className="h-16 bg-amber-100 rounded w-24" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  const graduationProgress = token.xlmRaised
    ? Math.min((parseFloat(token.xlmRaised) / GRADUATION_THRESHOLD_XLM) * 100, 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 rounded-2xl" />

      {/* Animated shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      {/* Content */}
      <div className="relative bg-gradient-to-r from-amber-50/90 via-yellow-50/90 to-orange-50/90 rounded-2xl border-2 border-amber-300 p-6">
        {/* Crown badge */}
        <div className="absolute -top-3 -left-3">
          <motion.div
            animate={{ rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full p-3 shadow-lg shadow-amber-300/50"
          >
            <Crown className="h-6 w-6 text-white" />
          </motion.div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4 pl-8">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            King of the Hill
          </span>
          <Flame className="h-4 w-4 text-orange-500" />
        </div>

        <Link href={`/t/${token.address}`} className="block group">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Token Image */}
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-24 h-24 rounded-xl bg-white shadow-lg overflow-hidden border-2 border-amber-200"
              >
                {token.imageUrl || token.logoUrl ? (
                  <Image
                    src={token.imageUrl || token.logoUrl || ''}
                    alt={token.name}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {token.symbol?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Rank badge */}
              <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                #1
              </div>
            </div>

            {/* Token Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-amber-900 group-hover:text-amber-700 transition-colors flex items-center gap-2">
                    {token.name}
                    <ExternalLink className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-amber-600 font-medium">${token.symbol}</p>
                </div>

                {/* Price */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-900">
                    {parseFloat(token.currentPrice || '0').toFixed(7)} XLM
                  </p>
                  {token.priceChange24h && (
                    <p className={`text-sm font-medium ${
                      parseFloat(token.priceChange24h) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {parseFloat(token.priceChange24h) >= 0 ? '+' : ''}
                      {parseFloat(token.priceChange24h).toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-white/80 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-amber-600 mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Market Cap</span>
                  </div>
                  <p className="text-lg font-bold text-amber-900">
                    ${formatCompactNumber(parseFloat(token.marketCap || '0'))}
                  </p>
                </div>

                <div className="bg-white/80 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-amber-600 mb-1">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">24h Volume</span>
                  </div>
                  <p className="text-lg font-bold text-amber-900">
                    {formatCompactNumber(parseFloat(token.volume24h || '0'))} XLM
                  </p>
                </div>

                <div className="bg-white/80 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-amber-600 mb-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">XLM Raised</span>
                  </div>
                  <p className="text-lg font-bold text-amber-900">
                    {formatCompactNumber(parseFloat(token.xlmRaised || '0'))} XLM
                  </p>
                </div>

                <div className="bg-white/80 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-amber-600 mb-1">
                    <Crown className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Graduation</span>
                  </div>
                  <p className="text-lg font-bold text-amber-900">
                    {graduationProgress.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-amber-700 mb-1">
                  <span>Progress to DEX</span>
                  <span>{formatCompactNumber(parseFloat(token.xlmRaised || '0'))} / {formatCompactNumber(GRADUATION_THRESHOLD_XLM)} XLM</span>
                </div>
                <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${graduationProgress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </motion.div>
  );
});
