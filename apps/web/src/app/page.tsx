import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-primary-50 via-white to-brand-blue-50">
        <div className="container mx-auto px-4 py-20">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Left: Content */}
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 bg-brand-primary-100 text-brand-primary-700 px-4 py-2 rounded-full text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary-600 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary-600"></span>
                </span>
                Powered by Stellar Soroban
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold text-ui-text-primary leading-tight">
                Launch Tokens
                <span className="block text-brand-primary mt-2">
                  Instantly on Stellar
                </span>
              </h1>

              <p className="text-xl text-ui-text-secondary max-w-2xl">
                Create, trade, and manage Stellar Asset Contracts (SAC) with enterprise-grade 
                security and blazing-fast transactions.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/create" className="inline-flex items-center justify-center gap-2 bg-brand-primary text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-brand-primary-600 transition-colors shadow-lg shadow-brand-primary/30">
                  Launch Token
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>

                <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 bg-white text-brand-blue px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-colors border-2 border-brand-blue">
                  Explore Tokens
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 pt-8">
                <div>
                  <div className="text-3xl font-bold text-brand-primary">$0</div>
                  <div className="text-sm text-ui-text-secondary">Total Volume</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-brand-primary">0</div>
                  <div className="text-sm text-ui-text-secondary">Tokens Launched</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-brand-primary">0</div>
                  <div className="text-sm text-ui-text-secondary">Active Traders</div>
                </div>
              </div>
            </div>

            {/* Right: Character Image */}
            <div className="flex-1 relative">
              <div className="relative w-full max-w-lg mx-auto">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-primary to-brand-blue opacity-20 blur-3xl rounded-full"></div>
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

        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-brand-blue opacity-10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-brand-primary opacity-10 rounded-full blur-xl"></div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-ui-text-primary mb-4">
              Why Choose Astro Shiba?
            </h2>
            <p className="text-xl text-ui-text-secondary max-w-2xl mx-auto">
              The most advanced token launchpad on the Stellar network
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-brand-primary-50 to-white border border-brand-primary-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-ui-text-primary mb-2">Instant Deployment</h3>
              <p className="text-ui-text-secondary">
                Deploy your Stellar Asset Contract in seconds with our optimized SAC Factory
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-brand-blue-50 to-white border border-brand-blue-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-brand-blue rounded-lg flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-ui-text-primary mb-2">Enterprise Security</h3>
              <p className="text-ui-text-secondary">
                Built-in security features, token verification, and holder protection
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-brand-green-50 to-white border border-brand-green-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-brand-green rounded-lg flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-ui-text-primary mb-2">Real-time Analytics</h3>
              <p className="text-ui-text-secondary">
                Track your token performance with live charts, holder stats, and volume metrics
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-brand-primary to-brand-blue">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Launch Your Token?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join the future of token creation on Stellar Network
          </p>
          <Link href="/create" className="inline-flex items-center justify-center gap-2 bg-white text-brand-primary px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-colors shadow-xl">
            Get Started Now
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
