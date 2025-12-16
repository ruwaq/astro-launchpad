'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Wallet } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useUserTransactions } from '@/hooks/useApi';
import { TransactionHistory } from '@/components/transactions/TransactionHistory';
import { HoldingsSection } from '@/components/portfolio/HoldingsSection';
import { truncateAddress } from '@/lib/stellar/utils';
import toast from 'react-hot-toast';

type TabType = 'holdings' | 'history' | 'created';

export default function PortfolioPage() {
  const { isConnected, connect, isConnecting, address } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>('holdings');

  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-brand-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-brand-primary" />
            </div>
            <h2 className="text-xl font-bold text-ui-text-primary mb-2">
              Connect Wallet
            </h2>
            <p className="text-ui-text-secondary mb-6">
              Connect your wallet to view your portfolio
            </p>
            <button
              onClick={() => connect().then(() => toast.success('Connected!'))}
              disabled={isConnecting}
              className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ui-text-primary">Portfolio</h1>
            <p className="text-sm text-ui-text-secondary font-mono">
              {truncateAddress(address!, 8)}
            </p>
          </div>
          <Link
            href="/create"
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors text-sm font-medium"
          >
            Create Token
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-ui-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('holdings')}
            className={`px-4 py-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'holdings'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-ui-text-secondary hover:text-ui-text-primary'
            }`}
          >
            Holdings
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-ui-text-secondary hover:text-ui-text-primary'
            }`}
          >
            Trade History
          </button>
          <button
            onClick={() => setActiveTab('created')}
            className={`px-4 py-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'created'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-ui-text-secondary hover:text-ui-text-primary'
            }`}
          >
            Created Tokens
          </button>
        </div>

        {/* Content */}
        {activeTab === 'holdings' && (
          <HoldingsSection address={address!} />
        )}

        {activeTab === 'history' && (
          <TransactionHistory userAddress={address!} limit={50} />
        )}

        {activeTab === 'created' && (
          <CreatedTokensSection address={address!} />
        )}
      </div>
    </DashboardLayout>
  );
}

function CreatedTokensSection({ address }: { address: string }) {
  const { data } = useUserTransactions(address, 100);

  // Filter for token creation transactions
  const createdTokens = data?.transactions?.edges
    ?.filter((edge) => edge?.node?.type === 'TOKEN_CREATED')
    ?.map((edge) => edge.node) || [];

  if (createdTokens.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
        <p className="text-ui-text-secondary mb-4">No tokens created yet</p>
        <Link
          href="/create"
          className="inline-block px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium"
        >
          Create Your First Token
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {createdTokens.map((tx) => (
        <Link
          key={tx.id}
          href={`/t/${tx.token?.address}`}
          className="block bg-white rounded-xl border border-ui-border p-4 hover:border-brand-primary transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-blue rounded-lg flex items-center justify-center text-white font-bold">
              {tx.token?.symbol?.charAt(0) || 'T'}
            </div>
            <div>
              <p className="font-semibold text-ui-text-primary">
                {tx.token?.name || 'Unknown Token'}
              </p>
              <p className="text-sm text-ui-text-secondary">
                ${tx.token?.symbol}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
