import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { useReserveHistory } from '../hooks/useReserveHistory'
import { useTokenEvents } from '../hooks/useTokenEvents'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { useWallet } from '../store/wallet'
import { useCopy } from '../hooks/useCopy'
import {
  formatAmount,
  sanitizeHttpUrl,
  sanitizeTelegramUrl,
  sanitizeTwitterUrl,
  shortAddress,
} from '../lib/format'
import { explorerContractUrl, explorerAccountUrl } from '../lib/explorer'
import { tokenPriceInXlmNumber, formatTokenPrice } from '../lib/soroswap'
import { TokenArt } from '../components/TokenArt'
import { SwapCard } from '../components/SwapCard'
import { ReserveChart } from '../components/ReserveChart'
import { TokenHypeBar } from '../components/TokenHypeBar'
import { LiquidityForm } from '../components/LiquidityForm'
import { TransferCard } from '../components/TransferCard'
import { BurnCard } from '../components/BurnCard'
import { MintCard } from '../components/MintCard'
import { NotFoundPage } from './NotFoundPage'
import { useTokenMetadata } from '../hooks/useTokenMetadata'
import { isValidContractAddress } from '../lib/address'
import type { LaunchpadToken } from '../lib/token'

const GRADUATION_TARGET_STROOPS = 2000n * 10_000_000n // 2,000 XLM

