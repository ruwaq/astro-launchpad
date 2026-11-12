import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTokenInfo } from '../hooks/useTokenInfo'
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
import { explorerContractUrl, explorerAccountUrl, explorerTxUrl } from '../lib/explorer'
import { classifyTokenEvent } from '../lib/token-events'
import { tokenPriceInXlmNumber, formatTokenPrice, formatUsdPrice } from '../lib/soroswap'
import { TokenArt } from '../components/TokenArt'
import { SwapCard } from '../components/SwapCard'
import { ReserveChart } from '../components/ReserveChart'
import { TokenHypeBar } from '../components/TokenHypeBar'
import { LiquidityForm } from '../components/LiquidityForm'
import { LiquidityPosition } from '../components/LiquidityPosition'
import { TransferCard } from '../components/TransferCard'
import { BurnCard } from '../components/BurnCard'
import { MintCard } from '../components/MintCard'
import { NotFoundPage } from './NotFoundPage'
import { useTokenMetadata } from '../hooks/useTokenMetadata'
import { useLpBurnInfo } from '../hooks/useLpBurnInfo'
import { useTokenShouts } from '../hooks/useTokenShouts'
import { isValidContractAddress } from '../lib/address'
import {
  GRADUATION_TARGET_XLM,
  graduationProgress,
  rugProofStatus,
  STELLAR_BURN_ADDRESS,
  type RugProofStatus,
} from '../lib/tokenomics'
import { extendTokenTtl, type LaunchpadToken } from '../lib/token'
import { DEFAULT_XLM_USD_PRICE } from '../lib/xlm'
import { errorMessage } from '../lib/format'
import { toast } from '../lib/toast'

/** Badge honesto: solo "Rug-Proof" cuando la quema de LP está verificada. */
function SecurityBadge({ status }: { status: RugProofStatus }) {
  switch (status) {
    case 'verified':
      return (
        <span
          className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 flex items-center gap-1"
          title="Verified on-chain: ownership renounced and 100% of withdrawable LP held by the burn address"
        >
          <span>🛡️</span> Rug-Proof
        </span>
      )
    case 'lp-not-burned':
      return (
        <span
          className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
          title="Minting is renounced, but LP tokens exist outside the burn address: their holders can withdraw liquidity"
        >
          ⚠️ LP not burned
        </span>
      )
    case 'unknown':
      return (
        <span
          className="rounded-full bg-slate-500/15 border border-slate-500/30 px-2 py-0.5 text-[10px] font-semibold text-slate-300"
          title="External SEP-41 token (no get_owner): anti-rug guarantees cannot be verified"
        >
          External token
        </span>
      )
    default:
      return null
  }
}

