/**
 * Home Page - REAL DATA ONLY
 *
 * Displays live token data from Stellar Testnet
 * Contract: CBTFVJEYLMDHDFTKLO4PR7MHPFVNISOYYBJQSCNCQXWX2WMXXXJAZWT2
 */

'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TrendingUp, Rocket, Shield, Activity } from 'lucide-react';
import { useTokenCount } from '@/hooks/useToken';
import { useWallet } from '@/contexts/WalletContext';
import { LandingNavbar } from '@/components/layout/LandingNavbar';

export default function Home() {
  const { tokenCount, isLoading: isLoadingCount } = useTokenCount();
  const { connect, isConnecting } = useWallet();

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Left: Content */}
            <div className="flex-1 space-y-6 text-center lg:text-left">
              {/* Live Status Badge */}
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-600 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
                </span>
                Live on Stellar Testnet
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Launch Tokens
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-blue mt-2">
                  Instantly on Stellar
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0">
                Fair launch platform with bonding curves, automatic graduation to AMM,
                and permanent liquidity locks. Zero pre-mints, 100% on-chain.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                <Link
                  href="/create"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-primary to-brand-blue text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  <Rocket className="h-5 w-5" />
                  Launch Token
                </Link>

                <Link
                  href="/explore"
                  className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 border-2 border-gray-200"
                >
                  Explore Tokens
                </Link>
              </div>

              {/* Live Stats */}
              <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-8 max-w-2xl mx-auto lg:mx-0">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    {isLoadingCount ? (
                      <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
                    ) : (
                      <div className="text-2xl sm:text-3xl font-bold text-brand-primary">
                        {tokenCount}
                      </div>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Tokens Launched</div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="text-2xl sm:text-3xl font-bold text-brand-primary">$0</div>
                  <div className="text-xs sm:text-sm text-gray-600">Gas Fees</div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="text-2xl sm:text-3xl font-bold text-brand-primary">3-5s</div>
                  <div className="text-xs sm:text-sm text-gray-600">Finality</div>
                </div>
              </div>
            </div>

            {/* Right: Character Image */}
            <div className="flex-1 relative max-w-md lg:max-w-lg">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/20 to-brand-blue/20 blur-3xl rounded-full" />
                <Image
                  src="/images/personajeastroslatando.png"
                  alt="Astro Shiba Character"
                  width={500}
                  height={500}
                  className="relative z-10 drop-shadow-2xl animate-bounce-slow"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* Decorative gradients */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-brand-blue/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-brand-primary/10 rounded-full blur-3xl" />
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Astro Shiba?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Built on Stellar Soroban with enterprise-grade security and blazing-fast transactions
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* Feature 1 */}
            <div className="group p-6 lg:p-8 rounded-2xl bg-gradient-to-br from-green-50 to-white border border-green-100 hover:shadow-xl hover:scale-105 transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Fair Launch</h3>
              <p className="text-gray-600">
                Zero pre-mints. Bonding curve ensures fair price discovery.
                LP tokens locked forever on graduation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-6 lg:p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 hover:shadow-xl hover:scale-105 transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Auto Graduation</h3>
              <p className="text-gray-600">
                Tokens automatically graduate to AMM at 10,000 XLM.
                Instant liquidity, permanent lock.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-6 lg:p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 hover:shadow-xl hover:scale-105 transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real-Time Trading</h3>
              <p className="text-gray-600">
                Live price updates, instant transactions.
                3-5 second finality on Stellar network.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Launch and trade tokens in 3 simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-primary to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Launch Token</h3>
              <p className="text-gray-600">
                Create your token with name, symbol, and image.
                Real Stellar Asset Contract deployed.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-blue to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Trade on Bonding Curve</h3>
              <p className="text-gray-600">
                Buy and sell instantly. Price determined by constant product formula.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Graduate to AMM</h3>
              <p className="text-gray-600">
                At 10,000 XLM, token graduates to AMM with permanent locked liquidity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-r from-brand-primary via-pink-500 to-brand-blue relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">
            Ready to Launch Your Token?
          </h2>
          <p className="text-lg lg:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join the fair launch revolution on Stellar.
            No pre-sales, no rug pulls, just pure on-chain trading.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 bg-white text-brand-primary px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-2xl"
          >
            <Rocket className="h-5 w-5" />
            Launch Now - Free
          </Link>
        </div>
      </section>
      </main>
    </>
  );
}
