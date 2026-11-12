import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useWallet } from '../store/wallet'
import { ASTRO_TOKEN_ID } from '../lib/network'
import { explorerContractUrl } from '../lib/explorer'
import { formatAmount } from '../lib/format'
import type { LaunchpadToken } from '../lib/token'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-sm text-slate-100">{value}</div>
    </div>
  )
}

export function TokenInfoCard({
  tokenId = ASTRO_TOKEN_ID,
  token: tokenProp,
  example = true,
}: {
  tokenId?: string
  token?: LaunchpadToken
  example?: boolean
}) {
  const activeTokenId = tokenProp?.id ?? tokenId
  const { publicKey } = useWallet()
  const info = useTokenInfo(activeTokenId)
  const balance = useTokenBalance(publicKey, activeTokenId)

  if (info.isPending) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-slate-400 sm:p-6">
        <p className="text-sm">Reading token on-chain…</p>
        <div
          aria-hidden="true"
          className="mt-4 grid gap-3 sm:grid-cols-3"
        >
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-16 animate-pulse rounded-lg border border-slate-800 bg-slate-900/60"
            />
          ))}
        </div>
      </div>
    )
  }

  if (info.isError) {
    return (
      <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-rose-300 sm:p-6">
        Unable to read token: {info.error.message}
        <button
          type="button"
          onClick={() => void info.refetch()}
          className="ml-3 inline-flex min-h-[36px] items-center rounded border border-rose-800 px-3 py-1.5 text-xs hover:bg-rose-900/40"
        >
          Retry
        </button>
      </div>
    )
  }

  const token = info.data

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {token.name}{' '}
          <span className="text-slate-400">
            ({token.symbol}){example ? ' · Genesis Meme Token' : ''}
          </span>
        </h2>
        <a
          href={explorerContractUrl(activeTokenId)}
          target="_blank"
          rel="noreferrer"
          aria-label={`View contract ${activeTokenId} on Stellar Explorer`}
          className="inline-flex min-h-[36px] items-center font-mono text-xs text-emerald-400 hover:underline"
        >
          {activeTokenId.slice(0, 8)}…{activeTokenId.slice(-4)} ↗
        </a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Total Supply"
          value={formatAmount(token.totalSupply, token.decimals)}
        />
        <Stat label="Decimals" value={String(token.decimals)} />
        <Stat
          label="Your Balance"
          value={
            publicKey
              ? balance.isPending
                ? '…'
                : formatAmount(balance.data ?? 0n, token.decimals)
              : 'Connect wallet'
          }
        />
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Live data queried from the contract on Stellar testnet via Soroban RPC. Zero backend: the blockchain is the single source of truth.
      </p>
    </section>
  )
}
