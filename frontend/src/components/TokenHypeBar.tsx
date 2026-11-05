import { useState } from 'react'
import { useWallet } from '../store/wallet'
import { shortAddress } from '../lib/format'
import { explorerContractUrl } from '../lib/explorer'

type ReactionKey = 'rocket' | 'fire' | 'diamond' | 'whale'

type HypeComment = {
  id: string
  author: string
  text: string
  at: number
}

type TokenHypeState = {
  reactions: Record<ReactionKey, number>
  comments: HypeComment[]
}

const REACTION_META: Array<{
  key: ReactionKey
  emoji: string
  label: string
}> = [
  { key: 'rocket', emoji: '🚀', label: 'To the Moon' },
  { key: 'fire', emoji: '🔥', label: 'On Fire' },
  { key: 'diamond', emoji: '💎', label: 'Diamond Hands' },
  { key: 'whale', emoji: '🐳', label: 'Whale Alert' },
]

const QUICK_SHOUTS = [
  '🚀 Heading to 1,000 XLM and Soroswap DEX graduation!',
  '🔥 100% LP burned to GAAAA...WHF & renounced owner — safu',
  '💎 Stacking more on the bonding curve before graduation',
  '👑 This token is aiming straight for King of the Hill!',
] as const

function storageKey(tokenId: string) {
  return `astrogate:hype:v1:${tokenId}`
}

function seedFromId(tokenId: string): TokenHypeState {
  let hash = 0
  for (let i = 0; i < tokenId.length; i++) {
    hash = (hash * 31 + tokenId.charCodeAt(i)) >>> 0
  }
  return {
    reactions: {
      rocket: 12 + (hash % 29),
      fire: 8 + ((hash >> 3) % 21),
      diamond: 5 + ((hash >> 6) % 15),
      whale: 2 + ((hash >> 9) % 9),
    },
    comments: [
      {
        id: 'seed-1',
        author: 'GFAIR...LAUNCH',
        text: '🌊 SEP-41 pair verified on-chain on Soroswap Testnet.',
        at: Date.now() - 180_000,
      },
    ],
  }
}

function loadHype(tokenId: string): TokenHypeState {
  const fallback = seedFromId(tokenId)
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(storageKey(tokenId))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<TokenHypeState>
    if (!parsed || typeof parsed !== 'object') return fallback
    return {
      reactions: {
        ...fallback.reactions,
        ...(parsed.reactions ?? {}),
      },
      comments: Array.isArray(parsed.comments)
        ? parsed.comments.slice(0, 30)
        : fallback.comments,
    }
  } catch {
    return fallback
  }
}

function createHypeComment(author: string, text: string): HypeComment {
  const now = Date.now()
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
    author,
    text: text.slice(0, 160),
    at: now,
  }
}

export function TokenHypeBar({
  tokenId,
  symbol,
  pairId,
}: {
  tokenId: string
  symbol: string
  pairId?: string | null
}) {
  const { publicKey } = useWallet()
  const [hype, setHype] = useState<TokenHypeState>(() => loadHype(tokenId))
  const [commentText, setCommentText] = useState('')
  const [voted, setVoted] = useState<Record<string, boolean>>({})

  function persist(next: TokenHypeState) {
    setHype(next)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey(tokenId), JSON.stringify(next))
      } catch {
        // Ignore storage write quota errors
      }
    }
  }

  function handleReact(key: ReactionKey) {
    if (voted[key]) return
    setVoted((prev) => ({ ...prev, [key]: true }))
    persist({
      ...hype,
      reactions: {
        ...hype.reactions,
        [key]: (hype.reactions[key] ?? 0) + 1,
      },
    })
  }

  function handleCommentSubmit(event: React.FormEvent) {
    event.preventDefault()
    const clean = commentText.trim()
    if (!clean) return
    const author = publicKey ? shortAddress(publicKey) : 'Anon Trader'
    const newComment = createHypeComment(author, clean)
    persist({
      ...hype,
      comments: [newComment, ...hype.comments].slice(0, 30),
    })
    setCommentText('')
  }

  function handleQuickShout(shout: string) {
    const author = publicKey ? shortAddress(publicKey) : 'Anon Trader'
    const newComment = createHypeComment(author, shout)
    persist({
      ...hype,
      comments: [newComment, ...hype.comments].slice(0, 30),
    })
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            🔥 Community Hype & Chat
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Real-time sentiment for ${symbol}. React and shoutout to the community.
          </p>
        </div>

        {pairId ? (
          <a
            href={explorerContractUrl(pairId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 px-3 text-xs text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
          >
            <span>Pair contract</span>
            <span className="font-mono text-[11px] text-slate-400">
              {shortAddress(pairId)}
            </span>
            <span>↗</span>
          </a>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Live Reactions
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REACTION_META.map((meta) => {
            const count = hype.reactions[meta.key] ?? 0
            const isVoted = voted[meta.key]
            return (
              <button
                key={meta.key}
                type="button"
                onClick={() => handleReact(meta.key)}
                className={`flex min-h-[44px] items-center justify-between rounded-xl border px-3 py-2 text-xs transition-colors ${
                  isVoted
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-base">{meta.emoji}</span>
                  <span>{meta.label}</span>
                </span>
                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Quick Shouts
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_SHOUTS.map((shout) => (
            <button
              key={shout}
              type="button"
              onClick={() => handleQuickShout(shout)}
              className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              {shout}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleCommentSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={`Shout something about $${symbol}…`}
          maxLength={160}
          className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!commentText.trim()}
          className="min-h-[44px] rounded-lg bg-emerald-500 px-4 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <div className="mt-4 max-h-56 space-y-2 overflow-y-auto no-scrollbar">
        {hype.comments.length === 0 ? (
          <p className="text-xs text-slate-500">
            No shouts yet. Be the first to shout about ${symbol}!
          </p>
        ) : (
          hype.comments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-800/60 bg-slate-950/50 px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <span className="font-mono font-semibold text-emerald-400">
                  {comment.author}:
                </span>{' '}
                <span className="text-slate-200">{comment.text}</span>
              </div>
              <span className="shrink-0 text-[10px] text-slate-500">
                {timeAgo(comment.at)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function timeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  return `${diffHour}h ago`
}
