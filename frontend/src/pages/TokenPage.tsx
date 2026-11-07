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
    <>
      <div>
        <Link
          to="/market"
          className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-200"
        >
          ← Back to Market
        </Link>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <TokenArt
            id={id}
            symbol={token.symbol}
            logoUrl={meta.data?.logoUrl}
            className="h-20 w-20 shrink-0 rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">
              {info.data.name}{' '}
              <span className="text-slate-500">({token.symbol})</span>
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">
              {id}
            </p>
            {meta.data?.description ? (
              <p className="mt-2 text-sm text-slate-300">
                {meta.data.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={explorerContractUrl(id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
              >
                Explorer ↗
              </a>
              {meta.data?.website ? (
                <a
                  href={meta.data.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-cyan-800/80 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-300 hover:border-cyan-600"
                >
                  <span>🌐</span> Website ↗
                </a>
              ) : null}
              {meta.data?.telegram ? (
                <a
                  href={
                    meta.data.telegram.startsWith('http')
                      ? meta.data.telegram
                      : `https://t.me/${meta.data.telegram.replace('@', '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-sky-800/80 bg-sky-950/30 px-3 py-2 text-xs text-sky-300 hover:border-sky-600"
                >
                  <span>✈️</span> Telegram ↗
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
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
                >
                  <span>𝕏</span> Twitter ↗
                </a>
              ) : null}
              <ShareButton
                text={`🌊 Check out $${token.symbol} on AstroGate (Stellar testnet):`}
                url={shareUrl}
              />
              {isOwner ? (
                <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-300">
                  You are the owner
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Price"
            value={
              pool.isPending
                ? '…'
                : price > 0n
                  ? `${formatAmount(price, 7)} XLM ($${priceUsd < 0.01 ? priceUsd.toFixed(6) : priceUsd.toFixed(4)})`
                  : '—'
            }
          />
          <Stat
            label="Liquidity"
            value={
              pool.isPending
                ? '…'
                : pool.data?.exists
                  ? `${formatAmount(liquidity, 7)} XLM ($${liquidityUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})`
                  : 'No pool'
            }
          />
          <Stat
            label="Total Supply"
            value={formatAmount(info.data.totalSupply, token.decimals)}
          />
          <Stat
            label="Your Balance"
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

      <GraduationCard
        symbol={token.symbol ?? 'TOKEN'}
        owner={owner}
        totalSupply={info.data.totalSupply}
        pool={pool.data}
      />

      <TokenHypeBar
        tokenId={id}
        symbol={token.symbol ?? 'TOKEN'}
        pairId={pool.data?.pairId}
      />

      <ReserveChart
        history={history}
        symbol={token.symbol}
        decimals={token.decimals}
        events={events.data}
        pool={pool.data}
      />

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
        <SwapCard token={token} />
        <LiquidityForm token={token} />
      </div>

      <LiquidityPosition token={token} />

      <TransferCard token={token} />

      <BurnCard token={token} />

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

      <TokenActivity tokenId={id} decimals={token.decimals} />
    </>
  )
}
