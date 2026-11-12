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

const BURN_PRESETS = ['10', '100', '1000', '5000']

function storageKey(tokenId: string) {
  return `astrogate.hype.v1.${tokenId}`
}

/**
 * Honest initial empty state: reactions are local to this browser
 * (there is no on-chain likes indexer); burns have verifiable on-chain tx hashes.
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

  // When navigating between tokens on the same route (/token/:id does not remount):
  // reload the hype for the current token so Token A state is not rendered on Token B.
  // State with embedded `tokenId`: on token change, the render displays the new state.
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 shadow-sm space-y-3">
      {/* Sleek Header & Reactions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <h2 className="text-sm font-bold text-white">Community Thread</h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-400">
            {hype.comments.length}
          </span>
          {pairId ? (
            <a
              href={explorerContractUrl(pairId)}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-slate-500 hover:text-slate-300 underline"
            >
              pair ↗
            </a>
          ) : null}
        </div>

        {/* Compact Reactions Row */}
        <div className="flex items-center gap-1.5">
          {REACTION_META.map((meta) => {
            const count = hype.reactions[meta.key] ?? 0
            const isVoted = voted[meta.key]
            return (
              <button
                key={meta.key}
                type="button"
                onClick={() => handleReact(meta.key)}
                title={meta.label}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-mono transition-all ${
                  isVoted
                    ? 'border-sky-400/50 bg-sky-500/20 text-sky-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span>{meta.emoji}</span>
                <span className="text-[11px] font-bold">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat Input & Burn Mode Toggle */}
      <div className="space-y-3">
        <form onSubmit={handleCommentSubmit} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            aria-label={`Comment on $${symbol}`}
            placeholder={`Say something about $${symbol}…`}
            maxLength={160}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-sky-500 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-40 transition-colors"
          >
            Post
          </button>
          <button
            type="button"
            onClick={() => setChatMode((m) => (m === 'burn' ? 'free' : 'burn'))}
            title={chatMode === 'burn' ? 'Switch to free comment' : 'Burn-to-Chat (on-chain)'}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all flex items-center gap-1 ${
              chatMode === 'burn'
                ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-amber-400'
            }`}
          >
            <span>🔥</span>
            <span className="hidden sm:inline text-[11px]">Burn</span>
          </button>
        </form>

        {chatMode === 'burn' ? (
          /* Mode 2: Burn-to-Chat (On-Chain) */
          <form onSubmit={handleBurnShout} className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/15 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-300 flex items-center gap-1">
                <span>🔥</span> Burn ${symbol} tokens to broadcast permanently on-chain
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Bag: <strong className="text-slate-200">{userBal}</strong> ${symbol}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">Burn amount:</span>
              {BURN_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBurnAmount(p)}
                  className={`inline-flex min-h-[30px] items-center rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${
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
                aria-label="Custom burn amount"
                className="h-8 w-20 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-amber-500 placeholder:text-slate-500"
                placeholder="Custom"
              />
            </div>

            <input
              type="text"
              value={burnMessage}
              onChange={(e) => setBurnMessage(e.target.value)}
              aria-label={`Message stamped on-chain with ${burnAmount} $${symbol} burned`}
              placeholder={`On-chain message with ${burnAmount} $${symbol} burned…`}
              maxLength={160}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500 placeholder:text-slate-500"
            />

            {!publicKey ? (
              <button
                type="button"
                onClick={() => void connect()}
                className="min-h-[40px] w-full rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                Connect Wallet to Burn & Chat
              </button>
            ) : (
              <button
                type="submit"
                disabled={burnBusy || !burnAmount || Number(burnAmount) <= 0}
                className="min-h-[40px] w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 px-4 py-2 text-xs font-black text-slate-950 transition-all disabled:opacity-50"
              >
                {burnBusy
                  ? 'Burning tokens on-chain…'
                  : `🔥 Burn ${burnAmount} $${symbol} & Broadcast`}
              </button>
            )}

            {burnError ? (
              <p className="text-xs text-rose-300">{burnError}</p>
            ) : null}
          </form>
        ) : null}
      </div>

      {/* Comment Feed */}
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {hype.comments.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No comments yet · Be the first to shout about ${symbol}!
          </p>
        ) : (
          hype.comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl px-3 py-2 text-xs transition-all ${
                comment.isBurn
                  ? 'border border-amber-500/40 bg-amber-950/20'
                  : 'border border-slate-800/60 bg-slate-950/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono font-bold text-slate-300 text-[11px]">
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
                      className="text-[10px] text-amber-400 underline hover:text-amber-300"
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
