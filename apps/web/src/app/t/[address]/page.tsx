/**
 * Token Trading Page - READS DIRECTLY FROM CONTRACT
 *
 * Features (según investigación UX):
 * - Real-time price chart (bonding curve)
 * - Buy/Sell buttons con preset amounts
 * - Recent trades feed
 * - Graduation progress
 * - Live holder count
 *
 * READS FROM STELLAR TESTNET CONTRACT DIRECTLY (no backend needed)
 */

'use client';

// Force dynamic rendering to avoid build-time errors with contract service
export const dynamic = 'force-dynamic';

import { use, useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TradingInterface } from '@/components/trading/TradingInterface';
import { TradingViewChart } from '@/components/charts/TradingViewChart';
import { RecentTrades } from '@/components/trading/RecentTrades';
import { TokenHeader } from '@/components/token/TokenHeader';
import { GraduationProgressAnimated } from '@/components/token/GraduationProgressAnimated';
import { Loader2, AlertCircle } from 'lucide-react';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import type { TokenInfo, AstroConfig } from '@/lib/stellar/services/sac-factory.service';

interface PageProps {
  params: Promise<{ address: string }>;
}

export default function TokenTradingPage({ params }: PageProps) {
  const { address } = use(params);
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [astroConfig, setAstroConfig] = useState<AstroConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch token info and ASTRO config in parallel
        const [tokenInfo, astroConfigResult] = await Promise.all([
          sacFactoryService.getTokenInfo(address),
          sacFactoryService.getAstroConfig(),
        ]);

        if (!tokenInfo) {
          setError('Token not found on Stellar Testnet');
          return;
        }

        setToken(tokenInfo);
        setAstroConfig(astroConfigResult);
      } catch (err: any) {
        console.error('Error fetching token:', err);
        setError(err.message || 'Failed to load token data');
      } finally {
        setLoading(false);
      }
    };

    fetchToken();

    // Refresh every 10 seconds for real-time updates
    const interval = setInterval(fetchToken, 10000);

    return () => clearInterval(interval);
  }, [address]);

  // Loading state
  if (loading && !token) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-brand-primary mx-auto mb-4" />
            <p className="text-ui-text-secondary">Loading token data from Stellar...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error || !token) {
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
                  {error || 'Token not found on Stellar Testnet'}
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

  // Format token data for components (convert to GraphQL-like structure)
  const formattedToken = {
    address: token.token_address,
    name: token.name,
    symbol: token.symbol,
    decimals: 7, // Stellar standard
    totalSupply: '1000000000000000', // 100M tokens * 10^7 decimals
    description: token.description || '',
    creator: token.creator,
    issuer: token.issuer, // Asset issuer for trustline creation
    logoUrl: token.image_url || null,
    currentPrice: '0', // TODO: Calculate from bonding curve
    marketCap: token.market_cap || '0',
    volume24h: '0', // TODO: Get from indexer/database
    priceChange24h: '0', // TODO: Get from indexer/database
    holders: token.holders_count,
    circulatingSupply: token.bonding_curve?.token_reserve || '0',
    xlmRaised: token.xlm_raised,
    xlmReserve: token.bonding_curve?.xlm_reserve || '0',
    graduated: token.status === 'Graduated',
    createdAt: token.created_at.toString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Token Header - Real data */}
        <TokenHeader token={formattedToken} />

        {/* Main Trading Area */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Chart + Trading Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* TradingView-style Price Chart */}
            <TradingViewChart tokenAddress={address} symbol={formattedToken.symbol} />

            {/* Trading Interface - Real buy/sell */}
            <TradingInterface tokenAddress={address} token={formattedToken} />
          </div>

          {/* Right: Stats + Recent Trades */}
          <div className="space-y-6">
            {/* Animated Graduation Progress - Real XLM raised */}
            <GraduationProgressAnimated
              xlmRaised={formattedToken.xlmRaised}
              graduated={formattedToken.graduated}
              threshold={10000} // 10,000 XLM
              tokenSymbol={formattedToken.symbol}
              astroConfig={astroConfig ? {
                liquidityBps: parseInt(astroConfig.liquidity_bps),
                buybackBps: parseInt(astroConfig.buyback_bps),
                enabled: true,
              } : undefined}
            />

            {/* Token Stats - Real data */}
            <div className="bg-white rounded-xl border border-ui-border p-6">
              <h3 className="font-bold text-ui-text-primary mb-4">Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-ui-text-secondary">Current Price</span>
                  <span className="font-semibold">{formattedToken.currentPrice || '0'} XLM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ui-text-secondary">Market Cap</span>
                  <span className="font-semibold">${formattedToken.marketCap || '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ui-text-secondary">24h Volume</span>
                  <span className="font-semibold">{formattedToken.volume24h} XLM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ui-text-secondary">Holders</span>
                  <span className="font-semibold">{formattedToken.holders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ui-text-secondary">Circulating Supply</span>
                  <span className="font-semibold">{formattedToken.circulatingSupply}</span>
                </div>
              </div>
            </div>

            {/* Recent Trades - Real transaction data */}
            <RecentTrades tokenAddress={address} />
          </div>
        </div>

        {/* Token Description */}
        {formattedToken.description && (
          <div className="bg-white rounded-xl border border-ui-border p-6">
            <h3 className="font-bold text-ui-text-primary mb-3">About</h3>
            <p className="text-ui-text-secondary">{formattedToken.description}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
