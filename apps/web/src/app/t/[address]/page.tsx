/**
 * Token Trading Page - WITH FALLBACK SYSTEM
 *
 * Features (según investigación UX):
 * - Real-time price chart (bonding curve)
 * - Buy/Sell buttons con preset amounts (Premium widget)
 * - Recent trades feed with live activity
 * - Graduation progress with animations
 * - Live holder count
 * - Haptic feedback on mobile
 * - Auto-refresh on trade success
 *
 * DATA SOURCES:
 * 1. PRIMARY: Stellar Testnet Contract (real-time, enables trading)
 * 2. FALLBACK: GraphQL API (cached data, read-only mode)
 */

'use client';

// Force dynamic rendering to avoid build-time errors with contract service
export const dynamic = 'force-dynamic';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TradingWidgetPremium } from '@/components/widgets/TradingWidgetPremium';
import { TradingViewChart } from '@/components/charts/TradingViewChart';
import { LiveActivityFeed } from '@/components/activity/LiveActivityFeed';
import { TokenTransactionHistory } from '@/components/transactions/TokenTransactionHistory';
import { TokenHeader } from '@/components/token/TokenHeader';
import { GraduationProgressAnimated } from '@/components/token/GraduationProgressAnimated';
import { Loader2, AlertCircle, Users, DollarSign, TrendingUp, Activity, AlertTriangle, Database, Wifi } from 'lucide-react';
import { WidgetErrorBoundary, CardErrorBoundary } from '@/components/ErrorBoundary';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import type { TokenInfo, AstroConfig } from '@/lib/stellar/services/sac-factory.service';
import { stroopsToXlm, formatStroopsDisplay, formatCompactNumber, GRADUATION_THRESHOLD_XLM } from '@/lib/stellar/utils';
import { apolloClient } from '@/lib/graphql/client';
import { gql } from '@apollo/client';
import type { Token } from '@/lib/graphql/types';

// GraphQL query to fetch token by address (fallback)
const GET_TOKEN_BY_ADDRESS = gql`
  query GetTokenByAddress($address: String!) {
    token(address: $address) {
      address
      name
      symbol
      decimals
      totalSupply
      circulatingSupply
      creator
      currentPrice
      marketCap
      volume24h
      priceChange24h
      holders
      logoUrl
      imageUrl
      description
      graduated
      xlmRaised
      xlmReserve
      createdAt
      updatedAt
    }
  }
`;

// Data source types
type DataSource = 'contract' | 'graphql' | 'none';

interface PageProps {
  params: Promise<{ address: string }>;
}

