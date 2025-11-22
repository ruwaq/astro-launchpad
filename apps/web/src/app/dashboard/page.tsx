'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TrendingUp, Rocket, Users, Lock } from 'lucide-react';
import { useGlobalStats } from '@/hooks/useApi';
import { MetricCard } from '@/components/widgets/MetricCard';
import { TokensWidget } from '@/components/widgets/TokensWidget';
import { ActivityWidget } from '@/components/widgets/ActivityWidget';
import { TradingWidget } from '@/components/widgets/TradingWidget';
import { formatCompactNumber } from '@/lib/stellar/utils';
import { useWallet } from '@/contexts/WalletContext';
import toast from 'react-hot-toast';

// Componente para las tarjetas de estadísticas
function StatCard({ title, value, icon: Icon, trend }: {
  title: string;
  value: string;
  icon: any;
  trend?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 border border-ui-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-ui-text-secondary">{title}</p>
          <p className="text-3xl font-bold text-ui-text-primary mt-2">{value}</p>
          {trend && (
            <p className="text-sm text-brand-green mt-2 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {trend}
            </p>
          )}
        </div>
        <div className="p-3 bg-brand-primary-50 rounded-lg">
          <Icon className="h-6 w-6 text-brand-primary" />
        </div>
      </div>
    </div>
  );
}

// ✅ TrendingTokenCard eliminado - usamos TokensWidget que tiene datos reales

export default function DashboardPage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { data: statsData, loading: statsLoading } = useGlobalStats();

  const stats = statsData?.globalStats;

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect wallet');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary">
            Dashboard
          </h1>
          <p className="text-ui-text-secondary mt-1">
            Welcome to Astro Shiba Token Launchpad on Stellar
          </p>
        </div>

        {/* Platform Stats with REAL DATA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Tokens"
            value={stats?.totalTokens || 0}
            loading={statsLoading}
            icon={<Rocket className="h-6 w-6" />}
          />
          <MetricCard
            title="Total Volume"
            value={formatCompactNumber(parseFloat(stats?.totalVolume24h || '0'))}
            change={parseFloat(stats?.totalVolumeChange24h || '0')}
            loading={statsLoading}
            prefix="$"
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <MetricCard
            title="Active Users"
            value={stats?.totalUsers || 0}
            loading={statsLoading}
            icon={<Users className="h-6 w-6" />}
          />
          <MetricCard
            title="Total TVL"
            value={formatCompactNumber(parseFloat(stats?.totalLiquidity || '0'))}
            change={parseFloat(stats?.totalLiquidityChange24h || '0')}
            loading={statsLoading}
            prefix="$"
            icon={<Lock className="h-6 w-6" />}
          />
        </div>

        {/* Connection Notice - Only show if not connected */}
        {!isConnected && (
          <div className="bg-brand-blue-50 border border-brand-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-brand-blue rounded-lg">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-blue-900">
                  Connect Your Wallet
                </h3>
                <p className="text-sm text-brand-blue-700 mt-1">
                  Connect your Stellar wallet to view real-time data from testnet and start creating tokens.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="mt-4 px-6 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trading + Trending Tokens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trading Widget - Full professional swap */}
          <div className="lg:col-span-1">
            <TradingWidget />
          </div>

          {/* Trending Tokens */}
          <div className="lg:col-span-2">
            <TokensWidget />
          </div>
        </div>

        {/* Activity Feed */}
        <div>
          <ActivityWidget />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-brand-primary-50 to-white rounded-xl p-6 border border-brand-primary-100">
            <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="font-bold text-ui-text-primary mb-2">
              Instant Deployment
            </h3>
            <p className="text-sm text-ui-text-secondary">
              Deploy your token in seconds with our optimized SAC Factory
            </p>
          </div>

          <div className="bg-gradient-to-br from-brand-blue-50 to-white rounded-xl p-6 border border-brand-blue-100">
            <div className="w-12 h-12 bg-brand-blue rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🛡️</span>
            </div>
            <h3 className="font-bold text-ui-text-primary mb-2">
              Fair Launch
            </h3>
            <p className="text-sm text-ui-text-secondary">
              Creator must buy tokens like everyone else. No unfair advantages.
            </p>
          </div>

          <div className="bg-gradient-to-br from-brand-green-50 to-white rounded-xl p-6 border border-brand-green-100">
            <div className="w-12 h-12 bg-brand-green rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="font-bold text-ui-text-primary mb-2">
              LP Locked Forever
            </h3>
            <p className="text-sm text-ui-text-secondary">
              Liquidity tokens burned on graduation. Anti-rug guaranteed.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
