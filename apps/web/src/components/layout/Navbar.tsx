'use client';

import { Bell, Wallet, LogOut } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useBalance } from '@/hooks/useBalance';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function Navbar() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const { balance, isLoading: isLoadingBalance } = useBalance(address);
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
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Empty space or page title can go here */}
          <div className="flex-1">
            {/* Page title or breadcrumbs can be added here later */}
          </div>

          {/* Right: User Actions */}
          <div className="flex items-center gap-4">
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
              className="flex items-center gap-2 bg-gradient-to-r from-brand-primary to-brand-blue text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                className="flex items-center gap-3 bg-green-50 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <div className="flex flex-col items-start">
                  <span className="font-mono text-sm text-gray-900">
                    {formatAddress(address!)}
                  </span>
                  <span className="text-xs text-gray-600 font-medium">
                    {isLoadingBalance ? (
                      <span className="inline-block w-16 h-3 bg-gray-200 animate-pulse rounded" />
                    ) : (
                      `${parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 2 })} XLM`
                    )}
                  </span>
                </div>
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
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">
                        Connected Wallet
                      </p>
                      <p className="font-mono text-sm text-gray-900 break-all mb-3">
                        {address}
                      </p>
                      <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
                        <span className="text-xs text-gray-600">Balance</span>
                        <span className="font-bold text-sm text-gray-900">
                          {isLoadingBalance ? (
                            <span className="inline-block w-20 h-4 bg-gray-200 animate-pulse rounded" />
                          ) : (
                            `${parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 2 })} XLM`
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-gray-600" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
