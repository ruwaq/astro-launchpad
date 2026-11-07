import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQueries } from '@tanstack/react-query'
import { useTokenList } from '../hooks/useTokenList'
import { useWallet } from '../store/wallet'
import { useCreatedTokens } from '../store/creations'
import { fetchTokenBalance } from '../lib/token'
import { formatAmount, shortAddress } from '../lib/format'
import { tokenPriceInXlm, type PoolState } from '../lib/soroswap'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { TokenArt } from '../components/TokenArt'
import { ActivityFeed } from '../components/ActivityFeed'

type PortfolioToken = {
  id: string
  symbol: string
  name: string
  decimals: number
  created: boolean
  pool: PoolState | null
  ledger: number
}

export function PortfolioPage() {
  const { publicKey } = useWallet()
  const createdTokens = useCreatedTokens((state) => state.tokens)
  const tokenList = useTokenList()
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()

  const tokens = useMemo<PortfolioToken[]>(() => {
    const map = new Map<string, PortfolioToken>()

    for (const token of createdTokens) {
      map.set(token.id, {
        id: token.id,
        symbol: token.symbol ?? shortAddress(token.id),
        name: 'Token created by you',
        decimals: token.decimals,
        created: true,
        pool: null,
        ledger: 0,
      })
    }

    for (const token of tokenList.data ?? []) {
      const existing = map.get(token.id)
      map.set(token.id, {
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        created: existing?.created ?? false,
        pool: token.pool,
        ledger: token.ledger,
      })
    }

    return [...map.values()].sort((a, b) => {
      if (a.created !== b.created) return a.created ? -1 : 1
      return b.ledger - a.ledger
    })
  }, [createdTokens, tokenList.data])

  const balances = useQueries({
    queries: tokens.map((token) => ({
      queryKey: ['token-balance', token.id, publicKey],
      queryFn: () => fetchTokenBalance(token.id, publicKey as string),
      enabled: Boolean(publicKey),
      staleTime: 10_000,
    })),
  })

  const rows = tokens.map((token, index) => ({
    token,
    balance: balances[index],
  }))
  const createdRows = rows.filter((row) => row.token.created)
  const holdingRows = rows.filter(
    (row) => !row.token.created && (row.balance.data ?? 0n) > 0n,
  )
  const balancesPending =
    Boolean(publicKey) && rows.some((row) => row.balance.isPending)

  const totalXlm = rows.reduce((sum, { token, balance }) => {
    if (!balance.data || !token.pool || token.pool.reserveToken === 0n) {
      return sum
    }
    return sum + (balance.data * token.pool.reserveXlm) / token.pool.reserveToken
  }, 0n)

  const totalUsd = (Number(totalXlm) / 1e7) * xlmUsd

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Your Portfolio</h1>
        <p className="mt-1 max-w-2xl text-slate-400">
          Tokens you created in this browser and holdings from discovered pools.
          Everything is queried on-chain; no centralized account or backend.
        </p>
      </div>

      {!publicKey ? (
        <section className="rounded-xl border border-amber-900 bg-amber-950/20 p-4 text-sm text-amber-200 sm:p-6">
          Connect your wallet or enter demo mode to inspect your portfolio balances.
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-300"
            >
              Go to Demo Mode
            </Link>
            <Link
              to="/market"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-amber-800 px-4 py-2 text-sm hover:border-amber-600"
            >
              Explore Market
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Estimated Pool Value
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-emerald-300">
              {balancesPending
                ? '…'
                : `${formatAmount(totalXlm, 7)} XLM ($${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD)`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Spot pricing from liquidity pairs; excludes slippage and gas.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Created Tokens
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-100">
              {createdTokens.length}
            </p>
            <Link
              to="/create"
              className="mt-1 inline-block text-xs text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            >
              Launch another token →
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Your Launches</h2>
        {createdRows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            You have not launched any tokens in this browser yet.{' '}
            <Link
              to="/create"
              className="text-emerald-400 underline underline-offset-2"
            >
              Launch your first token
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {createdRows.map(({ token, balance }) => (
              <HoldingRow
                key={token.id}
                token={token}
                balance={balance.data}
                pending={balance.isPending}
                hasAccount={Boolean(publicKey)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Market Holdings</h2>
        {tokenList.isPending || balancesPending ? (
          <p className="mt-2 text-sm text-slate-400">
            {tokenList.isPending
              ? 'Discovering tokens on testnet…'
              : 'Reading on-chain balances…'}
          </p>
        ) : tokenList.isError ? (
          <p className="mt-2 text-sm text-rose-300">
            Unable to read market: {tokenList.error.message}
          </p>
        ) : holdingRows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            You don't hold any tokens from discovered pairs yet. Receive a transfer or trade on market.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {holdingRows.map(({ token, balance }) => (
              <HoldingRow
                key={token.id}
                token={token}
                balance={balance.data}
                pending={balance.isPending}
                hasAccount={Boolean(publicKey)}
              />
            ))}
          </ul>
        )}
      </section>

      <ActivityFeed />
    </>
  )
}

function HoldingRow({
  token,
  balance,
  pending,
  hasAccount,
}: {
  token: PortfolioToken
  balance: bigint | undefined
  pending: boolean
  hasAccount: boolean
}) {
  const value =
    balance && token.pool && token.pool.reserveToken > 0n
      ? (balance * token.pool.reserveXlm) / token.pool.reserveToken
      : 0n
  const price = token.pool
    ? tokenPriceInXlm(token.pool, token.decimals)
    : 0n

  return (
    <li>
      <Link
        to={`/token/${token.id}`}
        className="flex min-h-[64px] items-center gap-3 py-3 hover:bg-slate-950/30"
      >
        <TokenArt
          id={token.id}
          symbol={token.symbol}
          className="h-10 w-10 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">
            {token.symbol}
            {token.created ? (
              <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                created
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-slate-500">
            {token.name} · {shortAddress(token.id)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm text-slate-200">
            {!hasAccount
              ? '—'
              : pending
                ? '…'
                : `${formatAmount(balance ?? 0n, token.decimals)} ${token.symbol}`}
          </p>
          {price > 0n ? (
            <p className="text-xs text-slate-500">
              {value > 0n ? `${formatAmount(value, 7)} XLM` : 'no liquidity'}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  )
}
