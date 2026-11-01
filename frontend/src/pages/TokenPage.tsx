import { Link, useParams } from 'react-router'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useSoroswapPool } from '../hooks/useSoroswapPool'
import { useReserveHistory } from '../hooks/useReserveHistory'
import { useWallet } from '../store/wallet'
import { formatAmount, shortAddress } from '../lib/format'
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
import { NotFoundPage } from './NotFoundPage'
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

  if (!id) return <NotFoundPage />

  if (info.isPending) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-slate-400">
        Leyendo el token {shortAddress(id)} en testnet…
      </div>
    )
  }

  if (info.isError) {
    return (
      <section className="rounded-xl border border-rose-900 bg-rose-950/30 p-6">
        <h1 className="text-xl font-semibold text-rose-200">
          No pudimos leer este token
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {id} no parece un contrato SEP-41 válido en testnet, o el RPC no
          respondió.
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
            Reintentar
          </button>
          <Link
            to="/market"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
          >
            Volver al mercado
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
  const liquidity = pool.data?.reserveXlm ?? 0n
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
          ← Volver al mercado
        </Link>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <TokenArt
            id={id}
            symbol={token.symbol}
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
              >
                Explorer ↗
              </a>
              <ShareButton
                text={`🌊 Mira ${token.symbol} en Floodgate (testnet de Stellar)`}
                url={shareUrl}
              />
              {isOwner ? (
                <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-300">
                  eres el owner
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Precio"
            value={
              pool.isPending
                ? '…'
                : price > 0n
                  ? `${formatAmount(price, 7)} XLM`
                  : '—'
            }
          />
          <Stat
            label="Liquidez"
            value={
              pool.isPending
                ? '…'
                : pool.data?.exists
                  ? `${formatAmount(liquidity, 7)} XLM`
                  : 'sin par'
            }
          />
          <Stat
            label="Supply total"
            value={formatAmount(info.data.totalSupply, token.decimals)}
          />
          <Stat
            label="Tu balance"
            value={
              publicKey
                ? balance.isPending
                  ? '…'
                  : `${formatAmount(balance.data ?? 0n, token.decimals)} ${token.symbol}`
                : 'conecta la wallet'
            }
          />
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Owner:{' '}
          {owner ? (
            <a
              href={`https://stellar.expert/explorer/testnet/account/${owner}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              {shortAddress(owner)}
            </a>
          ) : (
            'renunciado'
          )}
        </p>
      </section>

      {pool.data?.exists || history.length > 0 ? (
        <ReserveChart
          snapshots={history}
          decimals={token.decimals}
          symbol={token.symbol}
        />
      ) : null}

      <SwapCard token={token} />
      <LiquidityPosition token={token} />
      <LiquidityForm token={token} />

      <div>
        <h2 className="text-xl font-semibold">Acciones del token</h2>
        <p className="mt-1 text-sm text-slate-400">
          Transfiere tokens a otra cuenta, quema los tuyos o emite más supply
          (solo owner). Todo queda registrado en testnet.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TransferCard token={token} />
        <BurnCard token={token} />
      </div>
      <MintCard token={token} />
    </>
  )
}
