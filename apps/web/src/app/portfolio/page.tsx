'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Wallet, TrendingUp, Clock } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useUserTransactions } from '@/hooks/useApi';
import { TransactionHistory } from '@/components/transactions/TransactionHistory';
import { formatCompactNumber, truncateAddress } from '@/lib/stellar/utils';
import toast from 'react-hot-toast';

type TabType = 'holdings' | 'created' | 'history';

export default function PortfolioPage() {
  const { isConnected, connect, isConnecting, address } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>('holdings');

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected successfully!');
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
            Portfolio
          </h1>
          <p className="text-ui-text-secondary mt-1">
            Manage your tokens and track performance
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-ui-border">
          <div className="flex gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('holdings')}
              className={`px-4 py-3 border-b-2 font-medium whitespace-nowrap transition-colors ${
                activeTab === 'holdings'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-ui-text-secondary hover:text-ui-text-primary'
              }`}
            >
              Holdings
            </button>
            <button
              onClick={() => setActiveTab('created')}
              className={`px-4 py-3 border-b-2 font-medium whitespace-nowrap transition-colors ${
                activeTab === 'created'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-ui-text-secondary hover:text-ui-text-primary'
              }`}
            >
              Created Tokens
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 border-b-2 font-medium whitespace-nowrap transition-colors ${
                activeTab === 'history'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-ui-text-secondary hover:text-ui-text-primary'
              }`}
            >
              Trade History
            </button>
          </div>
        </div>

        {/* Connection Required */}
        {!isConnected ? (
          <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-brand-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wallet className="h-10 w-10 text-brand-primary" />
              </div>
              <h3 className="text-xl font-bold text-ui-text-primary mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-ui-text-secondary mb-6">
                Connect your Stellar wallet to view your portfolio and manage your tokens
              </p>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>

              {/* Portfolio Preview */}
              <div className="mt-12 pt-8 border-t border-ui-border opacity-50">
                <h4 className="font-semibold text-ui-text-primary mb-4">
                  What you&apos;ll see after connecting:
                </h4>
                <div className="space-y-3 text-left">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-brand-primary-100 rounded-full flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-brand-primary" />
                    </div>
                    <span className="text-ui-text-secondary">
                      Your token holdings and balances
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-brand-blue-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-brand-blue" />
                    </div>
                    <span className="text-ui-text-secondary">
                      Profit & Loss tracking
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-brand-green-100 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-brand-green" />
                    </div>
                    <span className="text-ui-text-secondary">
                      Complete trade history
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <PortfolioContent address={address!} activeTab={activeTab} />
        )}
      </div>
    </DashboardLayout>
  );
}

function PortfolioContent({ address, activeTab }: { address: string; activeTab: TabType }) {
  const { data: txData } = useUserTransactions(address, 50);
  const transactions = txData?.transactions.edges || [];

  // Calculate portfolio stats
  const totalTransactions = transactions.length;
  const totalVolume = transactions.reduce((sum: number, { node }: any) => {
    return sum + parseFloat(node.amountUSD || '0');
  }, 0);

  const buyCount = transactions.filter(({ node }: any) => node.type === 'BUY').length;
  const sellCount = transactions.filter(({ node }: any) => node.type === 'SELL').length;

  return (
    <>
      {/* Wallet Info Card */}
      <div className="bg-gradient-to-br from-brand-primary to-brand-blue text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90 mb-1">Wallet Address</p>
            <p className="text-xl font-bold">{truncateAddress(address, 8)}</p>
          </div>
          <button
            className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors backdrop-blur-sm"
            onClick={() => {
              navigator.clipboard.writeText(address);
              toast.success('Address copied to clipboard!');
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-ui-border">
          <p className="text-sm font-medium text-ui-text-secondary mb-1">Total Volume</p>
          <p className="text-2xl font-bold text-ui-text-primary">
            ${formatCompactNumber(totalVolume)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-ui-border">
          <p className="text-sm font-medium text-ui-text-secondary mb-1">Total Transactions</p>
          <p className="text-2xl font-bold text-ui-text-primary">{totalTransactions}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-ui-border">
          <p className="text-sm font-medium text-ui-text-secondary mb-1">Buys</p>
          <p className="text-2xl font-bold text-brand-green">{buyCount}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-ui-border">
          <p className="text-sm font-medium text-ui-text-secondary mb-1">Sells</p>
          <p className="text-2xl font-bold text-red-600">{sellCount}</p>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'holdings' && <HoldingsTab address={address} transactions={transactions} />}
      {activeTab === 'created' && <CreatedTokensTab address={address} />}
      {activeTab === 'history' && <TradeHistoryTab address={address} />}
    </>
  );
}

// Holdings Tab Component
function HoldingsTab({ address, transactions }: { address: string; transactions: any[] }) {
  // For now, derive holdings from transaction history
  // In production, this should query SAC token balances directly
  const tokenAddresses = new Set<string>();

  transactions.forEach(({ node }: any) => {
    if (node.tokenAddress) {
      tokenAddresses.add(node.tokenAddress);
    }
  });

  const uniqueTokens = Array.from(tokenAddresses);

  if (uniqueTokens.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-brand-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wallet className="h-10 w-10 text-brand-primary" />
          </div>
          <h3 className="text-xl font-bold text-ui-text-primary mb-2">
            No Holdings Yet
          </h3>
          <p className="text-ui-text-secondary mb-6">
            Start trading tokens to build your portfolio
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/explore"
              className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium"
            >
              Explore Tokens
            </a>
            <a
              href="/create"
              className="px-6 py-3 bg-white text-brand-primary border-2 border-brand-primary rounded-lg hover:bg-brand-primary-50 transition-colors font-medium"
            >
              Create Token
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ui-text-primary">
          Your Token Holdings
        </h3>
        <span className="text-sm text-ui-text-secondary">
          {uniqueTokens.length} {uniqueTokens.length === 1 ? 'token' : 'tokens'}
        </span>
      </div>

      <div className="bg-brand-blue-50 border border-brand-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-brand-blue rounded-lg">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-brand-blue-900">
              Holdings data based on transaction history
            </p>
            <p className="text-xs text-brand-blue-700 mt-1">
              Full balance tracking coming soon. Currently showing tokens you&apos;ve traded.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {uniqueTokens.map((tokenAddress) => (
          <HoldingCard key={tokenAddress} tokenAddress={tokenAddress} />
        ))}
      </div>
    </div>
  );
}

// Individual Holding Card
function HoldingCard({ tokenAddress }: { tokenAddress: string }) {
  return (
    <a
      href={`/tokens/${tokenAddress}`}
      className="block bg-white rounded-xl p-4 border border-ui-border hover:border-brand-primary transition-all hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-blue rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
          T
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ui-text-primary truncate">
            Token
          </p>
          <p className="text-xs text-ui-text-secondary truncate">
            {truncateAddress(tokenAddress, 6)}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-ui-border">
        <p className="text-xs text-ui-text-secondary">Balance</p>
        <p className="text-sm font-semibold text-ui-text-primary">--</p>
      </div>
    </a>
  );
}

// Created Tokens Tab Component
function CreatedTokensTab({ address }: { address: string }) {
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<any[]>([]);

  const fetchCreatedTokens = async () => {
    setLoading(true);
    try {
      const { sacFactoryService } = await import('@/lib/stellar/services/sac-factory.service');

      // Get tokens created by this address
      const tokenAddresses = await sacFactoryService.getCreatorTokensPaginated(address, 0, 20);

      if (tokenAddresses.length === 0) {
        setTokens([]);
        setLoading(false);
        return;
      }

      // Fetch detailed info for each token
      const tokenPromises = tokenAddresses.map(addr =>
        sacFactoryService.getTokenInfo(addr)
      );

      const tokenInfos = await Promise.all(tokenPromises);
      const validTokens = tokenInfos.filter(t => t !== null);

      setTokens(validTokens);
    } catch (error: any) {
      console.error('Error fetching created tokens:', error);
      toast.error('Failed to load created tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreatedTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
        <Clock className="h-12 w-12 text-brand-primary animate-spin mx-auto mb-4" />
        <p className="text-ui-text-secondary">Loading your created tokens...</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-brand-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="h-10 w-10 text-brand-primary" />
          </div>
          <h3 className="text-xl font-bold text-ui-text-primary mb-2">
            No Tokens Created Yet
          </h3>
          <p className="text-ui-text-secondary mb-6">
            Launch your first token and start building your community
          </p>
          <a
            href="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium"
          >
            Create Your First Token
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ui-text-primary">
          Tokens You Created
        </h3>
        <span className="text-sm text-ui-text-secondary">
          {tokens.length} {tokens.length === 1 ? 'token' : 'tokens'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tokens.map((token: any) => (
          <CreatedTokenCard key={token.token_address} token={token} />
        ))}
      </div>
    </div>
  );
}

// Created Token Card Component
function CreatedTokenCard({ token }: { token: any }) {
  const { formatCompactNumber, stroopsToXlm } = require('@/lib/stellar/utils');

  const graduationProgress = Math.min(
    (Number(token.xlm_raised) / 10000) * 100,
    100
  );

  return (
    <a
      href={`/tokens/${token.token_address}`}
      className="block bg-white rounded-xl p-5 border border-ui-border hover:border-brand-primary transition-all hover:shadow-md"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {token.symbol.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-ui-text-primary truncate">
            {token.name}
          </h4>
          <p className="text-sm text-ui-text-secondary">${token.symbol}</p>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${
            token.status === 'Bonding'
              ? 'bg-brand-blue-50 text-brand-blue'
              : 'bg-brand-green-50 text-brand-green'
          }`}
        >
          {token.status}
        </span>
      </div>

      {/* Graduation Progress */}
      {token.status === 'Bonding' && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-ui-text-secondary mb-2">
            <span>Graduation Progress</span>
            <span>{graduationProgress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-brand-primary to-brand-blue h-2 rounded-full transition-all"
              style={{ width: `${graduationProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-ui-border">
        <div>
          <p className="text-xs text-ui-text-secondary">XLM Raised</p>
          <p className="text-sm font-semibold text-ui-text-primary">
            {formatCompactNumber(parseFloat(stroopsToXlm(token.xlm_raised)))} XLM
          </p>
        </div>
        <div>
          <p className="text-xs text-ui-text-secondary">Holders</p>
          <p className="text-sm font-semibold text-ui-text-primary">
            {token.holders_count || 0}
          </p>
        </div>
      </div>
    </a>
  );
}

// Trade History Tab Component
function TradeHistoryTab({ address }: { address: string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-ui-text-primary">
        Your Trade History
      </h3>
      <TransactionHistory userAddress={address} limit={50} />
    </div>
  );
}
