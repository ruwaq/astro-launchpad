import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWallet } from '../store/wallet'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { tokenClient } from '../lib/token'
import { recordActivity } from '../store/activity'
import { invalidateTokenData } from '../lib/query'
import { toast } from '../lib/toast'
import { shortAddress, formatAmount, parseAmount, errorMessage } from '../lib/format'
import { explorerContractUrl, explorerTxUrl } from '../lib/explorer'
import {
  readStorageJson,
  writeStorageJson,
} from '../lib/storage'

type ReactionKey = 'rocket' | 'fire' | 'diamond' | 'whale'

export type HypeComment = {
  id: string
  author: string
  text: string
  at: number
  isBurn?: boolean
  burnedAmount?: string
  txHash?: string
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
  '🚀 Heading straight to graduation on Soroswap!',
  '🔥 100% LP burned to dead address & renounced owner — safu!',
  '💎 Diamond hands holding strong!',
  '👑 This memecoin is taking King of the Hill!',
] as const

const BURN_PRESETS = ['10', '100', '1000', '5000']

function storageKey(tokenId: string) {
  return `astrogate.hype.v1.${tokenId}`
}

/**
 * Estado vacío y HONESTO: las reacciones-guarda son locales de este navegador
 * (no hay indexer de likes on-chain); las burns sí tienen tx verificable.
 * Nada de datos inventados como "seed" que parezcan comunidad real.
 */
const EMPTY_HYPE: TokenHypeState = {
  reactions: { rocket: 0, fire: 0, diamond: 0, whale: 0 },
  comments: [],
}

function loadHype(tokenId: string): TokenHypeState {
  const parsed =
    readStorageJson<Partial<TokenHypeState>>(storageKey(tokenId)) ?? null
  if (!parsed || typeof parsed !== 'object') return EMPTY_HYPE
  return {
    reactions: {
      ...EMPTY_HYPE.reactions,
      ...(typeof parsed.reactions === 'object' && parsed.reactions !== null
        ? parsed.reactions
        : {}),
    },
    comments: Array.isArray(parsed.comments) ? parsed.comments.slice(0, 40) : [],
  }
}

function createHypeComment(
  author: string,
  text: string,
  burnMeta?: { burnedAmount: string; txHash?: string },
): HypeComment {
  const now = Date.now()
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
    author,
    text: text.slice(0, 160),
    at: now,
    isBurn: Boolean(burnMeta),
    burnedAmount: burnMeta?.burnedAmount,
    txHash: burnMeta?.txHash,
  }
}

