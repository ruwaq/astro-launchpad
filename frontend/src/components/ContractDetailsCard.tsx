import {
  explorerAccountUrl,
  explorerContractUrl,
  horizonAccountUrl,
} from '../lib/explorer'
import { shortAddress, formatAmount } from '../lib/format'
import { STELLAR_BURN_ADDRESS } from '../lib/tokenomics'
import { ASTRO_WASM_HASH } from '../lib/network'
import { useCopy } from '../hooks/useCopy'
import type { EnrichedTokenMetadata } from '../lib/token-metadata'

export function ContractDetailsCard({
  tokenId,
  pairId,
  symbol,
  name,
  decimals,
  totalSupply,
  owner,
  metadata,
}: {
  tokenId: string
  pairId?: string | null
  symbol: string
  name: string
  decimals: number
  totalSupply: bigint
  owner: string | null
  metadata?: EnrichedTokenMetadata | null
}) {
  const { lastCopied, copy } = useCopy()

  const isRenounced = !owner

  return (
    <section
      id="sec-contract-details"
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-sm">
              📜
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Contract Details: {name} (${symbol})
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Immutable smart contract properties, on-chain verification links, and anti-rug proofs on Stellar Soroban.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isRenounced ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span>✓</span> Ownership Renounced (Immutable)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              <span>⚠️</span> Active Admin Key
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-300">
            <span>🔥</span> LP Burned to Dead Address
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* Token Contract ID */}
        <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Token Contract ID
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void copy(tokenId)}
                className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300 transition hover:bg-slate-700"
              >
                {lastCopied === tokenId ? 'Copied ✓' : 'Copy'}
              </button>
              <a
                href={explorerContractUrl(tokenId)}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-emerald-400 transition hover:bg-slate-700"
              >
                Explorer ↗
              </a>
            </div>
          </div>
          <div className="mt-2 break-all font-mono text-xs text-slate-200">
            {tokenId}
          </div>
        </div>

        {/* Soroswap Pair ID */}
        <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Soroswap AMM Pair
            </span>
            {pairId ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void copy(pairId ?? '')}
                  className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300 transition hover:bg-slate-700"
                >
                  {lastCopied === pairId ? 'Copied ✓' : 'Copy'}
                </button>
                <a
                  href={explorerContractUrl(pairId)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-emerald-400 transition hover:bg-slate-700"
                >
                  Pair DEX ↗
                </a>
              </div>
            ) : null}
          </div>
          <div className="mt-2 break-all font-mono text-xs text-slate-200">
            {pairId ?? 'No pool initialized yet'}
          </div>
        </div>

        {/* WASM Hash & Standard */}
        <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Token Bytecode WASM Hash
            </span>
            <button
              type="button"
              onClick={() => void copy(ASTRO_WASM_HASH)}
              className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300 transition hover:bg-slate-700"
            >
              {lastCopied === ASTRO_WASM_HASH ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <div className="mt-2 break-all font-mono text-xs text-slate-300">
            {ASTRO_WASM_HASH}
          </div>
        </div>

        {/* Issuer / Deployer */}
        <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Token Creator / Deployer
            </span>
            {owner ? (
              <a
                href={explorerAccountUrl(owner)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300 transition hover:bg-slate-700"
              >
                Account ↗
              </a>
            ) : null}
          </div>
          <div className="mt-2 break-all font-mono text-xs text-slate-300">
            {owner ? owner : 'Renounced / Dead (No admin key)'}
          </div>
        </div>
      </div>

      {/* Contract Parameters Bar */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
          <div className="text-[11px] text-slate-500 uppercase">Standard</div>
          <div className="mt-0.5 font-mono text-xs font-semibold text-slate-200">
            SEP-41 Soroban
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
          <div className="text-[11px] text-slate-500 uppercase">Decimals</div>
          <div className="mt-0.5 font-mono text-xs font-semibold text-slate-200">
            {decimals} (Stroops)
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
          <div className="text-[11px] text-slate-500 uppercase">Total Supply</div>
          <div className="mt-0.5 font-mono text-xs font-semibold text-slate-200">
            {formatAmount(totalSupply, decimals)} {symbol}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
          <div className="text-[11px] text-slate-500 uppercase">LP Burn Vault</div>
          <div className="mt-0.5 font-mono text-xs text-emerald-400">
            {shortAddress(STELLAR_BURN_ADDRESS)}
          </div>
        </div>
      </div>

      {/* Audit Links & Network RPCs */}
      <div className="mt-5 rounded-xl border border-slate-800/80 bg-slate-950/30 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Independent Verification & Raw Data Sources
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Cross-examine live state, ledgers, and transactions directly against public Stellar node endpoints:
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={explorerContractUrl(tokenId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
          >
            <span>🔍</span> Stellar.Expert Token Contract ↗
          </a>

          {pairId ? (
            <a
              href={explorerContractUrl(pairId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
            >
              <span>🔄</span> Stellar.Expert Pair AMM ↗
            </a>
          ) : null}

          {owner ? (
            <a
              href={horizonAccountUrl(owner)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
            >
              <span>🌐</span> Horizon Account Data ↗
            </a>
          ) : null}

          <a
            href="https://soroban-testnet.stellar.org/health"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
          >
            <span>⚡</span> Soroban RPC Health ↗
          </a>

          {metadata?.website ? (
            <a
              href={metadata.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-800 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-300 hover:border-cyan-500"
            >
              <span>🌐</span> Official Website ↗
            </a>
          ) : null}

          {metadata?.telegram ? (
            <a
              href={
                metadata.telegram.startsWith('http')
                  ? metadata.telegram
                  : `https://t.me/${metadata.telegram.replace('@', '')}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-800 bg-sky-950/40 px-3 py-1.5 text-xs text-sky-300 hover:border-sky-500"
            >
              <span>✈️</span> Telegram Community ↗
            </a>
          ) : null}

          {metadata?.twitter ? (
            <a
              href={
                metadata.twitter.startsWith('http')
                  ? metadata.twitter
                  : `https://x.com/${metadata.twitter.replace('@', '')}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
            >
              <span>𝕏</span> Twitter / X ↗
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}
