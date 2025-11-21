'use client';

import { Bell, Wallet, LogOut } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function Navbar() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected successfully!');
    } catch (error: any) {
      // Stellar Wallets Kit handles wallet selection modal
      // User will see available wallets in the modal
      toast.error(error.message || 'Failed to connect wallet');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
    toast.success('Wallet disconnected');
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-ui-border">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        {/* Left: Page title (mobile) */}
        <div className="lg:hidden">
          <h1 className="text-lg font-semibold text-ui-text-primary">
            Dashboard
          </h1>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Notifications */}
          <button className="relative p-2 text-ui-text-secondary hover:text-ui-text-primary">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-primary rounded-full" />
          </button>

          {/* Wallet Connection */}
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-green-600 transition-colors"
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline font-mono text-sm">
                  {formatAddress(address!)}
                </span>
              </button>

              {/* Dropdown */}
              {showDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  />

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-ui-border z-50">
                    <div className="p-4 border-b border-ui-border">
                      <p className="text-xs text-ui-text-secondary mb-1">
                        Connected Wallet
                      </p>
                      <p className="font-mono text-sm text-ui-text-primary break-all">
                        {address}
                      </p>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left text-ui-text-primary hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-ui-text-secondary" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
