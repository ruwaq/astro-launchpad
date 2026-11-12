import { useState } from 'react'
import { useNavigate } from 'react-router'
import { MarketList } from '../components/MarketList'
import { GraduationRadar } from '../components/GraduationRadar'
import { NewLaunchesFeed } from '../components/NewLaunchesFeed'
import { useTokenList } from '../hooks/useTokenList'
import type { LaunchpadToken } from '../lib/token'

export function MarketPage() {
  const navigate = useNavigate()
  const list = useTokenList()
  const [tab, setTab] = useState<'all' | 'graduating' | 'fresh'>('all')

  function openToken(token: LaunchpadToken) {
    navigate(`/token/${token.id}`)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="liquid-glass-pill rounded-full px-3 py-1 text-xs font-semibold text-sky-300">
              ✦ Stellar Fair Launch & AMM
            </span>
            <span className="text-xs font-mono text-slate-500">Soroswap Testnet</span>
          </div>
          <h1 className="mt-2 text-2xl font-black sm:text-4xl text-white tracking-tight">
            Memecoin & Token Market
          </h1>
          <p className="mt-1 max-w-2xl text-sm sm:text-base text-slate-300">
            Explore fair-launch memecoins and decentralized liquidity pools on Stellar.
            Instant Soroswap AMM trading, 100% burned LP, and renounced ownership.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-2xl bg-white/[0.04] p-1 border border-white/[0.08] shrink-0">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'all'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Tokens
          </button>
          <button
            type="button"
            onClick={() => setTab('graduating')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'graduating'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🎓 Moonshot Radar
          </button>
          <button
            type="button"
            onClick={() => setTab('fresh')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'fresh'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚡ Fresh Launches
          </button>
        </div>
      </div>

      {tab === 'graduating' ? (
        <section className="space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🎓</span> Graduating Soon · Moonshot Radar
            </h2>
            <p className="text-xs text-slate-400">
              Tokens climbing the bonding curve towards the 2,000 XLM Soroswap DEX graduation milestone.
            </p>
          </div>
          <GraduationRadar
            tokens={list.data ?? []}
            isLoading={list.isPending}
            onSelect={openToken}
          />
        </section>
      ) : tab === 'fresh' ? (
        <section className="space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⚡</span> Fresh Token Launches
            </h2>
            <p className="text-xs text-slate-400">
              The newest fair launches deployed with 100% burned LP on Stellar.
            </p>
          </div>
          <NewLaunchesFeed
            tokens={list.data ?? []}
            isLoading={list.isPending}
            onSelect={openToken}
          />
        </section>
      ) : (
        <div className="space-y-8">
          {/* Quick highlights row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <span>🎓</span> Moonshot Radar
                </span>
                <button
                  type="button"
                  onClick={() => setTab('graduating')}
                  className="text-[11px] font-semibold text-slate-400 hover:text-amber-300 transition"
                >
                  View all →
                </button>
              </div>
              <GraduationRadar
                tokens={list.data?.slice(0, 2) ?? []}
                isLoading={list.isPending}
                onSelect={openToken}
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>⚡</span> Fresh Launches
                </span>
                <button
                  type="button"
                  onClick={() => setTab('fresh')}
                  className="text-[11px] font-semibold text-slate-400 hover:text-emerald-300 transition"
                >
                  View all →
                </button>
              </div>
              <NewLaunchesFeed
                tokens={list.data?.slice(0, 2) ?? []}
                isLoading={list.isPending}
                onSelect={openToken}
              />
            </section>
          </div>

          <MarketList selectedId={null} onSelect={openToken} />
        </div>
      )}
    </div>
  )
}
