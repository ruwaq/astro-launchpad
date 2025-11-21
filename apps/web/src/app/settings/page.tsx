'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Settings as SettingsIcon, Network, Bell, Shield } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { getNetworkConfig } from '@/lib/config/network';

export default function SettingsPage() {
  const { isConnected, connect, disconnect, isConnecting, address } = useWallet();
  const networkConfig = getNetworkConfig();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary">
            Settings
          </h1>
          <p className="text-ui-text-secondary mt-1">
            Manage your account and preferences
          </p>
        </div>

        {/* Network Settings */}
        <div className="bg-white rounded-xl border border-ui-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-brand-blue-50 rounded-lg">
              <Network className="h-6 w-6 text-brand-blue" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-ui-text-primary mb-2">
                Network Configuration
              </h3>
              <p className="text-sm text-ui-text-secondary mb-4">
                Currently connected to Stellar Testnet
              </p>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 bg-brand-blue-50 text-brand-blue text-sm font-medium rounded-lg">
                  Testnet Active
                </span>
                <span className="text-xs text-ui-text-secondary">
                  To switch to Mainnet, update environment variables
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Settings */}
        <div className="bg-white rounded-xl border border-ui-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-brand-primary-50 rounded-lg">
              <Shield className="h-6 w-6 text-brand-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-ui-text-primary mb-2">
                Wallet Connection
              </h3>
              {isConnected ? (
                <>
                  <p className="text-sm text-ui-text-secondary mb-4">
                    Your wallet is connected
                  </p>
                  <div className="bg-brand-green-50 border border-brand-green-200 rounded-lg p-4 mb-4">
                    <p className="text-xs text-brand-green-700 mb-1">
                      Connected Address
                    </p>
                    <p className="font-mono text-sm text-brand-green-900 break-all">
                      {address}
                    </p>
                  </div>
                  <button
                    onClick={disconnect}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    Disconnect Wallet
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-ui-text-secondary mb-4">
                    Connect your Freighter wallet to access all features
                  </p>
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-ui-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-brand-green-50 rounded-lg">
              <Bell className="h-6 w-6 text-brand-green" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-ui-text-primary mb-4">
                Notifications
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-ui-text-primary">
                    Token graduation alerts
                  </span>
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-brand-primary"
                    disabled
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-ui-text-primary">
                    Price change notifications
                  </span>
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-brand-primary"
                    disabled
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-ui-text-primary">
                    New token launches
                  </span>
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-brand-primary"
                    disabled
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-xl border border-ui-border p-6">
          <h3 className="font-semibold text-ui-text-primary mb-4">
            About Astro Shiba
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ui-text-secondary">Version</span>
              <span className="text-ui-text-primary font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ui-text-secondary">Network</span>
              <span className={`font-medium ${networkConfig.passphrase.includes('Test') ? 'text-brand-blue' : 'text-brand-green'}`}>
                {networkConfig.passphrase.includes('Test') ? 'Testnet' : 'Mainnet'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-ui-text-secondary">Contract ID</span>
              <span className="text-ui-text-primary font-mono text-xs break-all">
                {networkConfig.contractId}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-ui-text-secondary">RPC URL</span>
              <span className="text-ui-text-primary font-mono text-xs break-all">
                {networkConfig.rpcUrl}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
