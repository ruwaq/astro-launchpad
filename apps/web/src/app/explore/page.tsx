'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Search, Filter, TrendingUp } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';

export default function ExplorePage() {
  const { connect, isConnecting } = useWallet();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary">
            Explore Tokens
          </h1>
          <p className="text-ui-text-secondary mt-1">
            Discover and trade tokens on Stellar Network
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-4 border border-ui-border">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-ui-text-secondary" />
              <input
                type="text"
                placeholder="Search tokens..."
                className="w-full pl-10 pr-4 py-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <select className="px-4 py-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white">
                <option>All Curves</option>
                <option>Linear</option>
                <option>Exponential</option>
                <option>Sigmoid</option>
              </select>

              <select className="px-4 py-3 border border-ui-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white">
                <option>All Status</option>
                <option>Active</option>
                <option>Graduated</option>
              </select>

              <button className="px-4 py-3 border border-ui-border rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="h-5 w-5 text-ui-text-secondary" />
              </button>
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-ui-border">
            <span className="text-sm font-medium text-ui-text-secondary">Sort by:</span>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1.5 bg-brand-primary text-white rounded-lg text-sm font-medium">
                Trending
              </button>
              <button className="px-3 py-1.5 bg-gray-100 text-ui-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                New
              </button>
              <button className="px-3 py-1.5 bg-gray-100 text-ui-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Market Cap
              </button>
              <button className="px-3 py-1.5 bg-gray-100 text-ui-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Volume
              </button>
              <button className="px-3 py-1.5 bg-gray-100 text-ui-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Graduation %
              </button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-xl border border-ui-border p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-brand-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="h-10 w-10 text-brand-primary" />
            </div>
            <h3 className="text-xl font-bold text-ui-text-primary mb-2">
              No tokens found
            </h3>
            <p className="text-ui-text-secondary mb-6">
              Connect your wallet to view tokens on Stellar Testnet
            </p>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
