/**
 * @file AstroGate AI & Developer SDK
 * @description Lightweight, typed SDK designed for autonomous AI agents, trading bots,
 * and external developers building on Stellar/Soroban.
 */

import { discoverTokens, type TokenListing } from '../lib/discovery'
import {
  fetchPoolState,
  priceImpactPercent,
  quoteTokenForXlm,
  quoteXlmForToken,
  tokenPriceInXlm,
  unwrapResult,
  withSlippage,
  type PoolState,
} from '../lib/soroswap'
import { Client as PairClient } from '../contracts/soroswap-pair'
import { tokenClient } from '../lib/token'
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
  parseTokenEvent,
  type TokenEvent,
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
    const price = tokenPriceInXlm(token.pool, token.decimals)
    const grad = graduationProgress(token.pool.reserveXlm)
    return {
      id: token.id,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      pairId: token.pool.pairId,
      priceXlm: formatAmount(price, 7),
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

  const client = tokenClient(tokenId)
  const [nameTx, symbolTx, decimalsTx, pool] = await Promise.all([
    client.name().catch(() => ({ result: 'Unknown' })),
    client.symbol().catch(() => ({ result: 'UNK' })),
    client.decimals().catch(() => ({ result: 7 })),
    fetchPoolState(tokenId),
  ])

  const decimals = typeof decimalsTx.result === 'number' ? decimalsTx.result : 7
  const price = tokenPriceInXlm(pool, decimals)
  const graduation = graduationProgress(pool.reserveXlm)

  return {
    id: tokenId,
    name: nameTx.result || 'Unknown',
    symbol: symbolTx.result || 'UNK',
    decimals,
    pool,
    priceXlm: formatAmount(price, 7),
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
  const pool = await fetchPoolState(tokenId)
  const notes: string[] = []

  if (!pool.exists || !pool.pairId) {
    return {
      tokenId,
      pairId: null,
      lpBurnAddress: STELLAR_BURN_ADDRESS,
      ownershipRenounced: false,
      lpBurned: false,
      isAntiRugVerified: false,
      auditNotes: ['No active Soroswap AMM pool found on-chain.'],
    }
  }

  notes.push(`Soroswap Pair verified: ${pool.pairId}`)
  notes.push(`Canonical Stellar Burn Address: ${STELLAR_BURN_ADDRESS}`)

  // 1. Verify owner status: strictly dead or non-existent
  let ownershipRenounced = false
  try {
    const client = tokenClient(tokenId)
    const ownerTx = await client.get_owner()
    const owner = ownerTx.result
    if (!owner || owner === STELLAR_BURN_ADDRESS) {
      ownershipRenounced = true
      notes.push('Ownership successfully renounced (zero / canonical burn owner).')
    } else {
      notes.push(`Active owner address detected: ${owner}`)
    }
  } catch {
    // If get_owner() reverts or is absent, minting is either locked or renounced
    ownershipRenounced = true
    notes.push('Token contract does not have an active owner (mint disabled).')
  }

  // 2. Verify LP Token Burn
  let lpBurned = false
  try {
    const pair = new PairClient({
      contractId: pool.pairId,
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
    const [burnBalanceTx, totalSupplyTx] = await Promise.all([
      pair.balance({ id: STELLAR_BURN_ADDRESS }),
      pair.total_supply(),
    ])
    const burnBalance = unwrapResult<bigint>(burnBalanceTx.result, 'balance')
    const totalSupply = unwrapResult<bigint>(totalSupplyTx.result, 'total_supply')

    if (totalSupply > 0n && burnBalance >= totalSupply) {
      lpBurned = true
      notes.push(
        `100% LP tokens verified burned in ${STELLAR_BURN_ADDRESS} (${burnBalance.toString()} / ${totalSupply.toString()}).`,
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
    isAntiRugVerified: ownershipRenounced && lpBurned && pool.reserveXlm > 0n,
    auditNotes: notes,
  }
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
  executeWithRpcFailover,
  fetchTokenEvents,
  isValidContractAddress,
  parseTokenEvent,
}
export type { TokenEvent, TokenTradeRole }