export function TokenPage() {
  const { id = '' } = useParams<{ id: string }>()
  const isMockToken = typeof window === 'undefined' && id.startsWith('C')
  const validId = isValidContractAddress(id) || isMockToken
  const queryId = validId ? id : ''

  const publicKey = useWallet((state) => state.publicKey)
  const info = useTokenInfo(queryId)
  const pool = useSoroswapPool(queryId || null)
  const balance = useTokenBalance(publicKey, queryId)
  const history = useReserveHistory(queryId, pool.data)
  const events = useTokenEvents(queryId)
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()
  const meta = useTokenMetadata(queryId)
  const { copied, copy } = useCopy()
  const [openAdvanced, setOpenAdvanced] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#advanced-tools',
  )

  const token: LaunchpadToken = useMemo(
    () => ({
      id,
      decimals: info.data?.decimals ?? 7,
      symbol: info.data?.symbol,
    }),
    [id, info.data?.decimals, info.data?.symbol],
  )

  if (!validId) return <NotFoundPage />

  if (info.isPending) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 animate-pulse">
          <p className="text-sm text-slate-400">
            Reading token {shortAddress(id)} on testnet…
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-slate-800" />
            <div className="space-y-2">
              <div className="h-6 w-48 rounded bg-slate-800" />
              <div className="h-3 w-64 rounded bg-slate-800/70" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (info.isError) {
    return (
      <section className="rounded-2xl border border-rose-900 bg-rose-950/30 p-6">
        <h1 className="text-xl font-bold text-rose-200">
          Unable to load token
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {id} does not appear to be a valid contract on testnet, or RPC timed out.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void info.refetch()}
            className="min-h-[40px] rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400"
          >
            Retry
          </button>
          <Link
            to="/market"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:text-white"
          >
            Back to Market
          </Link>
        </div>
      </section>
    )
  }

  const priceNumber = pool.data ? tokenPriceInXlmNumber(pool.data, token.decimals) : 0
  const priceUsd = priceNumber > 0 ? priceNumber * xlmUsd : 0
  const liquidity = pool.data?.reserveXlm ?? 0n
  const owner = info.data.owner
  const isOwner = Boolean(publicKey && owner === publicKey)

  const graduationPercent = Math.min(
    100,
    Math.round((Number(liquidity) / Number(GRADUATION_TARGET_STROOPS)) * 100),
  )

  const safeTelegram = sanitizeTelegramUrl(meta.data?.telegram)
  const safeWebsite = sanitizeHttpUrl(meta.data?.website)
  const safeTwitter = sanitizeTwitterUrl(meta.data?.twitter)

  return (
    <div className="space-y-6">
      {/* 1. Sleek Minimalist Header */}
      <div className="liquid-glass rounded-2xl p-4 sm:p-5 border border-sky-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Token Visual Avatar */}
          <div className="relative h-14 w-14 shrink-0 rounded-2xl overflow-hidden bg-slate-950 border border-sky-500/30 shadow-md">
            <TokenArt
              id={id}
              symbol={token.symbol}
              logoUrl={meta.data?.logoUrl}
              className="h-full w-full"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {info.data.name}
              </h1>
              <span className="rounded-lg bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 font-mono text-xs font-bold text-sky-300">
                ${token.symbol}
              </span>
              {owner === null ? (
                <span
                  className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 flex items-center gap-1"
                  title="100% LP burned & ownership renounced on-chain"
                >
                  <span>🛡️</span> 100% Rug-Proof
                </span>
              ) : isOwner ? (
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Creator
                </span>
              ) : null}
            </div>

            {/* Contract & Socials Bar */}
            <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => void copy(id)}
                className="font-mono text-slate-300 hover:text-white transition flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-800"
                title="Copy full contract address"
              >
                <span>{shortAddress(id)}</span>
                <span>{copied ? '✓' : '📋'}</span>
              </button>

              {safeTelegram ? (
                <a
                  href={safeTelegram}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:text-sky-300 hover:underline"
                >
                  Telegram ↗
                </a>
              ) : null}
              {safeTwitter ? (
                <a
                  href={safeTwitter}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-300 hover:text-white hover:underline"
                >
                  Twitter ↗
                </a>
              ) : null}
              {safeWebsite ? (
                <a
                  href={safeWebsite}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-300 hover:text-cyan-200 hover:underline"
                >
                  Website ↗
                </a>
              ) : null}
              <a
                href={explorerContractUrl(id)}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-slate-200 hover:underline"
              >
                Explorer ↗
              </a>
            </div>
          </div>
        </div>

        {/* Spot Price & Graduation Progress Bar */}
        <div className="flex flex-col sm:items-end gap-1.5 font-mono pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-black text-white">
              {priceNumber > 0 ? `${formatTokenPrice(priceNumber)} XLM` : '—'}
            </span>
            {priceUsd > 0 ? (
              <span className="text-xs text-slate-400">
                ≈ ${priceUsd < 0.01 ? priceUsd.toFixed(6) : priceUsd.toFixed(4)}
              </span>
            ) : null}
          </div>

          <div className="w-full sm:w-52 space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Graduation Progress</span>
              <span className="font-bold text-amber-300">{graduationPercent}% (2,000 XLM)</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-amber-400 rounded-full"
                style={{ width: `${graduationPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Arena: Gráfico + Chat on Left, Buy & Sell on Right */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Gráfico (Chart) + Live Chat (TokenHypeBar) */}
        <div className="min-w-0 space-y-5 lg:col-span-7">
          {/* Gráfico */}
          <ReserveChart
            history={history}
            symbol={token.symbol}
            decimals={token.decimals}
            events={events.data}
            pool={pool.data}
          />

          {/* Chat / Shouts / Burn-to-Chat */}
          <TokenHypeBar
            tokenId={id}
            symbol={token.symbol ?? 'TOKEN'}
            pairId={pool.data?.pairId}
            decimals={token.decimals}
          />
        </div>

        {/* Right Column: Comprar y Vender (SwapCard) + Minimalist Telemetry */}
        <div className="min-w-0 space-y-4 lg:col-span-5 lg:sticky lg:top-20">
          <SwapCard token={token} />

          {/* Minimalist Telemetry Box */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>AMM Liquidity:</span>
              <span className="font-bold text-white">
                {pool.data?.exists ? `${formatAmount(liquidity, 7)} XLM` : 'No pool yet'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Your Balance:</span>
              <span className="font-bold text-sky-300">
                {publicKey
                  ? balance.isPending
                    ? '…'
                    : `${formatAmount(balance.data ?? 0n, token.decimals)} ${token.symbol}`
                  : 'Connect wallet'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Pool Status:</span>
              <span className="font-bold text-emerald-400">
                {pool.data?.exists ? '🟢 Active on Soroswap' : '⚪ Unseeded'}
              </span>
            </div>
          </div>

          {/* Collapsed Advanced Developer Tools */}
          <details
            id="advanced-tools"
            open={openAdvanced}
            onToggle={(e) => setOpenAdvanced(e.currentTarget.open)}
            className="group rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3.5 transition-all"
          >
            <summary className="flex cursor-pointer select-none items-center justify-between text-xs font-bold text-slate-400 hover:text-white">
              <span className="flex items-center gap-1.5">
                <span>🛠️</span> Advanced Tools & Liquidity
              </span>
              <span className="text-[10px] text-slate-500 transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>

            <div className="mt-4 space-y-4 border-t border-slate-800/80 pt-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Add Community Liquidity</div>
                <LiquidityForm token={token} />
              </div>

              <div className="grid gap-3">
                <TransferCard token={token} />
                <BurnCard token={token} />
                {isOwner ? <MintCard token={token} /> : null}
              </div>

              {owner ? (
                <div className="text-[11px] font-mono text-slate-500">
                  Owner:{' '}
                  <a
                    href={explorerAccountUrl(owner)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-slate-400"
                  >
                    {shortAddress(owner)}
                  </a>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
