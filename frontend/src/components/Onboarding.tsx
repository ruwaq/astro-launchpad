import { useState } from 'react'
import { Link } from 'react-router'
import { useWallet } from '../store/wallet'
import { BRAND } from '../lib/brand'

const KEY = 'astrogate.onboarding.v1'

type Props = {
  created: boolean
  liquidity: boolean
  swapped: boolean
  preview?: 'open' | 'collapsed'
  createHref?: string
  marketHref?: string
}

type Step = {
  key: string
  title: string
  hint: string
  done: boolean
  href?: string
  onClick?: () => void
}

export function Onboarding({
  created,
  liquidity,
  swapped,
  preview,
  createHref = '/create',
  marketHref = '/market',
}: Props) {
  const { publicKey, connect } = useWallet()
  const [dismissed, setDismissed] = useState(() => {
    if (preview) return false
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })

  const connected = Boolean(publicKey)
  const steps: Step[] = [
    {
      key: 'wallet',
      title: 'Connect Wallet',
      hint: 'Freighter, xBull… or activate demo mode below',
      done: connected,
      onClick: connected ? undefined : () => void connect(),
    },
    {
      key: 'create',
      title: 'Launch Your Token',
      hint: 'Fair Launch: 99% pool + 100% LP burned',
      done: created,
      href: createHref,
    },
    {
      key: 'liquidity',
      title: 'Seed Liquidity',
      hint: 'Token is instantly tradeable across AMM',
      done: liquidity,
      href: liquidity ? undefined : createHref,
    },
    {
      key: 'swap',
      title: 'Swap & Trade',
      hint: 'Pick any token from market and trade live with XLM',
      done: swapped,
      href: marketHref,
    },
  ]

  const doneCount = steps.filter((step) => step.done).length
  const allDone = doneCount === steps.length
  const nextStep = steps.find((step) => !step.done)
  const expanded = preview ? preview === 'open' : !dismissed

  if (!expanded) {
    if (allDone && !preview) return null
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="inline-flex w-fit min-h-[44px] items-center gap-2 rounded-full border border-emerald-900 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-300"
      >
        <span className="flex gap-0.5">
          {steps.map((step) => (
            <span
              key={step.key}
              className={`h-1.5 w-1.5 rounded-full ${step.done ? 'bg-emerald-400' : 'bg-slate-700'}`}
            />
          ))}
        </span>
        {doneCount}/4 · Next: {nextStep?.title ?? 'all done ✓'} — view guide
      </button>
    )
  }

  function close() {
    setDismissed(true)
    try {
      window.localStorage.setItem(KEY, '1')
    } catch {
      // Storage unavailable
    }
  }

  return (
    <section className="rounded-xl border border-emerald-900 bg-emerald-950/20 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-emerald-200">
            {BRAND.emoji} Welcome to {BRAND.name}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Launch fair memecoins on Stellar in 4 simple steps — free on testnet.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close guide"
          className="min-h-[44px] min-w-[44px] rounded-lg text-slate-500 hover:text-slate-300"
        >
          ✕
        </button>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((step, index) => {
          const content = (
            <span className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-700 text-slate-300'
                }`}
              >
                {step.done ? '✓' : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-medium ${step.done ? 'text-emerald-300' : 'text-slate-200'}`}
                >
                  {step.title}
                  {!step.done && step === nextStep ? (
                    <span className="ml-2 text-xs text-emerald-400">
                      ← you are here
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs text-slate-500">
                  {step.hint}
                </span>
              </span>
            </span>
          )
          const rowClass = `block w-full min-h-[52px] rounded-lg border p-3 text-left ${
            step.done
              ? 'border-emerald-900/60 bg-emerald-950/10'
              : step === nextStep
                ? 'border-emerald-800 bg-slate-900/60'
                : 'border-slate-800'
          }`
          return (
            <li key={step.key}>
              {step.href ? (
                <Link to={step.href} className={rowClass}>
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={!step.onClick && !step.done}
                  onClick={step.onClick}
                  className={`${rowClass} disabled:cursor-default`}
                >
                  {content}
                </button>
              )}
            </li>
          )
        })}
      </ol>

      <button
        type="button"
        onClick={close}
        className="mt-3 min-h-[44px] w-full rounded-lg border border-slate-800 px-4 text-sm text-slate-300 hover:border-slate-600"
      >
        Got it, hide guide
      </button>
    </section>
  )
}
