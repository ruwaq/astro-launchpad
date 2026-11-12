/**
 * @file AstroGate AI & Developer SDK
 * @description Lightweight, typed SDK designed for autonomous AI agents, trading bots,
 * and external developers building on Stellar/Soroban.
 */

import {
  discoverTokens,
  fetchLaunchpadRecord,
  type TokenListing,
} from '../lib/discovery'
import {
  fetchBurnedLpInfo,
  fetchPoolState,
  formatTokenPrice,
  localQuoteTokenForXlm,
  localQuoteXlmForToken,
  priceImpactPercent,
  quoteTokenForXlm,
  quoteXlmForToken,
  SOROSWAP_MINIMUM_LIQUIDITY,
  tokenPriceInXlmNumber,
  withSlippage,
  type PoolState,
} from '../lib/soroswap'
import {
  burnAndShout,
  extendTokenTtl,
  launchFairAtomic,
  tokenClient,
} from '../lib/token'
import { decodeOnChainMeta, encodeOnChainMeta } from '../lib/token-metadata'
import type { Signer } from '@stellar/stellar-sdk/contract'
import { isValidContractAddress } from '../lib/address'
import {
  ASTRO_TOKEN_ID,
  ASTRO_WASM_HASH,
  checkRpcHealth,
  executeWithRpcFailover,
  LAUNCHPAD_CONTRACT_ID,
  LAUNCHPAD_WASM_HASH,
  NETWORK_NAME,
  NETWORK_PASSPHRASE,
  RPC_POOL,
  RPC_URL,
  SOROSWAP_FACTORY,
  SOROSWAP_ROUTER,
  XLM_SAC,
} from '../lib/network'
import { STELLAR_BURN_ADDRESS, graduationProgress } from '../lib/tokenomics'
import { formatAmount } from '../lib/format'
import {
  classifyTokenEvent,
  fetchTokenEvents,
  fetchTokenShouts,
  parseTokenEvent,
  type TokenEvent,
  type TokenShout,
  type TokenTradeRole,
} from '../lib/token-events'

export interface SdkTokenOverview {
  id: string
  name: string
  symbol: string
  decimals: number
  pairId: string | null
  priceXlm: string
  reserveToken: string
  reserveXlm: string
  graduationPercent: number
  isGraduated: boolean
}

export interface SdkQuoteResult {
  direction: 'buy' | 'sell'
  amountIn: string
  amountOutEstimated: string
  amountOutMinimum: string
  priceImpactPercent: number
}

export interface AntiRugAuditResult {
  tokenId: string
  pairId: string | null
  lpBurnAddress: string
  ownershipRenounced: boolean
  lpBurned: boolean
  verifiedLaunchpad: boolean
  isAntiRugVerified: boolean
  auditNotes: string[]
}

export interface SdkTokenDetails {
  id: string
  name: string
  symbol: string
  decimals: number
  pool: PoolState
  priceXlm: string
  graduation: ReturnType<typeof graduationProgress>
}

/**
 * Retrieves the live active token market list.
 * Fast in-memory / IndexedDB read with automatic on-chain synchronization.
 */
export async function getMarketTokens(options?: {
  maxTokens?: number
}): Promise<SdkTokenOverview[]> {
  const listings = await discoverTokens(options)
  return listings.map((token: TokenListing) => {
    const grad = graduationProgress(token.pool.reserveXlm)
    return {
      id: token.id,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      pairId: token.pool.pairId,
      priceXlm: formatTokenPrice(tokenPriceInXlmNumber(token.pool, token.decimals)),
      reserveToken: formatAmount(token.pool.reserveToken, token.decimals),
      reserveXlm: formatAmount(token.pool.reserveXlm, 7),
      graduationPercent: grad.percent,
      isGraduated: grad.graduated,
    }
  })
}

/**
 * Retrieves complete on-chain status and metadata for a specific token.
 */
