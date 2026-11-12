import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { launchTokenAtomic } from '../lib/token'
import {
  allocationOfBps,
  CREATOR_ALLOCATION_BPS,
  FAIR_LAUNCH_DECIMALS,
  FAIR_LAUNCH_TOTAL_BASIS,
  poolAllocationBase,
  DEFAULT_OPTIMIZED_SEED_XLM,
  SEED_LIQUIDITY_PRESETS,
} from '../lib/tokenomics'
import { DEFAULT_XLM_USD_PRICE, XLM_DECIMALS, XLM_FEE_BUFFER, xlmToStroops } from '../lib/xlm'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { useXlmBalance } from '../hooks/useXlmBalance'
import { explorerContractUrl } from '../lib/explorer'
import { ShareButton } from './ShareButton'
import { useWallet } from '../store/wallet'
import { errorMessage, formatAmount, parseAmount } from '../lib/format'
import { toast } from '../lib/toast'
import { recordActivity } from '../store/activity'
import { TxProgress } from './TxProgress'
import { TokenArt } from './TokenArt'
import { saveLocalTokenMetadata } from '../lib/token-metadata'
import {
  clearCheckpoint,
  getCheckpoint,
  saveCheckpoint,
  type LaunchCheckpoint,
} from '../lib/launch-checkpoint'
import {
  FORM_INPUT_CLASS,
  LOGO_MAX_BYTES,
  UNSUPPORTED_SIGNER_MESSAGE,
} from '../lib/constants'

const inputClass = FORM_INPUT_CLASS

type LaunchStep = 'launching' | null

/** Honest recovery message if a token launch was interrupted halfway. */
function incompleteMessageFor(cp: LaunchCheckpoint): string {
  return `Previous launch attempt recorded for ${cp.symbol} (${cp.tokenId || 'pending broadcast'}). Check transaction status on Stellar Explorer.`
}

// Cifras estándar del desglose, derivadas de la única fuente de tokenomics:
const STANDARD_POOL_UNITS = poolAllocationBase(FAIR_LAUNCH_TOTAL_BASIS)
const STANDARD_CREATOR_UNITS = allocationOfBps(
  FAIR_LAUNCH_TOTAL_BASIS,
  CREATOR_ALLOCATION_BPS,
)

