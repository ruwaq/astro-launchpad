import { Link, NavLink, Route, Routes } from 'react-router'
import { WalletButton } from './components/WalletButton'
import { ScrollToTop } from './components/ScrollToTop'
import { OfflineBanner } from './components/OfflineBanner'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
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
  return `inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-sm ${
    isActive
      ? 'bg-emerald-500/10 font-medium text-emerald-300'
      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
  }`
}

export default function App() {
  const { publicKey } = useWallet()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-950"
      >
        Saltar al contenido
      </a>

      <OfflineBanner />

      <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
            <Link
              to="/"
              aria-label={`${BRAND.name} — inicio`}
              className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <span aria-hidden="true">{BRAND.emoji}</span>
              <span className="truncate">{BRAND.name}</span>
            </Link>
            <WalletButton />
          </div>

          <nav
            aria-label="Navegación principal"
            className="flex gap-1 overflow-x-auto pb-2"
          >
            <NavLink to="/" end className={navClass}>
              Inicio
            </NavLink>
            <NavLink to="/market" className={navClass}>
              Mercado
            </NavLink>
            <NavLink to="/portfolio" className={navClass}>
              Portfolio
            </NavLink>
            <NavLink to="/create" className={navClass}>
              Crear
            </NavLink>
          </nav>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:py-10"
      >
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/token/:id" element={<TokenPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-5xl border-t border-slate-900 px-4 pb-8 pt-4 text-xs text-slate-500">
        <p>
          {BRAND.name}: {BRAND.provenance}.
        </p>
        <p className="mt-1">
          RPC: <span className="font-mono">{RPC_URL}</span> · contrato:{' '}
          <span className="font-mono">{ASTRO_TOKEN_ID}</span>
        </p>
        {publicKey ? <p className="mt-1">Conectado como {publicKey}</p> : null}
      </footer>

      <PwaInstallPrompt />
    </div>
  )
}
