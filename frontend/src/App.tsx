import { Link, NavLink, Route, Routes } from 'react-router'
import { WalletButton } from './components/WalletButton'
import { ScrollToTop } from './components/ScrollToTop'
import { OfflineBanner } from './components/OfflineBanner'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { LiveTickerBar } from './components/LiveTickerBar'
import { ErrorBoundary, PageErrorFallback } from './components/ErrorBoundary'
import { HomePage } from './pages/HomePage'
import { MarketPage } from './pages/MarketPage'
import { TokenPage } from './pages/TokenPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { CreatePage } from './pages/CreatePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { useWallet } from './store/wallet'
import { ASTRO_TOKEN_ID, RPC_URL } from './lib/network'
import { BRAND } from './lib/brand'

function navClass({ isActive }: { isActive: boolean }) {
  return `inline-flex min-h-[36px] items-center whitespace-nowrap rounded-xl px-3 text-xs sm:text-sm font-semibold transition-all ${
    isActive
      ? 'bg-sky-500/20 text-sky-300 shadow-sm shadow-sky-500/10 border border-sky-400/30'
      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
  }`
}

export default function App() {
  const publicKey = useWallet((state) => state.publicKey)

  return (
    <div className="min-h-screen text-slate-100 w-full max-w-full overflow-x-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-lg focus:bg-sky-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-950"
      >
        Skip to content
      </a>

      <OfflineBanner />

      <header className="sticky top-2 z-40 mx-auto max-w-5xl px-3 sm:px-4">
        <div className="liquid-glass-pill rounded-3xl px-4 py-2.5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              aria-label={`${BRAND.name} — Home`}
              className="flex min-w-0 items-center gap-2 text-base sm:text-lg font-bold tracking-tight text-white hover:text-sky-300 transition-colors"
            >
              <span aria-hidden="true" className="text-xl">{BRAND.emoji}</span>
              <span className="truncate">{BRAND.name}</span>
            </Link>

            <nav
              aria-label="Main navigation"
              className="hidden sm:flex items-center gap-1 rounded-2xl bg-white/[0.04] p-1 border border-white/[0.06]"
            >
              <NavLink to="/" end className={navClass}>
                Home
              </NavLink>
              <NavLink to="/market" className={navClass}>
                Market & Art
              </NavLink>
              <NavLink to="/portfolio" className={navClass}>
                Portfolio
              </NavLink>
              <NavLink to="/create" className={navClass}>
                Launch
              </NavLink>
            </nav>

            <div className="flex items-center gap-2">
              <WalletButton />
            </div>
          </div>

          {/* Mobile navigation row */}
          <nav
            aria-label="Mobile navigation"
            className="flex sm:hidden gap-1 overflow-x-auto pt-2 border-t border-white/[0.06] mt-2 no-scrollbar"
          >
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/market" className={navClass}>
              Market
            </NavLink>
            <NavLink to="/portfolio" className={navClass}>
              Portfolio
            </NavLink>
            <NavLink to="/create" className={navClass}>
              Launch
            </NavLink>
          </nav>
        </div>
        <div className="mt-2 overflow-hidden rounded-2xl">
          <LiveTickerBar />
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 px-3.5 sm:px-4 py-4 sm:py-8"
      >
        <ScrollToTop />
        <ErrorBoundary fallback={(err, retry) => <PageErrorFallback error={err} onRetry={retry} />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/token/:id" element={<TokenPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <footer className="mx-auto w-full max-w-5xl border-t border-slate-900 px-3.5 sm:px-4 pb-8 pt-4 text-xs text-slate-400">
        <p>
          {BRAND.name}: {BRAND.provenance}.
        </p>
        <p className="mt-1">
          RPC: <span className="font-mono break-all">{RPC_URL}</span> · Flagship Token:{' '}
          <span className="font-mono break-all">{ASTRO_TOKEN_ID}</span>
        </p>
        {publicKey ? <p className="mt-1 break-all">Connected as {publicKey}</p> : null}
      </footer>

      <PwaInstallPrompt />
    </div>
  )
}
