import { CreateTokenForm } from '../components/CreateTokenForm'
import { useCreatedTokens } from '../store/creations'
import type { LaunchpadToken } from '../lib/token'

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
          <span>🚀</span> Launch Your Token
        </h1>
        <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-400">
          Deploy memecoin with instant Soroswap pool, 100% burned LP, and renounced ownership in 1 atomic transaction.
        </p>
      </div>

      <CreateTokenForm onCreated={onCreated} />
    </div>
  )
}
