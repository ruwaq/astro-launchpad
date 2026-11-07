/**
 * Fair Launch Tokenomics (GasPump / Pump.fun style adapted to Stellar / Soroban).
 *
 * Anti-Fraud & Rug-Pull Rules:
 * 1. Standard Supply: 1,000,000,000 tokens (7 decimals).
 * 2. Creator Allocation: strictly 1% (10,000,000 tokens).
 * 3. Liquidity Pool Allocation: 99% (990,000,000 tokens) seeded directly into
 *    the Soroswap token/XLM pair at launch.
 * 4. Automatic LP Burn: 100% of the initial LP tokens generated are permanently
 *    burned to Stellar's dead address (GAAAA...WHF), guaranteeing non-withdrawable liquidity.
 * 5. Renounced Ownership: Minting is disabled forever on launch; supply is 100% fixed.
 * 6. If the creator wants more than 1%, they must buy from the pool using XLM
 *    just like any community participant, deepening liquidity for all.
 */
import type { PoolState } from './soroswap'

/** Standard meme token supply in readable units (1B). */
export const FAIR_LAUNCH_SUPPLY_UNITS = 1_000_000_000

/** Creator allocation in basis points (50 bps = 0.5% developer allocation). */
export const CREATOR_ALLOCATION_BPS = 50n

/** Percentage sent directly to liquidity pool (9,950 bps = 99.5%). */
export const POOL_ALLOCATION_BPS = 9_950n

/**
 * Internal breakdown of the 99.5% pool:
 * - ~79.5% (795M tokens) for initial bonding curve swaps.
 * - ~20% (200M tokens) reserved deep DEX liquidity cushion.
 * - 0.5% (5M tokens) creator max allocation upon graduation.
 */
export const BONDING_CURVE_ALLOCATION_BPS = 7_950n
export const DEX_RESERVE_ALLOCATION_BPS = 2_000n

/**
 * Stellar Canonical Burn Address (Blackhole / Dead Account):
 * 32-byte zero Ed25519 public key (`GAAAA...WHF`).
 * No private key exists. All LP tokens sent here are permanently locked.
 */
export const STELLAR_BURN_ADDRESS =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

/**
 * Protocol Monetization Model (AstroGate Treasury):
 * 1. Fair launch deployment fee anchored to $1.11 USD (`PROTOCOL_DEPLOY_FEE_USD` = 1.11)
 *    calculated dynamically from current real-time XLM spot price.
 * 2. Trading fee on curve: 1.00% (0.70% treasury + 0.30% creator).
 * 3. Graduation fee at 1,000 XLM target: 15 XLM protocol + 5 XLM creator reward.
 */
export const PROTOCOL_DEPLOY_FEE_USD = 1.11
export const PROTOCOL_DEPLOY_FEE_XLM = 2
export const PROTOCOL_TRADING_FEE_BPS = 100n
export const PROTOCOL_TREASURY_CUT_BPS = 70n
export const PROTOCOL_CREATOR_CUT_BPS = 30n
export const PROTOCOL_GRADUATION_FEE_XLM = 15
export const CREATOR_GRADUATION_REWARD_XLM = 5

/**
 * Creator allocation anti-dump protection lock:
 * The creator receives their 0.5% allocation 15 days AFTER graduation
 * to protect buyers from immediate selloffs and allow organic price discovery.
 */
export const CREATOR_GRADUATION_LOCK_DAYS = 15
export const CREATOR_GRADUATION_LOCK_SECONDS = 15 * 24 * 60 * 60

/**
 * Default optimized micro-seed XLM to open pool on Soroswap without burdening the creator:
 * The creator only puts 0.5 XLM (~$0.07 USD) to initialize the pair on Soroswap.
 * The rest of the liquidity is crowdsourced by the community trading on the curve.
 */
export const DEFAULT_OPTIMIZED_SEED_XLM = 0.5

/**
 * Computes how many XLM correspond to $1.11 USD at current live XLM price.
 */
export function calculateDeployFeeInXlm(xlmUsdPrice: number = 0.1555): number {
  const safePrice =
    Number.isFinite(xlmUsdPrice) && xlmUsdPrice > 0 ? xlmUsdPrice : 0.1555
  return Math.round((PROTOCOL_DEPLOY_FEE_USD / safePrice) * 100) / 100
}

/**
 * Liquidity target in XLM (readable units) for a token to graduate to Soroswap DEX.
 */
export const GRADUATION_TARGET_XLM = 1_000

/** Soroswap pair swap fee (30 bps = 0.30%). */
export const SOROSWAP_SWAP_FEE_PERCENT = 0.3

export type GraduationStage =
  | 'no-pool'
  | 'seed'
  | 'rising'
  | 'heating'
  | 'graduated'

export type GraduationStatus = {
  stage: GraduationStage
  label: string
  /** Progress 0 to 100%. */
  percent: number
  /** Current XLM in reserve. */
  currentXlm: number
  /** Target XLM for graduation. */
  targetXlm: number
  graduated: boolean
}

/**
 * Splits total fair launch supply into:
 * - `creatorAmount` (1%): to creator.
 * - `poolAmount` (99%): seeded to pair.
 */
