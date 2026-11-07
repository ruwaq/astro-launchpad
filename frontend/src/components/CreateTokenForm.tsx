import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { deployToken, tokenClient } from '../lib/token'
import {
  calculateDeployFeeInXlm,
  PROTOCOL_DEPLOY_FEE_USD,
} from '../lib/tokenomics'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { explorerContractUrl } from '../lib/explorer'
import { ShareButton } from './ShareButton'
import { useWallet } from '../store/wallet'
import { errorMessage, formatAmount, parseAmount } from '../lib/format'
import { toast } from '../lib/toast'
import { recordActivity } from '../store/activity'
import { TxProgress } from './TxProgress'
import { TokenArt } from './TokenArt'
import { saveLocalTokenMetadata } from '../lib/token-metadata'

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

type LaunchStep = 'deploy' | 'renounce' | null

export function CreateTokenForm({
  onCreated,
}: {
  onCreated?: (token: { id: string; decimals: number; symbol?: string }) => void
}) {
  const { publicKey, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()
  const dynamicMintFeeXlm = calculateDeployFeeInXlm(xlmUsd)
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

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500_000) {
      toast.error('Image too large', { message: 'Please select an image under 500KB.' })
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
    if (!publicKey) {
      setError('Please connect your wallet first.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('Unable to prepare signer for the active account.')
      return
    }

    const cleanName = name.trim()
    const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!cleanName || !cleanSymbol) {
      setError('Token Name and alphanumeric Symbol (A-Z, 0-9) are required.')
      return
    }

    const targetDecimals = 7
    const initialSupply = parseAmount('1000000000', targetDecimals) // 1 Billion

    setBusy(true)
    setStep('deploy')
    let hash: string | undefined
    try {
      // 1. Deploy token SEP-41 contract on Stellar testnet
      const newId = await deployToken({
        name: cleanName,
        symbol: cleanSymbol,
        decimals: targetDecimals,
        initialSupply,
        signer,
        onHash: (value) => {
          hash = value
        },
      })
      const ticker = cleanSymbol

      // 2. Save enriched metadata (Logo, Telegram, Description, Website, Twitter)
      saveLocalTokenMetadata({
        tokenId: newId,
        description: description.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        website: website.trim() || undefined,
        telegram: telegram.trim() || undefined,
        twitter: twitter.trim() || undefined,
      })

      // 3. Renounce ownership on-chain (Immutable supply, zero inflation)
      setStep('renounce')
      const renounceTx = await tokenClient(newId, signer).renounce_ownership()
      await renounceTx.signAndSend()

      onCreated?.({ id: newId, decimals: targetDecimals, symbol: ticker })
      recordActivity({
        kind: 'create',
        tokenId: newId,
        tokenSymbol: ticker,
        amount: formatAmount(initialSupply, targetDecimals),
        account: publicKey,
        hash,
      })

      setCreatedId(newId)
      toast.success('Token Successfully Launched!', {
        message: `$${ticker} created with immutable supply. Next: add liquidity on the token page.`,
        hash,
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['token-list'] }),
        queryClient.invalidateQueries({ queryKey: ['demo-xlm-balances'] }),
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
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Launch Your Token</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          <span>⚡</span> Fee: ${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD (≈ {dynamicMintFeeXlm.toFixed(2)} XLM)
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
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-400">
                  100% Anti-Rug
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                {description.trim() || 'No description provided yet.'}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500">
                <span>Supply: 1,000,000,000</span>
                <span>•</span>
                <span>Dev Reward: 0.5% at Graduation</span>
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
              title="Deployment Progress"
              steps={[
                {
                  label: 'Deploy Token Contract (SEP-41)',
                  status: step === 'deploy' ? 'active' : 'done',
                  detail: 'Publishing on Stellar testnet',
                },
                {
                  label: 'Renounce Ownership (Immutable Supply)',
                  status: step === 'renounce' ? 'active' : 'pending',
                  detail: 'Zero inflation guarantee & LP burned upon graduation',
                },
              ]}
            />
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-2 pt-2 border-t border-slate-800/80">
          <div className="text-xs text-slate-400">
            Deploy fee:{' '}
            <strong className="text-emerald-300 font-mono">
              ${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD
            </strong>{' '}
            (≈ {dynamicMintFeeXlm.toFixed(2)} XLM in wallet)
          </div>

          <button
            type="submit"
            disabled={busy || !publicKey}
            className="min-h-[44px] rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 shadow-md shadow-emerald-500/20"
          >
            {busy ? 'Launching On-Chain…' : `Launch Token ($${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD)`}
          </button>
        </div>
      </form>
    </section>
  )
}
