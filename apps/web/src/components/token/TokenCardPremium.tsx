/**
 * TokenCard Premium Component
 *
 * Enhanced token card with:
 * - Framer Motion animations
 * - FOMO-inducing badges (trending, new, graduating)
 * - Real-time price animations
 * - Hover effects and micro-interactions
 * - Mobile-optimized touch targets
 *
 * Supports both:
 * - Direct token data via `token` prop (for GraphQL data)
 * - Fetching via `tokenAddress` prop (for contract data)
 */

'use client';

import { useState, useEffect, useMemo, memo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Flame,
  Sparkles,
  GraduationCap,
  Heart,
  Share2,
  Zap,
} from 'lucide-react';
import { useToken } from '@/hooks/useToken';
import { usePrice } from '@/hooks/usePrice';
import { stroopsToXlm, formatCompactNumber, GRADUATION_THRESHOLD_XLM } from '@/lib/stellar/utils';
import { getIpfsUrl as getImageUrl } from '@/lib/utils/ipfs';

// Token data from GraphQL query (compatible with Token type from lib/graphql/types)
interface GraphQLToken {
  address: string;
  name?: string;
  symbol?: string;
  imageUrl?: string | null;
  logoUrl?: string | null;
  currentPrice?: string;
  priceChange24h?: string | number;
  volume24h?: string;
  marketCap?: string;
  circulatingSupply?: string;
  xlmRaised?: string;
  xlmReserve?: string;
  graduated?: boolean;
  createdAt?: string;
}

interface TokenCardPremiumProps {
  /** Token address - if provided without token data, will fetch from contract */
  tokenAddress?: string;
  /** Pre-loaded token data from GraphQL - preferred for list views */
  token?: GraphQLToken;
  compact?: boolean;
  onClick?: () => void;
  trendingRank?: number;
  isNew?: boolean;
  showQuickActions?: boolean;
}

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: { duration: 0.2 },
  },
  tap: {
    scale: 0.98,
  },
};

const priceVariants = {
  increase: {
    color: '#22c55e',
    scale: [1, 1.15, 1],
    transition: { duration: 0.3 },
  },
  decrease: {
    color: '#ef4444',
    scale: [1, 0.95, 1],
    transition: { duration: 0.3 },
  },
  neutral: {
    scale: 1,
  },
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 500, damping: 25 },
  },
};

const progressVariants = {
  initial: { width: 0 },
  animate: (progress: number) => ({
    width: `${progress}%`,
    transition: { duration: 0.8, ease: 'easeOut' as const },
  }),
};