export function splitFairLaunchSupply(totalSupplyBase: bigint): {
  creatorAmount: bigint
  poolAmount: bigint
  curveSaleAmount: bigint
  dexReserveAmount: bigint
} {
  if (totalSupplyBase <= 0n) {
    return {
      creatorAmount: 0n,
      poolAmount: 0n,
      curveSaleAmount: 0n,
      dexReserveAmount: 0n,
    }
  }
  const creatorAmount = (totalSupplyBase * CREATOR_ALLOCATION_BPS) / 10_000n
  const dexReserveAmount =
    (totalSupplyBase * DEX_RESERVE_ALLOCATION_BPS) / 10_000n
  const poolAmount = totalSupplyBase - creatorAmount
  const curveSaleAmount = poolAmount - dexReserveAmount
  return { creatorAmount, poolAmount, curveSaleAmount, dexReserveAmount }
}

/**
 * Calculates protocol revenue & creator rewards.
 */
export function calculateProtocolRevenue(params: {
  volumeXlm: number
  graduated: boolean
  xlmUsdPrice?: number
}): {
  deployFeeUsd: number
  deployFeeXlm: number
  protocolTradingFeeXlm: number
  creatorTradingRewardXlm: number
  graduationProtocolFeeXlm: number
  graduationCreatorRewardXlm: number
  totalProtocolRevenueXlm: number
  totalCreatorRewardXlm: number
} {
  const safeVol = Math.max(0, params.volumeXlm)
  const deployFeeXlm =
    params.xlmUsdPrice !== undefined
      ? calculateDeployFeeInXlm(params.xlmUsdPrice)
      : PROTOCOL_DEPLOY_FEE_XLM
  const protocolTradingFeeXlm =
    (safeVol * Number(PROTOCOL_TREASURY_CUT_BPS)) / 10_000
  const creatorTradingRewardXlm =
    (safeVol * Number(PROTOCOL_CREATOR_CUT_BPS)) / 10_000
  const graduationProtocolFeeXlm = params.graduated
    ? PROTOCOL_GRADUATION_FEE_XLM
    : 0
  const graduationCreatorRewardXlm = params.graduated
    ? CREATOR_GRADUATION_REWARD_XLM
    : 0

  return {
    deployFeeUsd: PROTOCOL_DEPLOY_FEE_USD,
    deployFeeXlm,
    protocolTradingFeeXlm,
    creatorTradingRewardXlm,
    graduationProtocolFeeXlm,
    graduationCreatorRewardXlm,
    totalProtocolRevenueXlm:
      deployFeeXlm + protocolTradingFeeXlm + graduationProtocolFeeXlm,
    totalCreatorRewardXlm:
      creatorTradingRewardXlm + graduationCreatorRewardXlm,
  }
}

/**
 * Calculates graduation progress for a token based on its XLM reserve (stroops, 7 decimals).
 */
export function graduationProgress(
  reserveXlmStroops: bigint,
  targetXlm: number = GRADUATION_TARGET_XLM,
): GraduationStatus {
  const safeTarget = Math.max(1, targetXlm)
  const currentXlm = Number(reserveXlmStroops) / 1e7
  if (!Number.isFinite(currentXlm) || currentXlm <= 0) {
    return {
      stage: 'no-pool',
      label: 'No initial liquidity',
      percent: 0,
      currentXlm: 0,
      targetXlm: safeTarget,
      graduated: false,
    }
  }

  const rawPercent = (currentXlm / safeTarget) * 100
  const percent = Math.min(100, Math.round(rawPercent * 10) / 10)
  const graduated = currentXlm >= safeTarget

  if (graduated) {
    return {
      stage: 'graduated',
      label: '🎓 Graduated on Soroswap DEX',
      percent: 100,
      currentXlm,
      targetXlm: safeTarget,
      graduated: true,
    }
  }
  if (percent >= 50) {
    return {
      stage: 'heating',
      label: '🔥 King of the Hill (final stretch)',
      percent,
      currentXlm,
      targetXlm: safeTarget,
      graduated: false,
    }
  }
  if (percent >= 10) {
    return {
      stage: 'rising',
      label: '⚡ Bonding curve surging',
      percent,
      currentXlm,
      targetXlm: safeTarget,
      graduated: false,
    }
  }
  return {
    stage: 'seed',
    label: '🌱 Seed stage',
    percent: Math.max(1, percent),
    currentXlm,
    targetXlm: safeTarget,
    graduated: false,
  }
}

export type SecurityAudit = {
  /** Has creator renounced minting permissions (`owner === null`)? */
  ownershipRenounced: boolean
  /** Percentage of total supply locked in liquidity pool. */
  poolSupplyPercent: number
  /** Is fair launch safe (no owner + active liquidity)? */
  isFairLaunchSafe: boolean
}

/**
 * Audits on-chain anti-rug security guarantees.
 */
export function auditTokenSecurity(params: {
  owner: string | null
  totalSupply: bigint
  pool: PoolState | undefined
}): SecurityAudit {
  const { owner, totalSupply, pool } = params
  const ownershipRenounced = owner === null
  const reserveToken = pool?.exists ? pool.reserveToken : 0n
  const poolSupplyPercent =
    totalSupply > 0n && reserveToken > 0n
      ? Math.min(100, Number((reserveToken * 10_000n) / totalSupply) / 100)
      : 0

  return {
    ownershipRenounced,
    poolSupplyPercent,
    isFairLaunchSafe:
      ownershipRenounced && Boolean(pool?.exists && pool.reserveXlm > 0n),
  }
}
