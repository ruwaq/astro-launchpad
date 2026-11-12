import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { launchFairAtomic } from '../lib/token'
import {
  FAIR_LAUNCH_DECIMALS,
  FAIR_LAUNCH_TOTAL_BASIS,
  DEFAULT_OPTIMIZED_SEED_XLM,
} from '../lib/tokenomics'
import { DEFAULT_XLM_USD_PRICE, XLM_DECIMALS, XLM_FEE_BUFFER, xlmToStroops } from '../lib/xlm'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { useXlmBalance } from '../hooks/useXlmBalance'
import { explorerContractUrl, explorerTxUrl } from '../lib/explorer'
import { ShareButton } from './ShareButton'
import { useWallet } from '../store/wallet'
import { errorMessage, formatAmount, parseAmount } from '../lib/format'
import { toast } from '../lib/toast'
import { recordActivity } from '../store/activity'
import { TxProgress } from './TxProgress'
import { TokenArt } from './TokenArt'
import {
  decodeOnChainMeta,
  encodeOnChainMeta,
  ONCHAIN_META_MAX_BYTES,
  saveLocalTokenMetadata,
} from '../lib/token-metadata'
import {
  clearCheckpoint,
  getCheckpoint,
  saveCheckpoint,
  type LaunchCheckpoint,
} from '../lib/launch-checkpoint'
import {
  FORM_INPUT_CLASS,
  UNSUPPORTED_SIGNER_MESSAGE,
} from '../lib/constants'

const inputClass = FORM_INPUT_CLASS

type LaunchStep = 'launching' | null

/** Honest recovery message if a token launch was interrupted halfway. */
function incompleteMessageFor(cp: LaunchCheckpoint): string {
  return `Previous launch attempt recorded for ${cp.symbol} (${cp.tokenId || 'pending broadcast'}). Check transaction status on Stellar Explorer.`
}