export default function TokenTradingPage({ params }: PageProps) {
  const { address } = use(params);
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [graphqlToken, setGraphqlToken] = useState<Token | null>(null);
  const [astroConfig, setAstroConfig] = useState<AstroConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('none');

  // FIX: Use ref to track dataSource for polling to avoid race condition
  const dataSourceRef = useRef<DataSource>('none');
  const isMountedRef = useRef(true);

  // Refresh trigger for child components (chart, activity feed)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchToken = useCallback(async (isInitialFetch = false) => {
    if (isInitialFetch) {
      setLoading(true);
      setError(null);
    }

    try {
      // STEP 1: Try to get token from Stellar contract (primary source)
      const results = await Promise.allSettled([
        sacFactoryService.getTokenInfo(address),
        sacFactoryService.getAstroConfig(),
      ]);

      // FIX: Check if still mounted after async operation
      if (!isMountedRef.current) return;

      const [tokenResult, configResult] = results;

      // Handle token info from contract
      if (tokenResult.status === 'fulfilled' && tokenResult.value) {
        // SUCCESS: Token found on chain
        setToken(tokenResult.value);
        setDataSource('contract');
        dataSourceRef.current = 'contract';

        // Handle ASTRO config (optional)
        if (configResult.status === 'fulfilled') {
          setAstroConfig(configResult.value);
        }
        if (isInitialFetch) setLoading(false);
        return;
      }

      // STEP 2: Contract failed - try GraphQL fallback
      console.warn('Token not found in contract, trying GraphQL fallback...');

      try {
        const { data } = await apolloClient.query({
          query: GET_TOKEN_BY_ADDRESS,
          variables: { address },
          fetchPolicy: 'network-only', // Always fetch fresh data
        });

        if (!isMountedRef.current) return;

        if (data?.token) {
          // SUCCESS: Token found in database (but not on chain)
          setGraphqlToken(data.token);
          setDataSource('graphql');
          dataSourceRef.current = 'graphql';
          console.warn('Token loaded from GraphQL (not on Stellar contract)');
          if (isInitialFetch) setLoading(false);
          return;
        }
      } catch (graphqlError) {
        console.error('GraphQL fallback also failed:', graphqlError);
      }

      // STEP 3: Both sources failed
      if (isMountedRef.current) {
        setDataSource('none');
        dataSourceRef.current = 'none';
        setError('Token not found in contract or database');
      }

    } catch (err: any) {
      console.error('Unexpected error fetching token:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load token data');
        setDataSource('none');
        dataSourceRef.current = 'none';
      }
    } finally {
      if (isMountedRef.current && isInitialFetch) {
        setLoading(false);
      }
    }
  }, [address]);

  // FIX: Separate effect for initial fetch (no dataSource dependency)
  useEffect(() => {
    isMountedRef.current = true;
    fetchToken(true);

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchToken]);

  // FIX: Separate effect for polling (uses ref, not state)
  useEffect(() => {
    // PERFORMANCE: Only poll if we have contract data (live trading)
    // GraphQL fallback data is read-only, no need to poll
    const interval = setInterval(() => {
      if (dataSourceRef.current === 'contract') {
        fetchToken(false);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchToken]);

  // Loading state - Skeleton matches final layout to prevent CLS
  if (loading && !token && !graphqlToken) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
          {/* Token Header Skeleton - 120px */}
          <div className="bg-white rounded-xl border border-ui-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-gray-200 rounded w-48" />
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
              <div className="h-10 bg-gray-200 rounded-lg w-32" />
            </div>
          </div>

          {/* Main Trading Area Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Chart + Trading */}
            <div className="lg:col-span-2 space-y-6">
              {/* BondingCurveChart Skeleton - 224px */}
              <div className="bg-white rounded-xl border border-ui-border p-4">
                <div className="flex justify-between mb-4">
                  <div className="h-8 bg-gray-200 rounded w-32" />
                  <div className="h-6 bg-gray-200 rounded w-24" />
                </div>
                <div className="h-24 bg-gray-100 rounded-lg mb-3" />
                <div className="h-2 bg-gray-200 rounded" />
              </div>

              {/* TradingWidgetPremium Skeleton - 300px */}
              <div className="bg-white rounded-xl border border-ui-border p-6">
                <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="h-12 bg-gray-200 rounded-lg flex-1" />
                    <div className="h-12 bg-gray-200 rounded-lg flex-1" />
                  </div>
                  <div className="h-16 bg-gray-100 rounded-lg" />
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-10 bg-gray-200 rounded-lg" />
                    ))}
                  </div>
                  <div className="h-14 bg-brand-primary/20 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Right Column - Stats + Activity */}
            <div className="space-y-6">
              {/* GraduationProgress Skeleton - 200px */}
              <div className="bg-white rounded-xl border border-ui-border p-6">
                <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-3 bg-gray-100 rounded-full mb-4" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-16 bg-gray-100 rounded-lg" />
                  <div className="h-16 bg-gray-100 rounded-lg" />
                </div>
              </div>

              {/* Token Stats Skeleton - 280px */}
              <div className="bg-white rounded-xl border border-ui-border overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-ui-border">
                  <div className="h-5 bg-gray-200 rounded w-28" />
                </div>
                <div className="p-4 space-y-4">
                  <div className="h-14 bg-gray-100 rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 bg-gray-100 rounded-lg" />
                    <div className="h-20 bg-gray-100 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 bg-gray-100 rounded-lg" />
                    <div className="h-20 bg-gray-100 rounded-lg" />
                  </div>
                </div>
              </div>

              {/* LiveActivityFeed Skeleton - 300px */}
              <div className="bg-white rounded-xl border border-ui-border p-6">
                <div className="flex justify-between mb-4">
                  <div className="h-5 bg-gray-200 rounded w-28" />
                  <div className="h-4 bg-green-200 rounded w-16" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <div className="h-4 bg-gray-200 rounded w-24" />
                        <div className="h-3 bg-gray-100 rounded w-16" />
                      </div>
                      <div className="h-3 bg-gray-200 rounded w-12" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state - only show if NO data source is available
  if (error && dataSource === 'none') {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-12">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">
                  Failed to Load Token
                </h3>
                <p className="text-sm text-red-700 mb-4">
                  {error || 'Token not found'}
                </p>
                <div className="flex flex-col gap-2 text-xs text-red-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    <span>Contract: Not found</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>Database: Not found</span>
                  </div>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Determine if we have valid data to display
  const hasContractData = dataSource === 'contract' && token;
  const hasGraphqlData = dataSource === 'graphql' && graphqlToken;
  const isReadOnlyMode = hasGraphqlData && !hasContractData;

  // Guard: If no data from any source, show error (shouldn't happen after loading, but safety first)
  if (!hasContractData && !hasGraphqlData && !loading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-12">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">Token Not Found</h3>
                <p className="text-sm text-red-700 mb-4">
                  This token could not be found in either the Stellar contract or the database.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Format token data for components based on data source
  const formattedToken = hasContractData
    ? {
        // CONTRACT DATA (primary source)
        address: token!.token_address,
        name: token!.name,
        symbol: token!.symbol,
        decimals: 7,
        totalSupply: '1000000000000000',
        description: token!.description || '',
        creator: token!.creator,
        issuer: token!.issuer,
        logoUrl: token!.image_url || null,
        currentPrice: '0',
        marketCap: token!.market_cap || '0',
        volume24h: '0',
        priceChange24h: '0',
        holders: token!.holders_count,
        circulatingSupply: token!.bonding_curve?.token_reserve || '0',
        xlmRaised: token!.xlm_raised,
        xlmReserve: token!.bonding_curve?.xlm_reserve || '0',
        graduated: token!.status === 'Graduated',
        createdAt: token!.created_at.toString(),
        updatedAt: new Date().toISOString(),
      }
    : {
        // GRAPHQL DATA (fallback)
        address: graphqlToken!.address,
        name: graphqlToken!.name,
        symbol: graphqlToken!.symbol,
        decimals: graphqlToken!.decimals || 7,
        totalSupply: graphqlToken!.totalSupply || '1000000000000000',
        description: graphqlToken!.description || '',
        creator: graphqlToken!.creator,
        issuer: '', // Not available in GraphQL
        logoUrl: graphqlToken!.logoUrl || graphqlToken!.imageUrl || null,
        currentPrice: graphqlToken!.currentPrice || '0',
        marketCap: graphqlToken!.marketCap || '0',
        volume24h: graphqlToken!.volume24h || '0',
        priceChange24h: graphqlToken!.priceChange24h || '0',
        holders: graphqlToken!.holders || 0,
        circulatingSupply: graphqlToken!.circulatingSupply || '0',
        xlmRaised: graphqlToken!.xlmRaised || '0',
        xlmReserve: graphqlToken!.xlmReserve || '0',
        graduated: graphqlToken!.graduated || false,
        createdAt: graphqlToken!.createdAt,
        updatedAt: graphqlToken!.updatedAt || new Date().toISOString(),
      };

  // Use stroopsToXlm for converting raw contract values
  const xlmRaisedFormatted = stroopsToXlm(formattedToken.xlmRaised);
  const xlmRaisedNumber = parseFloat(xlmRaisedFormatted);

  // Calculate price from reserves (only for contract data)
  // Formula: (xlm_reserve * 10^7) / token_reserve / 10^7 = xlm_reserve / token_reserve
  // Both reserves are in stroops (7 decimals), so this gives price in XLM per token
  const currentPrice = hasContractData && token?.bonding_curve
    ? (Number(token.bonding_curve.xlm_reserve) / Number(token.bonding_curve.token_reserve || 1)).toFixed(7)
    : (parseFloat(formattedToken.currentPrice) || 0).toFixed(7);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Read-Only Mode Warning Banner */}
        {isReadOnlyMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 text-sm">
                  Read-Only Mode - Token Not On Chain
                </h3>
                <p className="text-xs text-amber-700 mt-1">
                  This token exists in the database but is not found on the current Stellar contract.
                  Trading is disabled. The token may have been created with an old contract or needs to be recreated.
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <div className="flex items-center gap-1 text-amber-700">
                    <Database className="h-3.5 w-3.5" />
                    <span>Database: Found</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-600">
                    <Wifi className="h-3.5 w-3.5" />
                    <span>Contract: Not Found</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Token Header - Real data */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TokenHeader token={formattedToken} />
        </motion.div>

        {/* Main Trading Area */}
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left: Chart + Trading Widget */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 flex flex-col gap-4 lg:gap-6"
          >
            {/* Premium Trading Widget - MOBILE FIRST: Action before chart */}
            <div className="order-1 lg:order-2">
              <WidgetErrorBoundary>
                <TradingWidgetPremium
                  tokenAddress={address}
                  tokenSymbol={formattedToken.symbol}
                  tokenName={formattedToken.name}
                  tokenImage={formattedToken.logoUrl || undefined}
                  disabled={isReadOnlyMode || undefined}
                  onTradeSuccess={(type, amount) => {
                    console.log(`Trade success: ${type} ${amount}`);
                    // Trigger immediate refresh of all data
                    fetchToken(false);
                    setRefreshTrigger(prev => prev + 1);
                  }}
                />
              </WidgetErrorBoundary>
            </div>

            {/* TradingView Chart - Real-time price chart */}
            <div className="order-2 lg:order-1">
              {!isReadOnlyMode ? (
                <CardErrorBoundary>
                  <TradingViewChart
                    tokenAddress={address}
                    symbol={formattedToken.symbol}
                    refreshTrigger={refreshTrigger}
                  />
                </CardErrorBoundary>
              ) : (
                <div className="bg-gray-100 rounded-xl border border-ui-border p-6 lg:p-8 text-center">
                  <div className="text-gray-400 mb-2">
                    <TrendingUp className="h-10 w-10 lg:h-12 lg:w-12 mx-auto opacity-50" />
                  </div>
                  <p className="text-sm text-ui-text-secondary">
                    Chart unavailable in read-only mode
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Right: Stats + Activity Feed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4 lg:space-y-6"
          >
            {/* Animated Graduation Progress - Real XLM raised */}
            <GraduationProgressAnimated
              xlmRaised={xlmRaisedNumber}
              graduated={formattedToken.graduated}
              threshold={GRADUATION_THRESHOLD_XLM}
              tokenSymbol={formattedToken.symbol}
              astroConfig={astroConfig ? {
                liquidityBps: parseInt(astroConfig.liquidity_bps),
                buybackBps: parseInt(astroConfig.buyback_bps),
                enabled: true,
              } : undefined}
            />

            {/* Token Stats - Real data with premium design */}
            <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-brand-primary/5 to-brand-blue/5 border-b border-ui-border">
                <h3 className="font-bold text-ui-text-primary flex items-center gap-2">
                  <Activity className="h-5 w-5 text-brand-primary" />
                  Token Stats
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-ui-text-secondary">Current Price</span>
                  </div>
                  <span className="font-bold text-lg">{currentPrice} XLM</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-ui-text-secondary mb-1">Market Cap</p>
                    <p className="font-bold text-lg">${formatStroopsDisplay(formattedToken.marketCap, { compact: true })}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-ui-text-secondary mb-1">XLM Raised</p>
                    <p className="font-bold text-lg">{formatCompactNumber(xlmRaisedNumber)} XLM</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <Users className="h-3 w-3 text-brand-blue" />
                      <p className="text-xs text-ui-text-secondary">Holders</p>
                    </div>
                    <p className="font-bold text-lg">{formattedToken.holders}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="h-3 w-3 text-purple-600" />
                      <p className="text-xs text-ui-text-secondary">Supply</p>
                    </div>
                    <p className="font-bold text-lg">{formatStroopsDisplay(formattedToken.circulatingSupply, { compact: true })}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Activity Feed - Real-time transactions */}
            {/* PERFORMANCE: pollInterval increased from 3s to 15s to reduce API load */}
            <LiveActivityFeed
              tokenAddress={address}
              maxItems={8}
              pollInterval={15000}
              refreshTrigger={refreshTrigger}
            />

            {/* Token Trade History */}
            <TokenTransactionHistory
              tokenAddress={address}
              tokenSymbol={formattedToken.symbol}
              limit={20}
              refreshTrigger={refreshTrigger}
            />
          </motion.div>
        </div>

        {/* Token Description */}
        {formattedToken.description && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl border border-ui-border p-6"
          >
            <h3 className="font-bold text-ui-text-primary mb-3">About</h3>
            <p className="text-ui-text-secondary">{formattedToken.description}</p>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
