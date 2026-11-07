import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { deployToken, tokenClient } from '../lib/token'
import {
  addLiquidity,
  burnLpTokens,
  fetchPoolState,
  quoteXlmForToken,
  swapXlmForToken,
  withSlippage,
} from '../lib/soroswap'
import {
  calculateDeployFeeInXlm,
  PROTOCOL_DEPLOY_FEE_USD,
  splitFairLaunchSupply,
} from '../lib/tokenomics'
import { useXlmUsdPrice } from '../hooks/useXlmUsdPrice'
import { explorerContractUrl } from '../lib/explorer'
import { ShareButton } from './ShareButton'
import { useWallet } from '../store/wallet'
import { useProgress } from '../store/progress'
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

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

const SEED_XLM_PRESETS = ['10', '25', '50', '100'] as const

type LaunchStep =
  | 'deploy'
  | 'liquidity'
  | 'burn'
  | 'renounce'
  | 'dev-buy'
  | null

/**
 * Fair Launch Token Creation (Pump.fun / GasPump style on Stellar/Soroban):
 * - 1,000,000,000 tokens (7 decimals).
 * - 99% (990M) seeds directly into Soroswap AMM pool.
 * - 1% (10M) creator allocation.
 * - Automatic 100% LP token burn to Stellar dead account GAAAA...WHF (irrevocable liquidity lock).
 * - Automatic ownership renunciation (`renounce_ownership`) to lock minting forever.
 */
