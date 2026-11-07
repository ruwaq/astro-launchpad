import { CreateTokenForm } from '../components/CreateTokenForm'
import { useCreatedTokens } from '../store/creations'
import type { LaunchpadToken } from '../lib/token'

const LAUNCH_STEPS = [
  {
    icon: '✨',
    title: '1. Configura tu Moneda',
    hint: 'Nombre, símbolo, logo y Telegram. Fee único de deploy: $1.11 USD.',
  },
  {
    icon: '⚡',
    title: '2. Pool Soroswap Automático',
    hint: 'El pool se crea de forma 100% automática y los LP se queman en dead address.',
  },
  {
    icon: '🚀',
    title: '3. Trading en Vivo al Instante',
    hint: 'La comunidad puede comprar y vender inmediatamente en la curva sin pasos extras.',
  },
]

export function CreatePage() {
  const addCreatedToken = useCreatedTokens((state) => state.add)

  function onCreated(token: LaunchpadToken) {
    addCreatedToken({
      id: token.id,
      symbol: token.symbol,
      decimals: token.decimals,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl flex items-center gap-2">
          <span>🎮</span> Launch Your Token
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Crea y lanza tu moneda en Stellar en segundos. Cero configuración manual: el token, el pool en Soroswap y la quema de LP se ejecutan automáticamente en un solo flujo.
        </p>
      </div>

      <ol
        aria-label="How a token launches into the market"
        className="grid gap-3 sm:grid-cols-3"
      >
        {LAUNCH_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                {index + 1}
              </span>
              <span className="text-base">{step.icon}</span>
              <p className="text-sm font-bold text-slate-200">
                {step.title}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">{step.hint}</p>
          </li>
        ))}
      </ol>

      <CreateTokenForm onCreated={onCreated} />
    </div>
  )
}