export function TokenHypeBar({
  tokenId,
  symbol,
  pairId,
  decimals = 7,
}: {
  tokenId: string
  symbol: string
  pairId?: string | null
  decimals?: number
}) {
  const { publicKey, getSigner, connect } = useWallet()
  const queryClient = useQueryClient()
  const balance = useTokenBalance(publicKey, tokenId)

  const [hype, setHype] = useState<TokenHypeState>(() => loadHype(tokenId))
  const [voted, setVoted] = useState<Record<string, boolean>>({})
  const [chatMode, setChatMode] = useState<'free' | 'burn'>('free')

  // Al navegar entre tokens por la misma ruta (/token/:id no remonta):
  // se re-carga el hype del token actual o el de A se pinta sobre B.
  // Estado con `tokenId` incrustado: al cambiar de token, el render ya
  // muestra el estado nuevo (y si localStorage falla, `null` → vacío).
  const [stateForToken, setStateForToken] = useState(tokenId)

  if (stateForToken !== tokenId) {
    setStateForToken(tokenId)
    setHype(loadHype(tokenId))
    setVoted({})
    setChatMode('free')
  }

  // Free shout state
  const [commentText, setCommentText] = useState('')

  // Burn shout state
  const [burnAmount, setBurnAmount] = useState('10')
  const [burnMessage, setBurnMessage] = useState('')
  const [burnBusy, setBurnBusy] = useState(false)
  const [burnError, setBurnError] = useState<string | null>(null)

  function persist(next: TokenHypeState) {
    setHype(next)
    writeStorageJson(storageKey(tokenId), next)
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
      comments: [newComment, ...hype.comments].slice(0, 40),
    })
    setCommentText('')
  }

  function handleQuickShout(shout: string) {
    const author = publicKey ? shortAddress(publicKey) : 'Anon Trader'
    const newComment = createHypeComment(author, shout)
    persist({
      ...hype,
      comments: [newComment, ...hype.comments].slice(0, 40),
    })
  }

  async function handleBurnShout(event: React.FormEvent) {
    event.preventDefault()
    setBurnError(null)

    if (!publicKey) {
      void connect()
      return
    }

    const signer = getSigner()
    if (!signer) {
      setBurnError('Unable to prepare wallet signer.')
      return
    }

    const amountBase = parseAmount(burnAmount, decimals)
    if (amountBase <= 0n) {
      setBurnError('Please enter an amount of tokens to burn greater than 0.')
      return
    }

    if (balance.data !== undefined && amountBase > balance.data) {
      setBurnError(`Insufficient $${symbol} balance. You hold ${formatAmount(balance.data, decimals)} $${symbol}.`)
      return
    }

    const cleanMsg = burnMessage.trim() || `🔥 Burned ${burnAmount} $${symbol} to pump community hype!`

    setBurnBusy(true)
    let hash: string | undefined
    try {
      const client = tokenClient(tokenId, signer)
      const tx = await client.burn({
        from: publicKey,
        amount: amountBase,
      })
      const sentTx = await tx.signAndSend()
      hash = sentTx.sendTransactionResponse?.hash

      const newComment = createHypeComment(shortAddress(publicKey), cleanMsg, {
        burnedAmount: burnAmount,
        txHash: hash,
      })

      persist({
        ...hype,
        comments: [newComment, ...hype.comments].slice(0, 40),
      })

      recordActivity({
        kind: 'burn',
        tokenId,
        tokenSymbol: symbol,
        amount: burnAmount,
        account: publicKey,
        hash,
      })

      toast.success('Tokens burned & shouted on-chain!', {
        message: `Burned ${burnAmount} $${symbol} permanently on Soroban testnet`,
        hash,
      })

      setBurnMessage('')
      await invalidateTokenData(queryClient, tokenId)
    } catch (err) {
      setBurnError(errorMessage(err))
    } finally {
      setBurnBusy(false)
    }
  }

  const userBal = balance.data !== undefined ? formatAmount(balance.data, decimals) : '0'

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>🔥</span> Community Hype Wall & Chat
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Local sentiment for ${symbol}: reactions and shouts live in this
            browser; burns are verified on-chain.
          </p>
        </div>

        {pairId ? (
          <a
            href={explorerContractUrl(pairId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 px-3 text-xs text-slate-300 hover:border-emerald-500 hover:text-emerald-300 transition-colors"
          >
            <span>Pair</span>
            <span className="font-mono text-[11px] text-slate-400">
              {shortAddress(pairId)}
            </span>
            <span>↗</span>
          </a>
        ) : null}
      </div>

      {/* Live Reaction Buttons */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Reactions (local browser sentiment)
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

      {/* Quick Shouts */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          1-Tap Quick Shouts
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_SHOUTS.map((shout) => (
            <button
              key={shout}
              type="button"
              onClick={() => handleQuickShout(shout)}
              className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors"
            >
              {shout}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Selector Tabs: Free Shout vs Burn-to-Chat */}
      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-1">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setChatMode('free')}
            className={`min-h-[38px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              chatMode === 'free'
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>💬</span> Free Shout
          </button>
          <button
            type="button"
            onClick={() => setChatMode('burn')}
            className={`min-h-[38px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              chatMode === 'burn'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            <span>🔥</span> Burn-to-Chat (On-Chain)
          </button>
        </div>
      </div>

      {/* Mode 1: Free Shout */}
      {chatMode === 'free' ? (
        <form onSubmit={handleCommentSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={`Shout something about $${symbol}…`}
            maxLength={160}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500 placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="min-h-[44px] rounded-xl bg-emerald-500 px-5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      ) : (
        /* Mode 2: Burn-to-Chat (On-Chain) */
        <form onSubmit={handleBurnShout} className="mt-3 space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/10 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <span>🔥</span> Burn ${symbol} tokens to shout permanently on-chain
            </span>
            <span className="text-slate-400">
              Your bag: <strong className="text-slate-200 font-mono">{userBal}</strong> ${symbol}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400">Amount to burn:</span>
            {BURN_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setBurnAmount(p)}
                className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${
                  burnAmount === p
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
            <input
              type="number"
              min="1"
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
              className="w-24 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-amber-500"
              placeholder="Custom"
            />
          </div>

          <input
            type="text"
            value={burnMessage}
            onChange={(e) => setBurnMessage(e.target.value)}
            placeholder={`Message stamped on-chain with ${burnAmount} $${symbol} burned…`}
            maxLength={160}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500 placeholder:text-slate-600"
          />

          {!publicKey ? (
            <button
              type="button"
              onClick={() => void connect()}
              className="min-h-[44px] w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-black text-slate-950 hover:from-amber-400 hover:to-amber-500 transition-colors shadow-md shadow-amber-500/20"
            >
              🔌 Connect Wallet to Burn & Chat
            </button>
          ) : (
            <button
              type="submit"
              disabled={burnBusy || !burnAmount || Number(burnAmount) <= 0}
              className="min-h-[44px] w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 px-4 py-2.5 text-xs font-black text-slate-950 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {burnBusy
                ? '⏳ Burning tokens on Soroban testnet…'
                : `🔥 Burn ${burnAmount} $${symbol} & Broadcast On-Chain`}
            </button>
          )}

          {burnError ? (
            <p className="text-xs text-rose-300">{burnError}</p>
          ) : null}
        </form>
      )}

      {/* Comment Feed with Proof-of-Burn Badges */}
      <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto pr-1">
        {hype.comments.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No shouts yet. Be the first to drop a hype message for ${symbol}!
          </p>
        ) : (
          hype.comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl px-3.5 py-2.5 text-xs transition-all ${
                comment.isBurn
                  ? 'border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-orange-950/20 to-slate-950/60 shadow-sm shadow-amber-500/5'
                  : 'border border-slate-800/60 bg-slate-950/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono font-bold text-slate-300">
                    {comment.author}
                  </span>
                  {comment.isBurn ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                      <span>🔥</span>
                      <span>BURNED {comment.burnedAmount ?? '1'} ${symbol}</span>
                    </span>
                  ) : null}
                  {comment.txHash ? (
                    <a
                      href={explorerTxUrl(comment.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-amber-400 underline underline-offset-2 hover:text-amber-300"
                    >
                      on-chain ↗
                    </a>
                  ) : null}
                </div>
                <span className="shrink-0 text-[10px] text-slate-500 font-mono">
                  {timeAgo(comment.at)}
                </span>
              </div>
              <p className="mt-1 text-slate-200 break-words leading-relaxed">
                {comment.text}
              </p>
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
