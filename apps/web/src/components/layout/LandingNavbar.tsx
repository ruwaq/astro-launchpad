/**
 * Landing Page Navbar
 * Simple navbar for the home/landing page
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@/contexts/WalletContext';
import { Rocket } from 'lucide-react';

export function LandingNavbar() {
  const { address, isConnected, connect, disconnect, isConnecting } = useWallet();

  const handleWalletAction = async () => {
    if (isConnected) {
      disconnect();
    } else {
      await connect();
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/xshiblogo.ico"
              alt="Astro Shiba"
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="text-xl font-bold text-gray-900">
              Astro Shiba
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/explore"
              className="text-gray-600 hover:text-brand-primary transition-colors font-medium"
            >
              Explore
            </Link>
            <Link
              href="/create"
              className="text-gray-600 hover:text-brand-primary transition-colors font-medium"
            >
              Create
            </Link>
            <Link
              href="/leaderboard"
              className="text-gray-600 hover:text-brand-primary transition-colors font-medium"
            >
              Leaderboard
            </Link>
          </div>

          {/* Wallet Button */}
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
                >
                  <Rocket className="h-4 w-4" />
                  Dashboard
                </Link>
                <button
                  onClick={handleWalletAction}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                >
                  {address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Connected'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleWalletAction}
                disabled={isConnecting}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors font-medium disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
