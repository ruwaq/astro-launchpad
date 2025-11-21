'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Wallet, TrendingUp, Clock } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useUserTransactions } from '@/hooks/useApi';
import { TransactionHistory } from '@/components/transactions/TransactionHistory';
import { formatCompactNumber, truncateAddress } from '@/lib/stellar/utils';

export default function PortfolioPage() {
  const { isConnected, connect, isConnecting, address } = useWallet();

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
            <button className="px-4 py-3 border-b-2 border-brand-primary text-brand-primary font-medium whitespace-nowrap">
              Holdings
            </button>
            <button className="px-4 py-3 border-b-2 border-transparent text-ui-text-secondary hover:text-ui-text-primary font-medium whitespace-nowrap">
              Created Tokens
            </button>
            <button className="px-4 py-3 border-b-2 border-transparent text-ui-text-secondary hover:text-ui-text-primary font-medium whitespace-nowrap">
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
                Connect your Freighter wallet to view your portfolio and manage your tokens
              </p>
              <button
                onClick={connect}
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
          <PortfolioContent address={address!} />
        )}
      </div>
    </DashboardLayout>
  );
}

function PortfolioContent({ address }: { address: string }) {
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
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90 mb-1">Wallet Address</p>
            <p className="text-xl font-bold">{truncateAddress(address, 8)}</p>
          </div>
          <button
            className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors backdrop-blur-sm"
            onClick={() => navigator.clipboard.writeText(address)}
          >
            Copy
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-ui-border">
          <p className="text-sm font-medium text-ui-text-secondary mb-1">Total Volume</p>
          <p className="text-2xl font-bold text-ui-text-primary">
            ${formatCompactNumber(totalVolume)}
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-ui-border">
          <p className="text-sm font-medium text-ui-text-secondary mb-1">Total Transactions</p>
          <p className="text-2xl font-bold text-ui-text-primary">{totalTransactions}</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-ui-border">
          <p className="text-sm font-medium text-ui-text-secondary mb-1">Buys</p>
          <p className="text-2xl font-bold text-green-600">{buyCount}</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-ui-border">
          <p className="text-sm font-medium text-ui-text-secondary mb-1">Sells</p>
          <p className="text-2xl font-bold text-red-600">{sellCount}</p>
        </div>
      </div>

      {/* Transaction History */}
      <TransactionHistory userAddress={address} limit={50} />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/create"
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <div className="text-3xl mb-2">🚀</div>
          <h3 className="font-bold mb-1">Create Token</h3>
          <p className="text-sm opacity-90">Launch your own token</p>
        </a>

        <a
          href="/swap"
          className="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <div className="text-3xl mb-2">⇄</div>
          <h3 className="font-bold mb-1">Swap Tokens</h3>
          <p className="text-sm opacity-90">Trade your tokens</p>
        </a>

        <a
          href="/pools"
          className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <div className="text-3xl mb-2">💧</div>
          <h3 className="font-bold mb-1">Add Liquidity</h3>
          <p className="text-sm opacity-90">Earn trading fees</p>
        </a>
      </div>
    </>
  );
}