export function TokenPage() {
  const { id = '' } = useParams<{ id: string }>()
  const isMockToken = typeof window === 'undefined' && id.startsWith('C')
  const validId = isValidContractAddress(id) || isMockToken
  const queryId = validId ? id : ''

  const publicKey = useWallet((state) => state.publicKey)
  const getSigner = useWallet((state) => state.getSigner)
  const connect = useWallet((state) => state.connect)
  const info = useTokenInfo(queryId)
  const pool = useSoroswapPool(queryId || null)
  const history = useReserveHistory(queryId, pool.data)
  const events = useTokenEvents(queryId)
  const shouts = useTokenShouts(queryId)
  const { data: xlmUsd = DEFAULT_XLM_USD_PRICE } = useXlmUsdPrice()
  const meta = useTokenMetadata(queryId)
  const lpBurn = useLpBurnInfo(pool.data?.pairId)
  const { copied, copy } = useCopy()
  const [openAdvanced, setOpenAdvanced] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#advanced-tools',
  )
  const [activeTab, setActiveTab] = useState<'thread' | 'trades' | 'audit'>('thread')
  const [extendingTtl, setExtendingTtl] = useState(false)

  async function onExtendTtl() {
    if (!publicKey) {
      void connect()
      return
    }
    const signer = getSigner()
    if (!signer) {
      toast.error('Active wallet does not support signing')
      return
    }
    setExtendingTtl(true)
    try {
      const { hash } = await extendTokenTtl({ tokenId: id, signer })
      toast.success('90-day TTL refreshed on-chain', { hash })
    } catch (err) {
      toast.error('Could not extend TTL', { message: errorMessage(err) })
    } finally {
      setExtendingTtl(false)
    }
  }

  const token: LaunchpadToken = useMemo(
    () => ({
      id,
      decimals: info.data?.decimals ?? 7,
      symbol: info.data?.symbol,
    }),
    [id, info.data?.decimals, info.data?.symbol],
  )

  const trades = useMemo(() => {
    if (!events.data) return []
    return events.data.filter((ev) => {
      const role = classifyTokenEvent(ev, pool.data?.pairId)
      return role === 'buy' || role === 'sell'
    })
  }, [events.data, pool.data?.pairId])

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
  const security = rugProofStatus({
    owner,
    ownerSupported: info.data.ownerSupported,
    pool: pool.data,
    lpFullyBurned: lpBurn.data?.fullyBurned,
  })

  const grad = graduationProgress(liquidity)
  const graduationPercent = Math.min(100, Math.round(grad.percent))

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
              <SecurityBadge status={security} />
              {isOwner ? (
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
            {meta.data?.description ? (
              <p className="mt-2 max-w-xl text-xs text-slate-300 leading-relaxed">
                {meta.data.description}
              </p>
            ) : null}
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
                ≈ ${formatUsdPrice(priceUsd)}
              </span>
            ) : null}
          </div>

          <div className="w-full sm:w-52 space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Graduation Progress</span>
              <span className="font-bold text-amber-300">
                {graduationPercent}% ({GRADUATION_TARGET_XLM.toLocaleString('en-US')} XLM)
              </span>
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
        {/* Left Column: Gráfico (Chart) + Tabs [Thread | Trades] */}
        <div className="min-w-0 space-y-4 lg:col-span-7">
          {/* Gráfico */}
          <ReserveChart
            history={history}
            symbol={token.symbol}
            decimals={token.decimals}
            events={events.data}
            pool={pool.data}
          />

          {/* Tabbed Interactive Section: Thread | Live Trades | Audit & Contract */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('thread')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'thread'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>💬 Thread</span>
                {shouts.data && shouts.data.length > 0 ? (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                    {shouts.data.length}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('trades')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'trades'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>⚡ Live Trades</span>
                <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                  {trades.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'audit'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🛡️ Audit & Contract</span>
              </button>
            </div>

            {activeTab === 'thread' ? (
              <TokenHypeBar
                tokenId={id}
                symbol={token.symbol ?? 'TOKEN'}
                pairId={pool.data?.pairId}
                decimals={token.decimals}
              />
            ) : activeTab === 'audit' ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm space-y-3 text-xs">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
                    <p className="text-slate-400">Launchpad Registry</p>
                    <p className="mt-1 font-semibold text-white">
                      {info.data.verifiedLaunchpad
                        ? '✓ AstroGate Fair Launch (On-Chain)'
                        : 'Soroswap External Discovery'}
                    </p>
                    {info.data.creator ? (
                      <a
                        href={explorerAccountUrl(info.data.creator)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block font-mono text-[11px] text-sky-400 hover:underline"
                      >
                        Creator {shortAddress(info.data.creator)} ↗
                      </a>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
                    <p className="text-slate-400">Mint Ownership</p>
                    <p className="mt-1 font-semibold text-white">
                      {!info.data.ownerSupported
                        ? 'Unknown (no get_owner)'
                        : info.data.owner === null ||
                            info.data.owner === STELLAR_BURN_ADDRESS
                          ? '✓ Renounced Forever (0 supply inflation)'
                          : `⚠️ Active: ${shortAddress(info.data.owner)}`}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
                    <p className="text-slate-400">Soroswap LP Lock</p>
                    <p className="mt-1 font-semibold text-white">
                      {lpBurn.isPending
                        ? 'Verifying LP burn…'
                        : lpBurn.data?.fullyBurned
                          ? '✓ 100% Withdrawable LP Burned'
                          : lpBurn.data
                            ? `${lpBurn.data.burnedPercent.toFixed(1)}% in burn address`
                            : 'No AMM pair'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
                    <p className="text-slate-400">Circulating Supply</p>
                    <p className="mt-1 font-mono font-semibold text-white">
                      {formatAmount(info.data.totalSupply, info.data.decimals)} ${token.symbol}
                    </p>
                    {pool.data?.pairId ? (
                      <a
                        href={explorerContractUrl(pool.data.pairId)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block font-mono text-[11px] text-sky-400 hover:underline"
                      >
                        Pair {shortAddress(pool.data.pairId)} ↗
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400">
                    Keep Soroban token & registry state alive for 90 days.
                  </span>
                  <button
                    type="button"
                    disabled={extendingTtl}
                    onClick={() => void onExtendTtl()}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-500 hover:text-sky-300 disabled:opacity-50"
                  >
                    {extendingTtl ? 'Extending TTL…' : '⏳ Refresh 90-Day TTL'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <span>Action · Amount</span>
                  <span>Trader · Tx</span>
                </div>
                {trades.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No on-chain swaps recorded yet. Trade to initiate the curve!
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800/50 max-h-72 overflow-y-auto">
                    {trades.map((ev) => {
                      const isBuy = classifyTokenEvent(ev, pool.data?.pairId) === 'buy'
                      return (
                        <div
                          key={ev.id}
                          className="py-2 flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isBuy
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {isBuy ? '🟢 BUY' : '🔴 SELL'}
                            </span>
                            <span className="text-white font-bold">
                              {formatAmount(ev.amount, token.decimals)} ${token.symbol}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                            <span>by {shortAddress((isBuy ? ev.to : ev.from) ?? '')}</span>
                            {ev.txHash ? (
                              <a
                                href={explorerTxUrl(ev.txHash)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 hover:text-sky-300 underline"
                              >
                                tx ↗
                              </a>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Comprar y Vender (SwapCard) Sticky */}
        <div className="min-w-0 space-y-4 lg:col-span-5 lg:sticky lg:top-20">
          <SwapCard
            token={token}
            onOpenLiquidityTools={() => setOpenAdvanced(true)}
          />
          {/* Posición LP del usuario + retirada atómica (remove_liquidity).
              Fuera del acordeón: solo se pinta si la wallet tiene LP. */}
          <LiquidityPosition token={token} />

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
