import { useNavigate } from 'react-router'
import { MarketList } from '../components/MarketList'
import type { LaunchpadToken } from '../lib/token'

export function MarketPage() {
  const navigate = useNavigate()

  function openToken(token: LaunchpadToken) {
    navigate(`/token/${token.id}`)
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Live Market</h1>
        <p className="mt-1 max-w-2xl text-slate-400">
          Token/XLM pairs discovered on-chain directly from Soroswap. Search, sort,
          and select any token to trade, provide liquidity, or transfer.
        </p>
      </div>
      <MarketList selectedId={null} onSelect={openToken} />
    </>
  )
}
