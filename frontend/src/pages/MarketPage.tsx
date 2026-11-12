import { useNavigate } from 'react-router'
import { MarketList } from '../components/MarketList'
import type { LaunchpadToken } from '../lib/token'

export function MarketPage() {
  const navigate = useNavigate()

  function openToken(token: LaunchpadToken) {
    navigate(`/token/${token.id}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="liquid-glass-pill rounded-full px-3 py-1 text-xs font-semibold text-sky-300">
            ✦ Stellar Soroban Fair Launch
          </span>
          <span className="text-xs font-mono text-slate-500">Soroswap Testnet</span>
        </div>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl text-white tracking-tight">
          Memecoin Market
        </h1>
        <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-400">
          Discover and trade fair-launch tokens. 100% burned LP, instant Soroswap AMM liquidity, and renounced ownership.
        </p>
      </div>

      <MarketList selectedId={null} onSelect={openToken} />
    </div>
  )
}
