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

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'

const SEED_XLM_PRESETS = ['10', '25', '50', '100'] as const

type LaunchStep =
  | 'deploy'
  | 'liquidity'
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
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<LaunchStep>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [fairLaunched, setFairLaunched] = useState(false)

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
