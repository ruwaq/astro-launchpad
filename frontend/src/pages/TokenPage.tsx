import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { useReserveHistory } from '../hooks/useReserveHistory'
import { useTokenEvents } from '../hooks/useTokenEvents'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { useWallet } from '../store/wallet'
import { formatAmount, shortAddress } from '../lib/format'
import { explorerAccountUrl, explorerContractUrl } from '../lib/explorer'
import { tokenPriceInXlm } from '../lib/soroswap'
import { classifyTokenEvent } from '../lib/token-events'
import { TokenArt } from '../components/TokenArt'
import { ShareButton } from '../components/ShareButton'
import { SwapCard } from '../components/SwapCard'
import { LiquidityPosition } from '../components/LiquidityPosition'
import { LiquidityForm } from '../components/LiquidityForm'
import { TransferCard } from '../components/TransferCard'
import { BurnCard } from '../components/BurnCard'
import { MintCard } from '../components/MintCard'
import { ReserveChart } from '../components/ReserveChart'
import { GraduationCard } from '../components/GraduationCard'
import { TokenHypeBar } from '../components/TokenHypeBar'
import { TokenActivity } from '../components/TokenActivity'
import { TokenGraphics } from '../components/TokenGraphics'
import { ContractDetailsCard } from '../components/ContractDetailsCard'
import { NotFoundPage } from './NotFoundPage'
import { useTokenMetadata } from '../hooks/useTokenMetadata'
import type { LaunchpadToken } from '../lib/token'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-slate-100">{value}</div>
    </div>
  )
}