export async function getTokenDetails(tokenId: string): Promise<SdkTokenDetails> {
  if (!isValidContractAddress(tokenId)) {
    throw new Error(`Invalid Stellar contract address: ${tokenId}`)
  }

  const [meta, pool] = await Promise.all([
    executeWithRpcFailover(async (rpcUrl) => {
      const client = tokenClient(tokenId, undefined, rpcUrl)
      const [nameTx, symbolTx, decimalsTx] = await Promise.all([
        client.name().catch(() => ({ result: 'Unknown' })),
        client.symbol().catch(() => ({ result: 'UNK' })),
        client.decimals().catch(() => ({ result: 7 })),
      ])
      return {
        name: nameTx.result || 'Unknown',
        symbol: symbolTx.result || 'UNK',
        decimals: typeof decimalsTx.result === 'number' ? decimalsTx.result : 7,
      }
    }),
    fetchPoolState(tokenId),
  ])

  const graduation = graduationProgress(pool.reserveXlm)

  return {
    id: tokenId,
    name: meta.name,
    symbol: meta.symbol,
    decimals: meta.decimals,
    pool,
    priceXlm: formatTokenPrice(tokenPriceInXlmNumber(pool, meta.decimals)),
    graduation,
  }
}

/**
 * Quotes an exact AMM swap against Soroswap reserves.
 * Direction: 'buy' = XLM -> Token, 'sell' = Token -> XLM.
 */
export async function quoteSwap(params: {
  tokenId: string
  amountIn: bigint
  direction: 'buy' | 'sell'
  slippagePercent?: number
}): Promise<SdkQuoteResult> {
  if (params.amountIn <= 0n) {
    throw new Error('amountIn must be greater than zero')
  }

  const pool = await fetchPoolState(params.tokenId)
  if (!pool.exists || pool.reserveXlm === 0n || pool.reserveToken === 0n) {
    throw new Error(`No active AMM liquidity pool found for token ${params.tokenId}`)
  }

  const slippage = params.slippagePercent ?? 2
  if (params.direction === 'buy') {
    const quoted = await quoteXlmForToken(params.amountIn, pool)
    const minOut = withSlippage(quoted, slippage)
    const impact = priceImpactPercent(
      params.amountIn,
      quoted,
      pool.reserveXlm,
      pool.reserveToken,
    )
    return {
      direction: 'buy',
      amountIn: params.amountIn.toString(),
      amountOutEstimated: quoted.toString(),
      amountOutMinimum: minOut.toString(),
      priceImpactPercent: impact,
    }
  } else {
    const quoted = await quoteTokenForXlm(params.amountIn, pool)
    const minOut = withSlippage(quoted, slippage)
    const impact = priceImpactPercent(
      params.amountIn,
      quoted,
      pool.reserveToken,
      pool.reserveXlm,
    )
    return {
      direction: 'sell',
      amountIn: params.amountIn.toString(),
      amountOutEstimated: quoted.toString(),
      amountOutMinimum: minOut.toString(),
      priceImpactPercent: impact,
    }
  }
}

/**
 * Audits a token on-chain to verify 100% Anti-Rug Fair-Launch compliance:
 * 1. Active Soroswap AMM liquidity pool exists.
 * 2. Contract ownership is renounced (zero / dead address).
 * 3. 100% of Soroswap LP tokens are permanently burned in STELLAR_BURN_ADDRESS.
 */