export function CreateTokenForm({
  onCreated,
}: {
  onCreated?: (token: { id: string; decimals: number; symbol?: string }) => void
}) {
  const { publicKey, getSigner, connect } = useWallet()
  const queryClient = useQueryClient()
  const { data: xlmUsd = DEFAULT_XLM_USD_PRICE } = useXlmUsdPrice()
  const xlmBalance = useXlmBalance(publicKey)
  const [seedXlmAmount, setSeedXlmAmount] = useState<number>(DEFAULT_OPTIMIZED_SEED_XLM)
  const gasBuffer = 0.1
  const totalRequiredXlm = seedXlmAmount + gasBuffer
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [website, setWebsite] = useState('')
  const [telegram, setTelegram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [showExtraSocials, setShowExtraSocials] = useState(false)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<LaunchStep>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  /** Checkpoint legado de un intento anterior: se muestra para reanudarla. */
  const [checkpointNote, setCheckpointNote] = useState<LaunchCheckpoint | null>(
    () => getCheckpoint(publicKey),
  )

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > LOGO_MAX_BYTES) {
      toast.error('Image too large', {
        message: `Please select an image under ${Math.round(LOGO_MAX_BYTES / 1000)}KB.`,
      })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

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
    ) // 1 Billion
    // Fair Launch Pool: 99.5% of supply, única fuente en lib/tokenomics.ts
    const poolTokens = poolAllocationBase(initialSupply)
    // Initial XLM seed (default 10 XLM)
    const seedXlm = parseAmount(seedXlmAmount.toString(), XLM_DECIMALS)

    const currentXlmBase =
      xlmBalance.data !== undefined ? xlmToStroops(xlmBalance.data) : undefined
    const requiredStroops = seedXlm + XLM_FEE_BUFFER
    if (currentXlmBase !== undefined && currentXlmBase < requiredStroops) {
      setError(
        `Insufficient XLM balance. You have ${formatAmount(currentXlmBase, XLM_DECIMALS)} XLM, but need at least ${formatAmount(requiredStroops, XLM_DECIMALS)} XLM (${seedXlmAmount} XLM seed + 1 XLM fee buffer).`,
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
      // 1. Single-transaction fair launch via Atomic Launchpad contract
      const atomicResult = await launchTokenAtomic({
        name: cleanName,
        symbol: cleanSymbol,
        decimals: targetDecimals,
        initialSupply,
        tokenLpAmount: poolTokens,
        xlmLpAmount: seedXlm,
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

      // 2. Save enriched metadata (Logo, Telegram, Description, Website, Twitter)
      saveLocalTokenMetadata({
        tokenId: newId,
        description: description.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        website: website.trim() || undefined,
        telegram: telegram.trim() || undefined,
        twitter: twitter.trim() || undefined,
      })

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
        queryClient.invalidateQueries({ queryKey: ['demo-xlm-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['soroswap-pool', newId] }),
        queryClient.invalidateQueries({ queryKey: ['xlm-balance', publicKey] }),
      ])
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      toast.error('Failed to create token', { message })
    } finally {
      setBusy(false)
      setStep(null)
    }
  }

  return (
    <section className="liquid-glass rounded-3xl p-5 sm:p-8 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Launch Your Token</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          <span>⚡</span> Protocol Fee: 0 XLM (Free Testnet Launch)
        </span>
      </div>

      <p className="mt-1 text-sm text-slate-400">
        Standard <strong>Fair Launch</strong>: 1,000,000,000 tokens fixed supply ·{' '}
        <span className="text-emerald-300">Ownership renounced</span> (nobody can ever inflate or rug).
        First create your token, then visit its dashboard to add liquidity or trade like any normal user!
      </p>

      {/* Success View */}
      {createdId ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-500/60 bg-emerald-950/20 p-5 text-emerald-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-emerald-500/50 bg-slate-900">
                <TokenArt
                  id={createdId}
                  symbol={symbol}
                  logoUrl={logoUrl || undefined}
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
                  ✓ Supply locked at 1B · Ownership renounced on-chain.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/token/${createdId}`}
                className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
              >
                Go to Token Page & Add Liquidity →
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

      {/* Lanzamiento anterior a medias: sin reintentar a ciegas */}
      {checkpointNote && checkpointNote.tokenId ? (
        <div
          role="status"
          className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-500/60 bg-amber-950/20 p-4 text-amber-200"
        >
          <p className="text-sm font-semibold">⚠️ {incompleteMessageFor(checkpointNote)}</p>
          <p className="font-mono text-xs break-all text-slate-300">
            {checkpointNote.tokenId}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/token/${checkpointNote.tokenId}`}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              Go to token page to complete →
            </Link>
            {checkpointNote.txHash ? (
              <a
                href={explorerContractUrl(checkpointNote.tokenId)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
              >
                Explorer ↗
              </a>
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
        {/* Token Name */}
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

        {/* Token Ticker */}
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

        {/* Telegram Link (Prominent as requested) */}
        <label className="block text-sm">
          <span className="text-slate-300 font-medium flex items-center gap-1.5">
            <span>✈️</span> Telegram Channel or Group Link
          </span>
          <input
            className={`${inputClass} mt-1 text-sm`}
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="https://t.me/yourgroup or @handle"
            disabled={busy}
          />
        </label>

        {/* Token Logo (Image File or URL) */}
        <div className="space-y-1">
          <span className="text-slate-300 font-medium text-sm flex items-center gap-1.5">
            <span>🖼️</span> Token Logo Image
          </span>
          <div className="flex gap-2 items-center mt-1">
            <input
              type="file"
              accept="image/*"
              onChange={onFileSelect}
              disabled={busy}
              className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
            />
            {logoUrl ? (
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                <img
                  src={logoUrl}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Description / Pitch */}
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-300 font-medium">Project Pitch / Description (max 280 chars)</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 280))}
            placeholder="Describe your meme or utility to the Stellar Soroban community..."
            className={`${inputClass} mt-1 resize-none text-sm`}
            disabled={busy}
          />
          <span className="mt-0.5 block text-right text-[10px] text-slate-500">
            {description.length}/280
          </span>
        </label>

        {/* Optional Extra Socials */}
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => setShowExtraSocials(!showExtraSocials)}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>{showExtraSocials ? '▼ Hide' : '▶ Add'} Website & Twitter / X (Optional)</span>
          </button>

          {showExtraSocials ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
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
                <span className="text-slate-400">Twitter / X Profile</span>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://x.com/yourhandle"
                  className={`${inputClass} mt-1 text-sm`}
                  disabled={busy}
                />
              </label>
            </div>
          ) : null}
        </div>

        {/* Live Token Preview Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:col-span-2 min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              👁️ Live Token Preview
            </span>
            <span className="text-[11px] text-slate-500">How it appears on AstroGate</span>
          </div>

          <div className="mt-2 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:flex-row sm:items-center">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <TokenArt
                id={name ? `preview-${name}` : 'preview-token'}
                symbol={symbol || 'TKN'}
                logoUrl={logoUrl || undefined}
                className="h-full w-full"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate font-bold text-slate-100 text-sm">
                  {name.trim() || 'Untitled Token'}{' '}
                  <span className="font-normal text-slate-500">(${symbol || 'TKN'})</span>
                </h4>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  100% Anti-Rug
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                {description.trim() || 'No description provided yet.'}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500">
                <span>Supply: 1,000,000,000</span>
                <span>•</span>
                <span>Creator Allocation: 0.5% (5M tokens at launch)</span>
                {telegram ? (
                  <>
                    <span>•</span>
                    <span className="text-sky-400">✈️ Telegram</span>
                  </>
                ) : null}
                {website ? (
                  <>
                    <span>•</span>
                    <span className="text-cyan-400">🌐 Web</span>
                  </>
                ) : null}
                {twitter ? (
                  <>
                    <span>•</span>
                    <span className="text-slate-300">𝕏 Twitter</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
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

        {/* Optimized Fair Seed Liquidity Selector */}
        <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <span>💧</span> Initial Seed Liquidity (XLM to activate pool)
            </span>
            <span className="text-emerald-400 font-mono font-bold">
              {seedXlmAmount} XLM (~${(seedXlmAmount * xlmUsd).toFixed(2)} USD)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            A deposit of <strong>5 to 10 XLM (~$0.75 - $1.55 USD)</strong> establishes a fair, balanced initial price. It provides natural AMM depth so snipers cannot monopolize supply for pennies, enabling community trading with a healthy <strong>~14x to 16x</strong> multiple towards the 2,000 XLM Soroswap DEX graduation milestone.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 pt-1">
            {SEED_LIQUIDITY_PRESETS.map((preset) => (
              <button
                key={preset.xlm}
                type="button"
                disabled={busy}
                onClick={() => setSeedXlmAmount(preset.xlm)}
                className={`min-h-[44px] rounded-xl border p-2.5 text-left transition-all ${
                  seedXlmAmount === preset.xlm
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200 shadow-md shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs font-bold">
                  <span>{preset.label}</span>
                  {preset.isRecommended ? (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      Recommended
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      ~${(preset.xlm * xlmUsd).toFixed(2)} USD
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400 leading-tight">
                  {preset.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Transparent Cost & Anti-Dump Strategy Breakdown */}
        <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>🧾</span> Transparent Economics: Exact Launch Breakdown
            </span>
            <span className="font-mono text-xs font-black text-emerald-400">
              Total Required: ~{totalRequiredXlm.toFixed(2)} XLM (~${(totalRequiredXlm * xlmUsd).toFixed(2)} USD)
            </span>
          </div>

          <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800/60">
              <div className="text-slate-400 font-medium">🏛️ Protocol Deploy Fee</div>
              <div className="mt-1 font-mono font-bold text-slate-100">
                0 XLM (Free)
              </div>
              <div className="mt-0.5 text-[10px] text-emerald-400">
                100% free testnet deployment
              </div>
            </div>

            <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800/60">
              <div className="text-slate-400 font-medium">💧 Pool Seed Liquidity</div>
              <div className="mt-1 font-mono font-bold text-slate-100">
                {seedXlmAmount} XLM + {STANDARD_POOL_UNITS.toLocaleString()} Tokens
              </div>
              <div className="mt-0.5 text-[10px] text-emerald-400">
                100% deposited to Soroswap & LP burned
              </div>
            </div>

            <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800/60">
              <div className="text-slate-400 font-medium">🛡️ Creator Allocation (0.5%)</div>
              <div className="mt-1 font-mono font-bold text-amber-300">
                {STANDARD_CREATOR_UNITS.toLocaleString()} $TOKEN
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">
                Minted directly to creator wallet at launch (0.5% max)
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-2 pt-2 border-t border-slate-800/80">
          <div className="text-xs text-slate-400">
            Minimum required wallet balance:{' '}
            <strong className="text-emerald-300 font-mono">
              ~{totalRequiredXlm.toFixed(2)} XLM
            </strong>
          </div>

          {!publicKey ? (
            <button
              type="button"
              onClick={() => void connect()}
              className="min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 px-6 py-2.5 text-sm font-black text-slate-950 transition-all shadow-md shadow-amber-500/20 active:scale-[0.99] cursor-pointer"
            >
              🔌 Connect Wallet to Launch Token
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-[0.99]"
            >
              {busy
                ? 'Launching Token & Creating Pool…'
                : `🚀 Launch Token & Pool (~${totalRequiredXlm.toFixed(2)} XLM)`}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