export function TokenPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { publicKey } = useWallet()
  const info = useTokenInfo(id)
  const pool = useSoroswapPool(id || null)
  const balance = useTokenBalance(publicKey, id)
  const history = useReserveHistory(id, pool.data)
  const events = useTokenEvents(id)
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()
  const meta = useTokenMetadata(id)
  const [leftTab, setLeftTab] = useState<'chart' | 'history' | 'graphics' | 'all'>('chart')

  const pairId = pool.data?.pairId ?? null
  const buyCount = useMemo(() => {
    return (events.data ?? []).filter(
      (e) => classifyTokenEvent(e, pairId) === 'buy',
    ).length
  }, [events.data, pairId])

  const sellCount = useMemo(() => {
    return (events.data ?? []).filter(
      (e) => classifyTokenEvent(e, pairId) === 'sell',
    ).length
  }, [events.data, pairId])

  if (!id) return <NotFoundPage />

  if (info.isPending) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
          <p className="text-sm text-slate-400">
            Reading token {shortAddress(id)} on testnet…
          </p>
          <div aria-hidden="true" className="mt-4 flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 animate-pulse rounded bg-slate-800" />
              <div className="h-3 w-64 animate-pulse rounded bg-slate-800/70" />
            </div>
          </div>
          <div
            aria-hidden="true"
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-16 animate-pulse rounded-lg border border-slate-800 bg-slate-900/60"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (info.isError) {
    return (
      <section className="rounded-xl border border-rose-900 bg-rose-950/30 p-6">
        <h1 className="text-xl font-semibold text-rose-200">
          Unable to read this token
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {id} does not appear to be a valid SEP-41 contract on testnet, or RPC did not respond.
        </p>
        <p className="mt-2 font-mono text-xs text-slate-500">
          {info.error.message}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void info.refetch()}
            className="min-h-[44px] rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Retry
          </button>
          <Link
            to="/market"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
          >
            Back to Market
          </Link>
        </div>
      </section>
    )
  }

  const token: LaunchpadToken = {
    id,
    decimals: info.data.decimals,
    symbol: info.data.symbol,
  }
  const price = pool.data ? tokenPriceInXlm(pool.data, token.decimals) : 0n
  const priceUsd =
    price > 0n ? (Number(price) / 1e7) * xlmUsd : 0
  const liquidity = pool.data?.reserveXlm ?? 0n
  const liquidityUsd = (Number(liquidity) / 1e7) * xlmUsd
  const owner = info.data.owner
  const isOwner = Boolean(publicKey && owner === publicKey)
  const shareUrl =
    typeof window !== 'undefined' ? window.location.href : `/token/${id}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/market"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-400 hover:text-emerald-300 transition-colors"
        >
          <span>←</span> Back to Market
        </Link>
        <div className="flex items-center gap-2">
          {owner === null ? (
            <span className="rounded-full border border-emerald-800/80 bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
              <span>🛡️</span> 100% Rug-Proof (Renounced)
            </span>
          ) : isOwner ? (
            <span className="rounded-full border border-amber-800/80 bg-amber-950/40 px-3 py-1 text-[11px] font-semibold text-amber-300">
              You are the Creator
            </span>
          ) : null}
        </div>
      </div>

      {/* Hero Coin Card */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <TokenArt
            id={id}
            symbol={token.symbol}
            logoUrl={meta.data?.logoUrl}
            className="h-20 w-20 shrink-0 rounded-2xl shadow-lg shadow-emerald-500/10 border border-slate-700/60"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl sm:text-3xl font-black text-slate-100">
                {info.data.name}
              </h1>
              <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-mono text-sm font-bold text-emerald-300">
                ${token.symbol}
              </span>
            </div>

            <p className="mt-1 break-all font-mono text-xs text-slate-500">
              Contract: {shortAddress(id)}
            </p>

            {meta.data?.description ? (
              <p className="mt-2 text-sm text-slate-300 line-clamp-2">
                {meta.data.description}
              </p>
            ) : null}

            {/* Social Buttons */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {meta.data?.telegram ? (
                <a
                  href={
                    meta.data.telegram.startsWith('http')
                      ? meta.data.telegram
                      : `https://t.me/${meta.data.telegram.replace('@', '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-sky-800/80 bg-sky-950/40 px-3 py-1.5 text-xs font-bold text-sky-300 hover:border-sky-500 transition-colors"
                >
                  <span>✈️</span> Telegram ↗
                </a>
              ) : null}

              {meta.data?.website ? (
                <a
                  href={meta.data.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-cyan-800/80 bg-cyan-950/40 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:border-cyan-500 transition-colors"
                >
                  <span>🌐</span> Website ↗
                </a>
              ) : null}

              {meta.data?.twitter ? (
                <a
                  href={
                    meta.data.twitter.startsWith('http')
                      ? meta.data.twitter
                      : `https://x.com/${meta.data.twitter.replace('@', '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-500 transition-colors"
                >
                  <span>𝕏</span> Twitter ↗
                </a>
              ) : null}

              <ShareButton
                text={`🌊 Check out $${token.symbol} on AstroGate (Stellar testnet):`}
                url={shareUrl}
              />

              <a
                href={explorerContractUrl(id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[38px] items-center rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
              >
                Explorer ↗
              </a>
            </div>
          </div>
        </div>

        {/* 4 Clean Game Stats */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat
            label="Current Price"
            value={
              pool.isPending
                ? '…'
                : price > 0n
                  ? `${formatAmount(price, 7)} XLM`
                  : '—'
            }
          />
          <Stat
            label="USD Price"
            value={
              priceUsd > 0
                ? `$${priceUsd < 0.01 ? priceUsd.toFixed(6) : priceUsd.toFixed(4)}`
                : '—'
            }
          />
          <Stat
            label="Pool Liquidity"
            value={
              pool.isPending
                ? '…'
                : pool.data?.exists
                  ? `${formatAmount(liquidity, 7)} XLM ($${liquidityUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})`
                  : 'No pool yet'
            }
          />
          <Stat
            label="Your Bag"
            value={
              publicKey
                ? balance.isPending
                  ? '…'
                  : `${formatAmount(balance.data ?? 0n, token.decimals)} ${token.symbol}`
                : 'Connect wallet'
            }
          />
        </div>
      </section>

      {/* Gamified Graduation Rocket Card */}
      <GraduationCard
        symbol={token.symbol ?? 'TOKEN'}
        owner={owner}
        totalSupply={info.data.totalSupply}
        pool={pool.data}
      />

      {/* Main Trading Arena (2 Columns on Desktop) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Visual Chart, Interactive History in Cuadros, Tokenomics Graphics */}
        <div className="min-w-0 space-y-4 lg:col-span-7">
          {/* Minimalist Interactive Tab Switcher */}
          <div
            role="tablist"
            className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/80 p-1 backdrop-blur"
          >
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'chart'}
              onClick={() => setLeftTab('chart')}
              className={`flex-1 min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                leftTab === 'chart'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>📈</span> Curva
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'history'}
              onClick={() => setLeftTab('history')}
              className={`flex-1 min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                leftTab === 'history'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>🧱</span> Cuadros
              {(events.data ?? []).length > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                    leftTab === 'history'
                      ? 'bg-slate-950 text-emerald-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {(events.data ?? []).length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'graphics'}
              onClick={() => setLeftTab('graphics')}
              className={`flex-1 min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                leftTab === 'graphics'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>📊</span> Hitos
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'all'}
              onClick={() => setLeftTab('all')}
              className={`min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs font-bold transition flex items-center justify-center gap-1 ${
                leftTab === 'all'
                  ? 'bg-slate-800 text-slate-100 border border-slate-600'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Ver todos los gráficos y cuadros juntos"
            >
              <span>🌐</span> Todo
            </button>
          </div>

          {/* Tab 1: Chart */}
          {leftTab === 'chart' || leftTab === 'all' ? (
            <ReserveChart
              history={history}
              symbol={token.symbol}
              decimals={token.decimals}
              events={events.data}
              pool={pool.data}
            />
          ) : null}

          {/* Tab 2: Interactive History in Cuadros */}
          {leftTab === 'history' || leftTab === 'all' ? (
            <TokenActivity
              tokenId={id}
              decimals={token.decimals}
              token={token}
            />
          ) : null}

          {/* Tab 3: Token Distribution Graphics & Milestone Cards */}
          {leftTab === 'graphics' || leftTab === 'all' ? (
            <TokenGraphics
              symbol={token.symbol}
              pool={pool.data}
              buyCount={buyCount}
              sellCount={sellCount}
            />
          ) : null}

          <TokenHypeBar
            tokenId={id}
            symbol={token.symbol ?? 'TOKEN'}
            pairId={pool.data?.pairId}
            decimals={token.decimals}
          />
        </div>

        {/* Right Column: Arcade Buy & Sell Console (Sticky on Desktop) */}
        <div className="min-w-0 space-y-4 lg:col-span-5 lg:sticky lg:top-20">
          <SwapCard token={token} />

          {/* Community Liquidity Addition */}
          <details className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-4 transition-all">
            <summary className="flex cursor-pointer select-none items-center justify-between text-xs font-bold text-slate-300 hover:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span>💧</span> ¿Añadir Liquidez Comunitaria al Pool?
              </span>
              <span className="text-slate-500 transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>
            <div className="mt-3 border-t border-slate-800/80 pt-3">
              <p className="text-[11px] text-slate-400 mb-3">
                Cualquier miembro de la comunidad puede aportar XLM y ${token.symbol} para profundizar la liquidez del par en Soroswap y ganar comisiones del 0.3%.
              </p>
              <LiquidityForm token={token} />
            </div>
          </details>
        </div>
      </div>

      {/* Collapsible Power-User / Developer Tools Drawer */}
      <details
        id="advanced-tools"
        className="group rounded-2xl border border-slate-800 bg-slate-900/30 p-4 transition-all"
      >
        <summary className="flex cursor-pointer select-none items-center justify-between text-sm font-bold text-slate-300 hover:text-white">
          <span className="flex items-center gap-2">
            <span>🛠️</span> Advanced Developer Tools & Contract Details
          </span>
          <span className="text-xs text-slate-500 transition-transform group-open:rotate-180">
            ▼
          </span>
        </summary>

        <div className="mt-5 space-y-6 border-t border-slate-800/80 pt-5">
          <ContractDetailsCard
            tokenId={id}
            pairId={pool.data?.pairId}
            symbol={token.symbol ?? 'TOKEN'}
            name={info.data.name}
            decimals={token.decimals}
            totalSupply={info.data.totalSupply}
            owner={owner}
            metadata={meta.data}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <LiquidityForm token={token} />
            <LiquidityPosition token={token} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TransferCard token={token} />
            <BurnCard token={token} />
          </div>

          {isOwner ? (
            <MintCard token={token} />
          ) : owner ? (
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
              Owner contract:{' '}
              <a
                href={explorerAccountUrl(owner)}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline hover:text-slate-200"
              >
                {shortAddress(owner)}
              </a>
              . Only the owner can execute administrative mints.
            </section>
          ) : (
            <section className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-xs text-emerald-300">
              ✓ Ownership renounced on-chain. Minting is permanently locked; total supply is 100% immutable.
            </section>
          )}
        </div>
      </details>
    </div>
  )
}