export async function verifyAntiRug(tokenId: string): Promise<AntiRugAuditResult> {
  if (!isValidContractAddress(tokenId)) {
    return {
      tokenId,
      pairId: null,
      lpBurnAddress: STELLAR_BURN_ADDRESS,
      ownershipRenounced: false,
      lpBurned: false,
      verifiedLaunchpad: false,
      isAntiRugVerified: false,
      auditNotes: ['Invalid Stellar contract address.'],
    }
  }

  const [pool, launchRecord] = await Promise.all([
    fetchPoolState(tokenId),
    fetchLaunchpadRecord(tokenId),
  ])
  const verifiedLaunchpad = Boolean(launchRecord)
  const notes: string[] = []
  if (verifiedLaunchpad) {
    notes.push('Verified in AstroGate Launchpad on-chain registry.')
  }

  if (!pool.exists || !pool.pairId) {
    return {
      tokenId,
      pairId: null,
      lpBurnAddress: STELLAR_BURN_ADDRESS,
      ownershipRenounced: false,
      lpBurned: false,
      verifiedLaunchpad,
      isAntiRugVerified: false,
      auditNotes: [...notes, 'No active Soroswap AMM pool found on-chain.'],
    }
  }

  notes.push(`Soroswap Pair verified: ${pool.pairId}`)
  notes.push(`Canonical Stellar Burn Address: ${STELLAR_BURN_ADDRESS}`)

  // 1. Verify owner status with RPC failover. Fail-closed: un error de red / RPC
  // NUNCA cuenta como "renunciado". Solo `get_owner() -> None` (o burn address) lo es.
  let ownershipRenounced = false
  try {
    const owner = await executeWithRpcFailover(async (rpcUrl) => {
      const client = tokenClient(tokenId, undefined, rpcUrl)
      const ownerTx = await client.get_owner()
      return ownerTx.result
    })
    if (!owner || owner === STELLAR_BURN_ADDRESS) {
      ownershipRenounced = true
      notes.push('Ownership successfully renounced (zero / canonical burn owner).')
    } else {
      notes.push(`Active owner address detected: ${owner}`)
    }
  } catch (err) {
    notes.push(
      `Could not verify ownership (get_owner unavailable or RPC error): ${
        (err as Error)?.message ?? 'contract error'
      }. Treated as NOT renounced.`,
    )
  }

  // 2. Verify LP Token Burn (descontando MINIMUM_LIQUIDITY bloqueado por el par)
  let lpBurned = false
  try {
    const { burnedLp: burnBalance, totalSupply, fullyBurned } =
      await fetchBurnedLpInfo(pool.pairId)

    if (fullyBurned) {
      lpBurned = true
      notes.push(
        `100% of withdrawable LP verified burned in ${STELLAR_BURN_ADDRESS} (${burnBalance.toString()} / ${totalSupply.toString()}; ${SOROSWAP_MINIMUM_LIQUIDITY.toString()} LP permanently locked by the pair).`,
      )
    } else if (burnBalance > 0n && totalSupply > 0n) {
      const pct = (burnBalance * 100n) / totalSupply
      notes.push(
        `Partial LP burn: ${pct.toString()}% held by burn address (${burnBalance.toString()} / ${totalSupply.toString()}).`,
      )
    } else {
      notes.push('No LP tokens detected in canonical burn address.')
    }
  } catch (err) {
    notes.push(
      `Could not verify LP burn on pair: ${(err as Error)?.message ?? 'contract error'}`,
    )
  }

  return {
    tokenId,
    pairId: pool.pairId,
    lpBurnAddress: STELLAR_BURN_ADDRESS,
    ownershipRenounced,
    lpBurned,
    verifiedLaunchpad,
    isAntiRugVerified: ownershipRenounced && lpBurned && pool.reserveXlm > 0n,
    auditNotes: notes,
  }
}

/** Minimalist 1B fair-launch wrapper for programmatic AI agents and apps. */
export async function launchFair(params: {
  name: string
  symbol: string
  xlmLpAmount: bigint
  description?: string
  logoUrl?: string
  website?: string
  telegram?: string
  twitter?: string
  signer: Signer
  onHash?: (hash: string) => void
}) {
  const meta = encodeOnChainMeta(params)
  return launchFairAtomic({
    name: params.name,
    symbol: params.symbol,
    xlmLpAmount: params.xlmLpAmount,
    meta,
    signer: params.signer,
    onHash: params.onHash,
  })
}

/** Posts a real on-chain Burn-to-Chat shout by permanently burning holder tokens. */
export async function burnShout(params: {
  tokenId: string
  amount: bigint
  message: string
  signer: Signer
  onHash?: (hash: string) => void
}) {
  return burnAndShout(params)
}

/** Fetches the latest persistent Burn-to-Chat shouts for a token (newest first). */
export async function getTokenShouts(tokenId: string): Promise<TokenShout[]> {
  return fetchTokenShouts(tokenId)
}

export const AstroGateConstants = {
  NETWORK_NAME,
  NETWORK_PASSPHRASE,
  RPC_URL,
  RPC_POOL,
  SOROSWAP_FACTORY,
  SOROSWAP_ROUTER,
  XLM_SAC,
  ASTRO_TOKEN_ID,
  ASTRO_WASM_HASH,
  LAUNCHPAD_CONTRACT_ID,
  LAUNCHPAD_WASM_HASH,
  STELLAR_BURN_ADDRESS,
}

export {
  checkRpcHealth,
  classifyTokenEvent,
  decodeOnChainMeta,
  encodeOnChainMeta,
  executeWithRpcFailover,
  extendTokenTtl,
  fetchTokenEvents,
  fetchTokenShouts,
  isValidContractAddress,
  localQuoteTokenForXlm,
  localQuoteXlmForToken,
  parseTokenEvent,
}
export type { TokenEvent, TokenShout, TokenTradeRole }