export function CreateTokenForm({
  onCreated,
}: {
  onCreated?: (token: { id: string; decimals: number; symbol?: string }) => void
}) {
  const { publicKey, getSigner, connect, startDemo, demoPending, pending } = useWallet()
  const queryClient = useQueryClient()
  const { data: xlmUsd = DEFAULT_XLM_USD_PRICE } = useXlmUsdPrice()
  const xlmBalance = useXlmBalance(publicKey)
  const [seedXlmAmount, setSeedXlmAmount] = useState<number>(DEFAULT_OPTIMIZED_SEED_XLM)
  // Mismo buffer que valida `onSubmit`: lo que se muestra es lo que se exige.
  const feeBufferXlm = Number(XLM_FEE_BUFFER) / 10 ** XLM_DECIMALS
  const totalRequiredXlm = seedXlmAmount + feeBufferXlm
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [website, setWebsite] = useState('')
  const [telegram, setTelegram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<LaunchStep>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  /**
   * Checkpoint de un intento anterior cuya tx se llegó a enviar (hay hash)
   * pero la página se cerró antes de confirmar. Se re-lee al cambiar de wallet
   * (patrón "ajustar estado al cambiar props", sin efectos).
   */
  const [checkpointOwner, setCheckpointOwner] = useState(publicKey)
  const [checkpointNote, setCheckpointNote] = useState<LaunchCheckpoint | null>(
    () => getCheckpoint(publicKey),
  )
  if (checkpointOwner !== publicKey) {
    setCheckpointOwner(publicKey)
    setCheckpointNote(getCheckpoint(publicKey))
  }

  const encodedMeta = encodeOnChainMeta({
    description,
    logoUrl,
    website,
    telegram,
    twitter,
  })
  const encodedMetaBytes = new TextEncoder().encode(encodedMeta).length

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setCreatedId(null)
    setCheckpointNote(null)
    if (!publicKey) {
      setError('Please connect your wallet first.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError(UNSUPPORTED_SIGNER_MESSAGE)
      return
    }

    const cleanName = name.trim()
    const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!cleanName || !cleanSymbol) {
      setError('Token Name and alphanumeric Symbol (A-Z, 0-9) are required.')
      return
    }

    const encoder = new TextEncoder()
    if (encoder.encode(cleanName).length > 32) {
      setError('Token Name exceeds 32 bytes in UTF-8. Please shorten or remove complex symbols.')
      return
    }
    if (encoder.encode(cleanSymbol).length > 12) {
      setError('Token Symbol exceeds 12 bytes in UTF-8.')
      return
    }

    const targetDecimals = FAIR_LAUNCH_DECIMALS
    const initialSupply = parseAmount(
      String(FAIR_LAUNCH_TOTAL_BASIS),
      targetDecimals,
    ) // 1 Billion (fixed on-chain by launch_fair)
    const seedXlm = parseAmount(seedXlmAmount.toString(), XLM_DECIMALS)
    if (seedXlm < 10_000_000n) {
      setError('Minimum initial liquidity is 1 XLM.')
      return
    }

    const currentXlmBase =
      xlmBalance.data !== undefined ? xlmToStroops(xlmBalance.data) : undefined
    const requiredStroops = seedXlm + XLM_FEE_BUFFER
    if (currentXlmBase !== undefined && currentXlmBase < requiredStroops) {
      setError(
        `Insufficient XLM balance. You have ${formatAmount(currentXlmBase, XLM_DECIMALS)} XLM, but need at least ${formatAmount(requiredStroops, XLM_DECIMALS)} XLM (${seedXlmAmount} XLM seed + ${feeBufferXlm} XLM fee buffer).`,
      )
      return
    }

    setBusy(true)
    setStep('launching')
    const sessionId = `launch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    saveCheckpoint({
      sessionId,
      tokenId: '',
      name: cleanName,
      symbol: cleanSymbol,
      decimals: targetDecimals,
      initialSupply: initialSupply.toString(),
      seedXlm: seedXlm.toString(),
      publicKey,
      step: 'deploy',
      updatedAt: Date.now(),
    })

    let deployHash: string | undefined
    try {
      // 1. Minimalist single-transaction fair launch (`launch_fair` on Soroban)
      const atomicResult = await launchFairAtomic({
        name: cleanName,
        symbol: cleanSymbol,
        xlmLpAmount: seedXlm,
        meta: encodedMeta,
        signer,
        onHash: (value) => {
          deployHash = value
          saveCheckpoint({
            sessionId,
            tokenId: '',
            name: cleanName,
            symbol: cleanSymbol,
            decimals: targetDecimals,
            initialSupply: initialSupply.toString(),
            seedXlm: seedXlm.toString(),
            publicKey,
            step: 'deploy',
            txHash: value,
            updatedAt: Date.now(),
          })
        },
      })
      const newId = atomicResult.token
      const ticker = cleanSymbol
      const finalHash = atomicResult.hash ?? deployHash

      // 2. Hydrate local metadata cache identically to on-chain `LaunchRecord.meta`
      const decodedMeta = decodeOnChainMeta(newId, encodedMeta)
      if (decodedMeta) saveLocalTokenMetadata(decodedMeta)

      clearCheckpoint(publicKey)
      setCheckpointNote(null)

      onCreated?.({ id: newId, decimals: targetDecimals, symbol: ticker })
      recordActivity({
        kind: 'create',
        tokenId: newId,
        tokenSymbol: ticker,
        amount: formatAmount(initialSupply, targetDecimals),
        secondaryAmount: formatAmount(seedXlm, XLM_DECIMALS),
        secondarySymbol: 'XLM',
        account: publicKey,
        hash: finalHash,
      })

      setCreatedId(newId)
      toast.success('Token & Pool Created Successfully!', {
        message: `$${ticker} is live with Soroswap AMM pool, LP burned, and ownership renounced in 1 atomic transaction.`,
        hash: finalHash,
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['token-list'] }),
        queryClient.invalidateQueries({ queryKey: ['token-info', newId] }),
        queryClient.invalidateQueries({ queryKey: ['demo-xlm-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['soroswap-pool', newId] }),
        queryClient.invalidateQueries({ queryKey: ['xlm-balance', publicKey] }),
      ])
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      toast.error('Failed to create token', { message })
      // La launch es UNA tx atómica: si falló antes de enviarse (firma
      // rechazada, simulación, saldo) no hay nada que recuperar. Solo se
      // conserva el checkpoint si la tx llegó a la red (hay hash) y no
      // sabemos si confirmó.
      if (deployHash) {
        setCheckpointNote(getCheckpoint(publicKey))
      } else {
        clearCheckpoint(publicKey)
      }
    } finally {
      setBusy(false)
      setStep(null)
    }
  }

  return (
    <section className="liquid-glass rounded-3xl p-5 sm:p-8 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
            <TokenArt
              id={symbol || name || 'ASTRO'}
              symbol={symbol || 'COIN'}
              logoUrl={logoUrl.startsWith('https://') ? logoUrl : undefined}
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white truncate">Create & Launch</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              1B fixed supply · 99.5% LP burned · mint renounced
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shrink-0">
          ⚡ 0 XLM Fee
        </span>
      </div>

      {/* Success View */}
      {createdId ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-500/60 bg-emerald-950/20 p-5 text-emerald-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-emerald-500/50 bg-slate-900">
                <TokenArt
                  id={createdId}
                  symbol={symbol}
                  logoUrl={logoUrl.startsWith('https://') ? logoUrl : undefined}
                  className="h-full w-full"
                />
              </div>
              <div>
                <p className="font-bold text-lg text-emerald-300">
                  🎉 ${symbol} Successfully Created!
                </p>
                <p className="font-mono text-xs text-slate-300 break-all">
                  Contract: {createdId}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  ✓ Supply locked at 1B · 100% LP burned to dead address.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/token/${createdId}`}
                className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
              >
                Go to Token Page & Trade →
              </Link>
              <a
                href={explorerContractUrl(createdId)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-500"
              >
                Explorer ↗
              </a>
              <ShareButton
                text={`🚀 I just launched $${symbol} on AstroGate! Check it out:`}
                url={typeof window !== 'undefined' ? `${window.location.origin}/token/${createdId}` : `/token/${createdId}`}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Lanzamiento anterior enviado sin confirmación: sin reintentar a ciegas */}
      {checkpointNote && (checkpointNote.tokenId || checkpointNote.txHash) ? (
        <div
          role="status"
          className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-500/60 bg-amber-950/20 p-4 text-amber-200"
        >
          <p className="text-sm font-semibold">⚠️ {incompleteMessageFor(checkpointNote)}</p>
          <p className="text-xs text-slate-300">
            The launch is a single atomic transaction: it either fully succeeded or reverted
            with no funds moved. Check its status before launching again.
          </p>
          {checkpointNote.txHash ? (
            <p className="font-mono text-xs break-all text-slate-300">
              tx {checkpointNote.txHash}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {checkpointNote.txHash ? (
              <a
                href={explorerTxUrl(checkpointNote.txHash)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                Check transaction ↗
              </a>
            ) : null}
            {checkpointNote.tokenId ? (
              <Link
                to={`/token/${checkpointNote.tokenId}`}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
              >
                Go to token page →
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                clearCheckpoint(publicKey)
                setCheckpointNote(null)
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            >
              Dismiss notice
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} aria-busy={busy} className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* 1. Token Name */}
        <label className="block text-sm">
          <span className="text-slate-300 font-medium">Token Name *</span>
          <input
            className={`${inputClass} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Astro Doge"
            maxLength={32}
            required
            disabled={busy}
          />
        </label>

        {/* 2. Token Ticker */}
        <label className="block text-sm">
          <span className="text-slate-300 font-medium">Ticker Symbol (A-Z, 0-9) *</span>
          <input
            className={`${inputClass} mt-1 font-mono uppercase`}
            value={symbol}
            onChange={(e) =>
              setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
            placeholder="e.g. ADOGE"
            maxLength={12}
            required
            disabled={busy}
          />
        </label>

        {/* Collapsible Optional Details (stored on-chain in LaunchRecord.meta) */}
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            <span>
              {showDetails ? '▼ Hide' : '▶ Add'} description, HTTPS logo & socials (stored on-chain)
            </span>
          </button>

          {showDetails ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5">
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-300 font-medium">Description (max 240 chars)</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 240))}
                  placeholder="Short pitch stored on-chain for every trader…"
                  className={`${inputClass} mt-1 resize-none text-sm`}
                  disabled={busy}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-400">HTTPS Logo URL</span>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className={`${inputClass} mt-1 text-sm`}
                  disabled={busy}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-400">Telegram</span>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="https://t.me/yourgroup or @handle"
                  className={`${inputClass} mt-1 text-sm`}
                  disabled={busy}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-400">Website URL</span>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourtoken.xyz"
                  className={`${inputClass} mt-1 text-sm`}
                  disabled={busy}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-400">Twitter / X</span>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://x.com/yourhandle"
                  className={`${inputClass} mt-1 text-sm`}
                  disabled={busy}
                />
              </label>

              <p className="text-[11px] font-mono text-slate-500 sm:col-span-2 text-right">
                On-chain payload: {encodedMetaBytes}/{ONCHAIN_META_MAX_BYTES} bytes
              </p>
            </div>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-300 sm:col-span-2"
          >
            {error}
          </div>
        ) : null}

        {step ? (
          <div className="sm:col-span-2">
            <TxProgress
              title="Automated Atomic Launch"
              steps={[
                {
                  label: 'Single-Transaction Fair Launch',
                  status: 'active',
                  detail: `Atomic deployment: SEP-41 token created, ${seedXlmAmount} XLM + 99.5% tokens deposited to Soroswap, 100% LP burned to dead address, and ownership renounced in 1 signature.`,
                },
              ]}
            />
          </div>
        ) : null}

        {/* Minimalist Seed Liquidity Chips */}
        <div className="sm:col-span-2 space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300">
              Initial Liquidity (XLM Seed)
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {seedXlmAmount} XLM (~${(seedXlmAmount * xlmUsd).toFixed(2)} USD)
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 20, 50].map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={busy}
                onClick={() => setSeedXlmAmount(amount)}
                className={`py-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                  seedXlmAmount === amount
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-md shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {amount} XLM
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            Deposited to Soroswap pool with 99.5% token supply. 100% LP burned to dead address on creation.
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-2 pt-3 border-t border-white/[0.06]">
          <div
            className="text-xs text-slate-400 font-mono"
            title={`${seedXlmAmount} XLM seed + ${feeBufferXlm} XLM buffer for network fees & reserves (unused fees stay in your wallet)`}
          >
            Required balance:{' '}
            <strong className="text-emerald-300">
              ~{totalRequiredXlm.toFixed(1)} XLM
            </strong>{' '}
            <span className="text-slate-500">
              ({seedXlmAmount} seed + {feeBufferXlm} fee buffer)
            </span>
          </div>

          {!publicKey ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={demoPending || pending}
                onClick={() => void startDemo().catch((err) => toast.error('Failed to start demo', { message: errorMessage(err) }))}
                className="min-h-[44px] rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-60"
              >
                {demoPending ? 'Funding Demo…' : 'Testnet Demo'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void connect().catch((err) => toast.error('Failed to connect wallet', { message: errorMessage(err) }))}
                className="min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition-all shadow-md shadow-amber-500/20 active:scale-[0.99] cursor-pointer disabled:opacity-60"
              >
                {pending ? 'Connecting…' : '🔌 Connect Wallet'}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-[0.99]"
            >
              {busy
                ? 'Launching Token…'
                : `🚀 Launch Token (${seedXlmAmount} XLM seed)`}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