export function CreateTokenForm({
  onCreated,
}: {
  onCreated?: (token: { id: string; decimals: number; symbol?: string }) => void
}) {
  const { publicKey, getSigner } = useWallet()
  const queryClient = useQueryClient()
  const markProgress = useProgress((state) => state.mark)
  const { data: xlmUsd = 0.1555 } = useXlmUsdPrice()
  const dynamicMintFeeXlm = calculateDeployFeeInXlm(xlmUsd)
  const [expert, setExpert] = useState(false)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimals, setDecimals] = useState(7)
  const [supply, setSupply] = useState('1000000000')
  const [seedXlm, setSeedXlm] = useState('10')
  const [creatorBuyXlm, setCreatorBuyXlm] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [website, setWebsite] = useState('')
  const [telegram, setTelegram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [showSocials, setShowSocials] = useState(false)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<LaunchStep>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [fairLaunched, setFairLaunched] = useState(false)
  const [pendingCheckpoint, setPendingCheckpoint] = useState<LaunchCheckpoint | null>(() =>
    getCheckpoint(),
  )

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

  async function onResumeCheckpoint(cp: LaunchCheckpoint) {
    if (!publicKey) {
      setError('Connect your wallet to resume token launch.')
      return
    }
    const signer = getSigner()
    if (!signer) {
      setError('Signer unavailable for active account.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      let currentStep = cp.step
      let pairId = cp.pairId
      let lpAmount = cp.lpAmount ? BigInt(cp.lpAmount) : 0n

      if (currentStep === 'liquidity') {
        setStep('liquidity')
        const initialSupply = BigInt(cp.initialSupply)
        const { poolAmount } = splitFairLaunchSupply(initialSupply)
        const seedXlmBase = parseAmount(cp.seedXlm, 7)
        const lpResult = await addLiquidity({
          tokenId: cp.tokenId,
          amountToken: poolAmount,
          amountXlm: seedXlmBase,
          signer,
        })
        pairId = lpResult.pair
        lpAmount = lpResult.lpAmount
        currentStep = 'burn'
        saveCheckpoint({
          ...cp,
          step: 'burn',
          pairId,
          lpAmount: lpAmount.toString(),
          updatedAt: Date.now(),
        })
      }

      if (currentStep === 'burn' && pairId && lpAmount > 0n) {
        setStep('burn')
        await burnLpTokens({
          pairId,
          lpAmount,
          signer,
        })
        currentStep = 'renounce'
        saveCheckpoint({
          ...cp,
          step: 'renounce',
          updatedAt: Date.now(),
        })
      }

      if (currentStep === 'renounce') {
        setStep('renounce')
        const renounceTx = await tokenClient(cp.tokenId, signer).renounce_ownership()
        await renounceTx.signAndSend()
      }

      clearCheckpoint()
      setPendingCheckpoint(null)
      setFairLaunched(true)
      setCreatedId(cp.tokenId)
      toast.success('Launch Successfully Resumed & Completed!', {
        message: `${cp.symbol} liquidity is locked and ownership renounced.`,
      })
      await queryClient.invalidateQueries({ queryKey: ['token-list'] })
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      toast.error('Failed to resume launch', { message })
    } finally {
      setBusy(false)
      setStep(null)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setCreatedId(null)
    setFairLaunched(false)

    if (!publicKey) {
      setError('Connect your wallet or activate demo mode to launch a token.')
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
      setError('Name and alphanumeric symbol (A-Z, 0-9) are required.')
      return
    }
    const targetDecimals = expert ? decimals : 7
    if (!Number.isInteger(targetDecimals) || targetDecimals < 0 || targetDecimals > 18) {
      setError('Decimals must be an integer between 0 and 18.')
      return
    }
    const initialSupply = parseAmount(expert ? supply : '1000000000', targetDecimals)
    if (initialSupply <= 0n) {
      setError('Initial supply must be greater than 0.')
      return
    }

    const seedXlmBase = !expert ? parseAmount(seedXlm, 7) : 0n
    const creatorBuyXlmBase = !expert && creatorBuyXlm.trim() ? parseAmount(creatorBuyXlm, 7) : 0n
    if (!expert && seedXlmBase <= 0n) {
      setError('Enter an initial seed XLM amount greater than 0 for the liquidity pool.')
      return
    }

    setBusy(true)
    setStep('deploy')
    let hash: string | undefined
    try {
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
      saveLocalTokenMetadata({
        tokenId: newId,
        description: description.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        website: website.trim() || undefined,
        telegram: telegram.trim() || undefined,
        twitter: twitter.trim() || undefined,
      })
      onCreated?.({ id: newId, decimals: targetDecimals, symbol: ticker })
      recordActivity({
        kind: 'create',
        tokenId: newId,
        tokenSymbol: ticker,
        amount: formatAmount(initialSupply, targetDecimals),
        account: publicKey,
        hash,
      })

      if (!expert) {
        const sessionId = `launch-${Date.now()}`
        saveCheckpoint({
          sessionId,
          tokenId: newId,
          name: cleanName,
          symbol: ticker,
          decimals: targetDecimals,
          initialSupply: initialSupply.toString(),
          seedXlm,
          creatorBuyXlm,
          publicKey,
          step: 'liquidity',
          updatedAt: Date.now(),
        })

        // 1. Inject 99% of supply into Soroswap pool (creator receives 1%)
        setStep('liquidity')
        const { poolAmount } = splitFairLaunchSupply(initialSupply)
        const lpResult = await addLiquidity({
          tokenId: newId,
          amountToken: poolAmount,
          amountXlm: seedXlmBase,
          signer,
        })
        markProgress('liquidity')
        recordActivity({
          kind: 'add-liquidity',
          tokenId: newId,
          tokenSymbol: ticker,
          amount: formatAmount(lpResult.tokenAmount, targetDecimals),
          secondaryAmount: formatAmount(lpResult.xlmAmount, 7),
          secondarySymbol: 'XLM',
          detail: '99% Fair-Launch Pool',
          account: publicKey,
        })

        saveCheckpoint({
          sessionId,
          tokenId: newId,
          name: cleanName,
          symbol: ticker,
          decimals: targetDecimals,
          initialSupply: initialSupply.toString(),
          seedXlm,
          creatorBuyXlm,
          publicKey,
          step: 'burn',
          pairId: lpResult.pair,
          lpAmount: lpResult.lpAmount.toString(),
          updatedAt: Date.now(),
        })

        // 2. Mandatory LP Burn to canonical blackhole GAAAA...WHF (100% Anti-Rug)
        if (lpResult.lpAmount > 0n) {
          await burnLpTokens({
            pairId: lpResult.pair,
            lpAmount: lpResult.lpAmount,
            signer,
          })
          recordActivity({
            kind: 'burn',
            tokenId: newId,
            tokenSymbol: `${ticker}-LP`,
            amount: formatAmount(lpResult.lpAmount, 7),
            detail: 'LP Burned to GAAAA...WHF (Locked Forever)',
            account: publicKey,
          })
        }

        saveCheckpoint({
          sessionId,
          tokenId: newId,
          name: cleanName,
          symbol: ticker,
          decimals: targetDecimals,
          initialSupply: initialSupply.toString(),
          seedXlm,
          creatorBuyXlm,
          publicKey,
          step: 'renounce',
          pairId: lpResult.pair,
          lpAmount: lpResult.lpAmount.toString(),
          updatedAt: Date.now(),
        })

        // 3. Renounce ownership on-chain to disable minting forever
        setStep('renounce')
        const renounceTx = await tokenClient(newId, signer).renounce_ownership()
        await renounceTx.signAndSend()

        // 4. If creator opted to buy more with their own XLM, execute swap on curve
        if (creatorBuyXlmBase > 0n) {
          setStep('dev-buy')
          const poolState = await fetchPoolState(newId)
          const quoted = await quoteXlmForToken(creatorBuyXlmBase, poolState)
          if (quoted > 0n) {
            await swapXlmForToken({
              tokenId: newId,
              amountIn: creatorBuyXlmBase,
              amountOutMin: withSlippage(quoted, 5),
              signer,
            })
            markProgress('swapped')
          }
        }
        clearCheckpoint()
        setPendingCheckpoint(null)
        setFairLaunched(true)
        toast.success('Fair Launch Completed!', {
          message: `${ticker} is live on market · 99% in pool · LP burned to GAAAA...WHF · supply locked`,
          hash,
        })
      } else {
        toast.success('Token deployed on testnet', {
          message: `${ticker} · ${newId}`,
          hash,
        })
      }

      setCreatedId(newId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['token-list'] }),
        queryClient.invalidateQueries({ queryKey: ['demo-xlm-balances'] }),
      ])
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      toast.error('Failed to complete launch', { message })
    } finally {
      setBusy(false)
      setStep(null)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Launch Your Token</h2>
        <button
          type="button"
          onClick={() => setExpert((value) => !value)}
          className="min-h-[44px] rounded px-2 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-300"
        >
          {expert ? '← Back to Fair Launch (Recommended)' : 'Manual / Expert Mode'}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {expert ? (
          'Manual mode: deploys only the SEP-41 contract with custom parameters.'
        ) : (
          <>
            Standard <strong>Fair Launch (Pump.fun / GasPump style)</strong>:{' '}
            <span className="text-slate-200">1,000,000,000 tokens</span> ·{' '}
            <span className="text-emerald-300">99% directly to pool</span> ·{' '}
            <span className="text-slate-200">1% Creator allocation</span> ·{' '}
            <span className="text-emerald-300">100% LP burned</span> ·{' '}
            <span className="text-emerald-300">Ownership renounced</span>{' '}
            (supply fixed forever, zero rug-pulls).
          </>
        )}
      </p>

      {pendingCheckpoint ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-amber-300">
                ⚠️ Interrupted Launch Detected: {pendingCheckpoint.symbol}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-300">
                Contract: {pendingCheckpoint.tokenId} · Stopped at:{' '}
                <span className="font-bold uppercase text-amber-400">
                  {pendingCheckpoint.step}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Your token contract was deployed on-chain, but the pool seeding or LP lock was interrupted. You can resume safely now without losing funds.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearCheckpoint()
                setPendingCheckpoint(null)
              }}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => onResumeCheckpoint(pendingCheckpoint)}
              className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Resume Launch Now →
            </button>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        aria-busy={busy}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <label className="block text-sm">
          <span className="text-slate-400">Token Name</span>
          <input
            className={`${inputClass} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Astro Rocket"
            maxLength={32}
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Ticker Symbol (A-Z, 0-9)</span>
          <input
            className={`${inputClass} mt-1`}
            value={symbol}
            onChange={(e) =>
              setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
            placeholder="ASTRO"
            maxLength={12}
          />
        </label>

        {expert ? (
          <>
            <label className="block text-sm">
              <span className="text-slate-400">Decimals</span>
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min={0}
                max={18}
                value={decimals}
                onChange={(e) => setDecimals(Number(e.target.value))}
              />
            </label>

            <label className="block text-sm">
              <span className="text-slate-400">Initial Supply</span>
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min={0}
                step="any"
                value={supply}
                onChange={(e) => setSupply(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="block text-sm">
                <span className="text-slate-400">
                  Initial Pool Liquidity (XLM)
                </span>
                <input
                  className={`${inputClass} mt-1`}
                  value={seedXlm}
                  onChange={(e) => setSeedXlm(e.target.value)}
                  placeholder="10"
                  inputMode="decimal"
                />
              </label>
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-slate-500">Presets:</span>
                {SEED_XLM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={busy}
                    onClick={() => setSeedXlm(preset)}
                    className={`rounded-md border px-2 py-0.5 font-mono text-xs ${
                      seedXlm === preset
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {preset} XLM
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm">
                <span className="text-slate-400">
                  Creator Extra Buy on Launch (XLM, optional)
                </span>
                <input
                  className={`${inputClass} mt-1`}
                  value={creatorBuyXlm}
                  onChange={(e) => setCreatorBuyXlm(e.target.value)}
                  placeholder="0 (e.g. 5 XLM)"
                  inputMode="decimal"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                You receive 1% (10M) for free as creator. If you want more tokens, you buy them
                here from the pool like everyone else, boosting liquidity.
              </p>
            </div>

            {/* Mandatory Anti-Rug Guarantee Card */}
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 text-xs text-slate-300 sm:col-span-2">
              <span className="text-lg">🔒</span>
              <div>
                <strong className="text-emerald-300">
                  Mandatory Anti-Rug Guarantee · 100% Irrevocable Liquidity Lock
                </strong>
                <span className="mt-0.5 block text-slate-400">
                  All LP tokens generated on launch are automatically sent to Stellar's dead address (
                  <code className="text-slate-300">GAAAA...WHF</code>). Liquidity is permanently locked
                  forever. Neither the creator nor protocol devs can ever withdraw or rug-pull the pool.
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/15 px-3 py-2 text-xs text-slate-300 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span>
                  Fair Launch summary for{' '}
                  <span className="font-mono font-semibold text-emerald-300">
                    {symbol.trim() || 'YOUR_TOKEN'}
                  </span>
                  : <strong>990,000,000</strong> tokens (99%: 790M curve + 200M DEX reserve) to pool with <strong>{seedXlm || '0'} XLM</strong> ·{' '}
                  <strong>10,000,000</strong> tokens (1%) for you as creator ·{' '}
                  <strong className="text-emerald-300">
                    Ownership renounced + 100% LP burned
                  </strong>
                  .
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 font-mono text-[11px] text-emerald-200">
                  ⚡ Mint Fee: <strong>${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD</strong>{' '}
                  (≈ {dynamicMintFeeXlm.toFixed(2)} XLM)
                </span>
              </div>
            </div>
          </>
        )}

        {/* Meme Branding & Socials Section */}
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => setShowSocials(!showSocials)}
            className="flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            <span>{showSocials ? '▼ Hide' : '▶ Add'} Branding, Logo & Social Links (Optional)</span>
          </button>

          {showSocials ? (
            <div className="mt-3 grid gap-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-400">Project Pitch / Description (max 280 chars)</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 280))}
                  placeholder="What makes your meme or token special? Tell the Stellar community..."
                  className={`${inputClass} mt-1 resize-none text-sm`}
                />
                <span className="mt-1 block text-right text-[10px] text-slate-500">
                  {description.length}/280
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-slate-400">Logo Image URL or IPFS</span>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://... or ipfs://..."
                  className={`${inputClass} mt-1 text-sm`}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-400">Or Upload Image File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileSelect}
                  className="mt-1 block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-400">Website URL</span>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourtoken.xyz"
                  className={`${inputClass} mt-1 text-sm`}
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-400">Telegram Channel or Group</span>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="https://t.me/... or @group"
                  className={`${inputClass} mt-1 text-sm`}
                />
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-400">X (Twitter) Profile</span>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://x.com/... or @handle"
                  className={`${inputClass} mt-1 text-sm`}
                />
              </label>
            </div>
          ) : null}
        </div>

        {/* Live Token Preview Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              👁️ Live Token Preview
            </span>
            <span className="text-xs text-slate-500">How your token will appear on AstroGate</span>
          </div>
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:flex-row sm:items-center">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <TokenArt
                id={name ? `preview-${name}` : 'preview-token'}
                symbol={symbol || 'TKN'}
                logoUrl={logoUrl || undefined}
                className="h-full w-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate font-bold text-slate-100">
                  {name.trim() || 'Untitled Token'}{' '}
                  <span className="font-normal text-slate-500">(${symbol || 'TKN'})</span>
                </h4>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  100% Anti-Rug
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                {description.trim() || 'No description provided yet.'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500">
                <span>Initial Pool: {seedXlm} XLM</span>
                <span>•</span>
                <span>Supply: 1,000,000,000</span>
                {website ? (
                  <>
                    <span>•</span>
                    <span className="text-cyan-400">🌐 Website</span>
                  </>
                ) : null}
                {telegram ? (
                  <>
                    <span>•</span>
                    <span className="text-sky-400">✈️ Telegram</span>
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

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
          >
            {busy
              ? 'Launching on testnet…'
              : expert
                ? 'Deploy Contract (Expert Mode)'
                : `🚀 Launch Fair Launch ($${PROTOCOL_DEPLOY_FEE_USD.toFixed(2)} USD · 1% Creator · 99% Pool)`}
          </button>
        </div>

        {busy ? (
          <div className="sm:col-span-2">
            <TxProgress
              steps={
                expert
                  ? [
                      {
                        label: 'Deploying SEP-41 contract and minting supply',
                        status: 'active',
                      },
                    ]
                  : [
                      {
                        label: '1/3 Deploying SEP-41 contract (1,000,000,000 tokens)',
                        status: step === 'deploy' ? 'active' : 'done',
                      },
                      {
                        label: '2/3 Seeding 99% (990M) to pool & burning LP to GAAAA...WHF',
                        status:
                          step === 'deploy'
                            ? 'pending'
                            : step === 'liquidity'
                              ? 'active'
                              : 'done',
                      },
                      {
                        label: '3/3 Renouncing ownership (mint disabled forever)',
                        status:
                          step === 'renounce' || step === 'dev-buy'
                            ? 'active'
                            : 'pending',
                      },
                    ]
              }
            />
          </div>
        ) : null}
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300"
        >
          {error}
        </p>
      ) : null}

      {createdId ? (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-200">
          <p className="font-semibold">
            {fairLaunched
              ? `🚀 Fair Launch completed successfully for ${symbol || 'Token'}!`
              : `Token deployed on testnet`}
          </p>
          <p className="break-all font-mono text-xs text-slate-300">
            Contract ID: {createdId}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              to={`/token/${createdId}`}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400"
            >
              Open Token Page →
            </Link>
            <a
              href={explorerContractUrl(createdId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-emerald-700 px-4 py-2 text-xs text-emerald-200 hover:border-emerald-500"
            >
              View in Stellar Explorer ↗
            </a>
            <ShareButton
              text={`🌊 Just launched $${symbol || 'TOKEN'} on AstroGate (Stellar testnet)! Trade live:`}
              url={
                typeof window !== 'undefined'
                  ? `${window.location.origin}/token/${createdId}`
                  : `/token/${createdId}`
              }
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