// PERFORMANCE: Memoized to prevent unnecessary re-renders in token lists
export const TokenCardPremium = memo(function TokenCardPremium({
  tokenAddress,
  token: tokenProp,
  compact = false,
  onClick,
  trendingRank,
  isNew = false,
  showQuickActions = true,
}: TokenCardPremiumProps) {
  // Use provided token data or fetch from contract
  const address = tokenProp?.address || tokenAddress || '';
  const shouldFetch = !tokenProp && !!tokenAddress;

  const { token: fetchedToken, isLoading: isFetching, error: fetchError } = useToken(
    shouldFetch ? tokenAddress : null,
    { refreshInterval: 30000 }
  );

  // Use price hook only when fetching from contract (not for GraphQL data)
  // PERFORMANCE: Increased interval from 5s to 30s to reduce API load
  const { price: contractPrice, priceDirection: contractPriceDirection, priceChange24h: contractPriceChange } = usePrice(
    shouldFetch ? tokenAddress : null,
    { interval: 30000 }
  );

  const router = useRouter();
  const [previousPrice, setPreviousPrice] = useState<bigint | null>(null);
  const [priceAnimation, setPriceAnimation] = useState<'increase' | 'decrease' | 'neutral'>('neutral');
  const [isLiked, setIsLiked] = useState(false);

  // Handler for Quick Buy - navigate to token page
  const handleQuickBuy = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/t/${address}`);
  }, [router, address]);

  // Handler for Share - use Web Share API or copy link
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const tokenName = tokenProp?.name || fetchedToken?.name || 'Token';
    const tokenSymbol = tokenProp?.symbol || fetchedToken?.symbol || '';
    const shareUrl = `${window.location.origin}/t/${address}`;
    const shareData = {
      title: tokenSymbol ? `${tokenName} ($${tokenSymbol})` : tokenName,
      text: `Check out ${tokenName} on Astro Shiba!`,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      // User cancelled share or error
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    }
  }, [address, tokenProp?.name, tokenProp?.symbol, fetchedToken?.name, fetchedToken?.symbol]);

  // Normalize token data from either source
  const token = useMemo(() => {
    if (tokenProp) {
      // GraphQL data - normalize to common format
      return {
        token_address: tokenProp.address,
        name: tokenProp.name || 'Unknown',
        symbol: tokenProp.symbol || '???',
        image_url: getImageUrl(tokenProp.imageUrl || tokenProp.logoUrl) || '',
        market_cap: tokenProp.marketCap || '0',
        xlm_raised: tokenProp.xlmRaised || '0',
        xlm_reserve: tokenProp.xlmReserve || '0',
        holders_count: 0, // Not available in GraphQL
        status: tokenProp.graduated ? 'Graduated' : 'Bonding',
        bonding_curve: {
          xlm_reserve: tokenProp.xlmReserve || '0',
          token_reserve: tokenProp.circulatingSupply || '0',
        },
        // For GraphQL data, use provided price
        currentPrice: tokenProp.currentPrice || '0',
        priceChange24h: typeof tokenProp.priceChange24h === 'string'
          ? parseFloat(tokenProp.priceChange24h)
          : tokenProp.priceChange24h || 0,
      };
    }
    if (fetchedToken) {
      // Contract data
      return {
        ...fetchedToken,
        currentPrice: contractPrice.toString(),
        priceChange24h: contractPriceChange,
      };
    }
    return null;
  }, [tokenProp, fetchedToken, contractPrice, contractPriceChange]);

  const isLoading = !tokenProp && isFetching;
  const error = !tokenProp ? fetchError : null;

  // Price direction from GraphQL or contract
  const priceDirection = useMemo(() => {
    if (tokenProp?.priceChange24h) {
      const change = typeof tokenProp.priceChange24h === 'string'
        ? parseFloat(tokenProp.priceChange24h)
        : tokenProp.priceChange24h;
      return change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    }
    return contractPriceDirection || 'stable';
  }, [tokenProp, contractPriceDirection]);

  const priceChange24h = useMemo(() => {
    if (tokenProp?.priceChange24h) {
      return typeof tokenProp.priceChange24h === 'string'
        ? parseFloat(tokenProp.priceChange24h)
        : tokenProp.priceChange24h;
    }
    return contractPriceChange;
  }, [tokenProp, contractPriceChange]);

  // Detect price changes for animation (contract mode only)
  const price = BigInt(token?.currentPrice || '0');
  useEffect(() => {
    if (!shouldFetch) return;
    if (previousPrice !== null && price !== previousPrice) {
      setPriceAnimation(price > previousPrice ? 'increase' : 'decrease');
      const timer = setTimeout(() => setPriceAnimation('neutral'), 500);
      return () => clearTimeout(timer);
    }
    setPreviousPrice(price);
  }, [price, previousPrice, shouldFetch]);

  // Calculate graduation progress using centralized constant
  const graduationData = useMemo(() => {
    if (!token) return { percent: 0, isNearGraduation: false, isGraduated: false };

    const xlmRaised = parseFloat(stroopsToXlm(token.xlm_raised)); // Convert from stroops
    const percent = Math.min((xlmRaised / GRADUATION_THRESHOLD_XLM) * 100, 100);

    return {
      percent,
      isNearGraduation: percent >= 80 && percent < 100,
      isGraduated: token.status === 'Graduated',
    };
  }, [token]);

  // Format values using utility functions
  const formattedPrice = useMemo(() => {
    if (!token) return '0';
    return stroopsToXlm(token.currentPrice, 7);
  }, [token]);

  const formattedMarketCap = useMemo(() => {
    if (!token) return '0';
    const mcap = parseFloat(stroopsToXlm(token.market_cap));
    return formatCompactNumber(mcap);
  }, [token]);

  // Loading skeleton with shimmer
  if (isLoading || !token) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-4 overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg animate-shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/2 animate-shimmer" />
            <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/3 animate-shimmer" />
          </div>
        </div>
        {!compact && (
          <div className="mt-4 space-y-2">
            <div className="h-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-shimmer" />
            <div className="h-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-2/3 animate-shimmer" />
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

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      className="relative"
    >
      <Link
        href={`/t/${address}`}
        onClick={onClick}
        className="block bg-white rounded-xl border border-ui-border hover:border-brand-primary hover:shadow-xl transition-shadow duration-200 overflow-hidden group"
      >
        <div className="p-4">
          {/* Badges Row */}
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex gap-0.5 sm:gap-1 z-10">
            <AnimatePresence>
              {trendingRank && trendingRank <= 10 && (
                <motion.div
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg"
                >
                  <Flame className="h-3 w-3" />
                  #{trendingRank}
                </motion.div>
              )}
              {isNew && (
                <motion.div
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg"
                >
                  <Sparkles className="h-3 w-3" />
                  NEW
                </motion.div>
              )}
              {graduationData.isNearGraduation && (
                <motion.div
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse"
                >
                  <Zap className="h-3 w-3" />
                  GRADUATING
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Header */}
          <div className="flex items-start gap-3">
            {/* Token Image with ring effect on hover */}
            <motion.div
              className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 ring-2 ring-transparent group-hover:ring-brand-primary/30 transition-all duration-300"
              whileHover={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src={token.image_url || '/images/default-token.svg'}
                alt={token.name}
                fill
                className="object-cover"
                sizes="48px"
                unoptimized={true}
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/default-token.svg';
                }}
              />
            </motion.div>

            {/* Token Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-ui-text-primary truncate group-hover:text-brand-primary transition-colors">
                    {token.name}
                  </h3>
                  <p className="text-sm text-ui-text-secondary">${token.symbol}</p>
                </div>

                {/* Price Change Badge */}
                <AnimatePresence mode="wait">
                  {priceDirection === 'up' && (
                    <motion.div
                      key="up"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full"
                    >
                      <TrendingUp className="h-3 w-3" />
                      +{priceChange24h.toFixed(1)}%
                    </motion.div>
                  )}
                  {priceDirection === 'down' && (
                    <motion.div
                      key="down"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full"
                    >
                      <TrendingDown className="h-3 w-3" />
                      {priceChange24h.toFixed(1)}%
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Price with Animation */}
          <div className="mt-3">
            <motion.div
              variants={priceVariants}
              animate={priceAnimation}
              className="text-xl sm:text-2xl font-bold text-ui-text-primary"
            >
              {formattedPrice} <span className="text-xs sm:text-sm font-normal text-ui-text-secondary">XLM</span>
            </motion.div>
          </div>

          {/* Stats Grid - always 3 columns */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-3">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-ui-text-secondary">Market Cap</p>
              <p className="font-semibold text-sm truncate">${formattedMarketCap}</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-ui-text-secondary">Holders</p>
              <p className="font-semibold text-sm">{token.holders_count || '-'}</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-ui-text-secondary">XLM Reserve</p>
              <p className="font-semibold text-sm truncate">{formatCompactNumber(parseFloat(stroopsToXlm(token.xlm_reserve || '0')))}</p>
            </div>
          </div>

          {/* Graduation Progress */}
          {!graduationData.isGraduated ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ui-text-secondary">Bonding Curve</span>
                <span className={`font-bold ${graduationData.isNearGraduation ? 'text-orange-500 animate-pulse' : 'text-brand-primary'}`}>
                  {graduationData.percent.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  custom={graduationData.percent}
                  variants={progressVariants}
                  initial="initial"
                  animate="animate"
                  className={`h-full rounded-full ${
                    graduationData.isNearGraduation
                      ? 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 animate-pulse'
                      : graduationData.percent > 50
                      ? 'bg-gradient-to-r from-green-500 via-yellow-500 to-orange-500'
                      : 'bg-gradient-to-r from-brand-primary to-brand-blue'
                  }`}
                />
              </div>
              {graduationData.isNearGraduation && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-orange-500 mt-1 font-medium text-center"
                >
                  ⚡ Almost graduating to DEX!
                </motion.p>
              )}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg py-2"
            >
              <GraduationCap className="h-5 w-5 text-green-600" />
              <span className="text-sm font-bold text-green-700">GRADUATED TO DEX</span>
            </motion.div>
          )}

          {/* Quick Actions (visible on hover) */}
          {showQuickActions && !compact && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2 mt-4 pt-4 border-t border-ui-border opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <button
                className="flex-1 flex items-center justify-center gap-2 bg-brand-primary text-white font-semibold py-2.5 sm:py-2 px-4 min-h-[44px] rounded-lg hover:bg-brand-primary/90 transition-colors"
                onClick={handleQuickBuy}
              >
                <Zap className="h-4 w-4" />
                Quick Buy
              </button>
              <button
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-ui-border hover:bg-gray-50 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setIsLiked(!isLiked);
                }}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
              </button>
              <button
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-ui-border hover:bg-gray-50 transition-colors"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 text-gray-400" />
              </button>
            </motion.div>
          )}

          {/* Social Stats (compact mode) */}
          {!compact && (
            <div className="flex items-center gap-4 mt-3 text-xs text-ui-text-secondary">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{token.holders_count} holders</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>{formatCompactNumber(parseFloat(stroopsToXlm(token.xlm_raised)))} XLM</span>
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
});

TokenCardPremium.displayName = 'TokenCardPremium';

export default TokenCardPremium;
