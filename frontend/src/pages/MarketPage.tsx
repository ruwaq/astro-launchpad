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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="liquid-glass-pill rounded-full px-3 py-1 text-xs font-semibold text-sky-300">
              ✦ Stellar Fair Launch & AMM
            </span>
            <span className="text-xs font-mono text-slate-500">Soroswap Testnet</span>
          </div>
          <h1 className="mt-2 text-2xl font-black sm:text-4xl text-white tracking-tight">
            Memecoin & Token Discovery Market
          </h1>
          <p className="mt-1 max-w-2xl text-sm sm:text-base text-slate-300">
            Explore verified fair-launch memecoins and decentralized liquidity pools on Stellar.
            Every token features instant Soroswap trading, 100% burned LP, and renounced ownership.
          </p>
        </div>
      </div>
      <MarketList selectedId={null} onSelect={openToken} />
    </div>
  )
}
