/**
 * Fair Launch Tokenomics (GasPump / Pump.fun style adapted to Stellar / Soroban).
 *
 * Anti-Fraud & Rug-Pull Rules:
 * 1. Standard Supply: 1,000,000,000 tokens (7 decimals).
 * 2. Creator Allocation: strictly 0.5% (5,000,000 tokens) transferred directly
 *    at launch on testnet (5-phase 15-day post-graduation vesting is planned for mainnet).
 * 3. Liquidity Pool Allocation: 99.5% (995,000,000 tokens) seeded directly
 *    into the Soroswap token/XLM pair at launch.
 * 4. Automatic LP Burn: 100% of the initial LP tokens generated are permanently
 *    burned to Stellar's dead address (GAAAA...WHF), guaranteeing non-withdrawable liquidity.
 * 5. Renounced Ownership: Minting is disabled forever on launch; supply is 100% fixed.
 * 6. If the creator wants more than 0.5%, they must buy from the pool using XLM
 *    just like any community participant, deepening liquidity for all.
 */
import type { PoolState } from './soroswap'
import { DEFAULT_XLM_USD_PRICE } from './xlm'

/** Total supply in readable units for a standard fair launch (1B, 7 decimals). */
export const FAIR_LAUNCH_TOTAL_BASIS = 1_000_000_000n

/** Decimals of every token deployed by this launchpad (native Stellar convention). */
export const FAIR_LAUNCH_DECIMALS = 7

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
 * 1. Fair launch deployment: 0 protocol fee charged on-chain (the launchpad contract only
 *    pulls the creator's chosen seed XLM). A planned $1.11 protocol deploy fee is modeled for future mainnet.
 * 2. Trading fee on curve: Soroswap charges the standard 0.30% LP fee; additional
 *    protocol/creator cuts (0.70% treasury + 0.30% creator) are planned, not enforced on-chain yet.
 * 3. Graduation fee at 2,000 XLM target: modeled 15 XLM protocol + 5 XLM creator
 *    reward (planned for mainnet).
 */
export const PROTOCOL_DEPLOY_FEE_USD = 1.11
export const CREATOR_GRADUATION_REWARD_XLM = 5

/** Ensure a fallback XLM/USD price is finite and positive; else use the default. */
export function sanitizeXlmUsdPrice(xlmUsdPrice: number): number {
  return Number.isFinite(xlmUsdPrice) && xlmUsdPrice > 0
    ? xlmUsdPrice
    : DEFAULT_XLM_USD_PRICE
}

/**
 * Computes how many XLM correspond to $1.11 USD at current live XLM price.
 */
export function calculateDeployFeeInXlm(
  xlmUsdPrice: number = DEFAULT_XLM_USD_PRICE,
): number {
  const safePrice = sanitizeXlmUsdPrice(xlmUsdPrice)
  return Math.round((PROTOCOL_DEPLOY_FEE_USD / safePrice) * 100) / 100
}

/**
 * Creator allocation share of `initialSupplyBase`, scaled by BPS.
 * Single source of truth for the "995M / 5M" figures shown across the UI.
 */
export function allocationOfBps(totalBase: bigint, bps: bigint): bigint {
  if (totalBase <= 0n) return 0n
  return (totalBase * bps) / 10_000n
}

/** Pool share of a total supply in base units (99.5%). */
export function poolAllocationBase(totalBase: bigint): bigint {
  return allocationOfBps(totalBase, POOL_ALLOCATION_BPS)
}

/**
 * Trade size tagged as "whale" by the UI: >= 1% of the standard fair-launch
 * supply (10M readable tokens on a 1B launch), converted to base units.
 */
export const WHALE_TRADE_SHARE_BPS = 100n

/** Whale threshold in base units for a token with `decimals` decimals. */
export function whaleThresholdBase(
  decimals: number = FAIR_LAUNCH_DECIMALS,
): bigint {
  const safeDecimals = Math.max(0, Math.trunc(decimals))
  return (
    allocationOfBps(FAIR_LAUNCH_TOTAL_BASIS, WHALE_TRADE_SHARE_BPS) *
    10n ** BigInt(safeDecimals)
  )
}

/**
 * Natural AMM Market Share & Anti-Sniper Indicator:
 * Rather than artificially blocking trades, constant-product AMM slippage naturally
 * penalizes oversized orders. This helper informs users of their order's supply share.
 */
export function calculateSupplySharePercent(
  amountTokensBase: bigint,
  totalBase: bigint = poolAllocationBase(
    FAIR_LAUNCH_TOTAL_BASIS * 10n ** BigInt(FAIR_LAUNCH_DECIMALS),
  ),
): number {
  if (totalBase <= 0n || amountTokensBase <= 0n) return 0
  const bps = (amountTokensBase * 10_000n) / totalBase
  return Number(bps) / 100
}

/**
 * Liquidity target in XLM (readable units) for a token to graduate to Soroswap DEX.
 * Calibrated to 2,000 XLM (~$310 USD) tailored for Stellar's community size, allowing
 * achievable graduations (50-80 trades), healthy ~14x-16x bonding curves, and deep DEX pools.
 */
export const GRADUATION_TARGET_XLM = 2_000

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
 * Creator allocation anti-dump protection lock (Planned for Mainnet):
 * On testnet, the creator receives their 0.5% allocation directly at launch.
 * The 5-phase 15-day vesting schedule (20% every 3 days post-graduation)
 * is modeled/planned for mainnet deployment.
 */
export const CREATOR_GRADUATION_LOCK_DAYS = 15
export const CREATOR_VESTING_PHASES_COUNT = 5
export const CREATOR_VESTING_INTERVAL_DAYS = 3
export const CREATOR_VESTING_PERCENT_PER_PHASE = 20

export type VestingPhase = {
  phase: number
  day: number
  percent: number
  tokensAmount: number
  label: string
}

export const CREATOR_VESTING_SCHEDULE: VestingPhase[] = [
  {
    phase: 1,
    day: 3,
    percent: 20,
    tokensAmount: 1_000_000,
    label: 'Phase 1 (Day 3): 20% (1M tokens) after 72h DEX consolidation',
  },
  {
    phase: 2,
    day: 6,
    percent: 20,
    tokensAmount: 1_000_000,
    label: 'Phase 2 (Day 6): 20% (1M tokens)',
  },
  {
    phase: 3,
    day: 9,
    percent: 20,
    tokensAmount: 1_000_000,
    label: 'Phase 3 (Day 9): 20% (1M tokens)',
  },
  {
    phase: 4,
    day: 12,
    percent: 20,
    tokensAmount: 1_000_000,
    label: 'Phase 4 (Day 12): 20% (1M tokens)',
  },
  {
    phase: 5,
    day: 15,
    percent: 20,
    tokensAmount: 1_000_000,
    label: 'Phase 5 (Day 15): 20% (1M tokens) — Final 100% unlock',
  },
]

/**
 * Default balanced seed XLM to open pool on Soroswap:
 * Seeding 5 to 10 XLM (~$0.75 - $1.55 USD) sets a fair initial price (~0.000000005 - 0.000000010 XLM)
 * and deepens the pool so snipers cannot monopolize supply for pennies.
 * Crowdsourced trading then drives the curve to the 2,000 XLM graduation milestone (~14x - 16x upside).
 */
export const DEFAULT_OPTIMIZED_SEED_XLM = 10

export type SeedPreset = {
  xlm: number
  label: string
  desc: string
  isRecommended?: boolean
}

export const SEED_LIQUIDITY_PRESETS: SeedPreset[] = [
  {
    xlm: 5,
    label: '5 XLM',
    desc: 'Light Seed — ~$0.78 USD, ultra-low cost for micro-memes',
  },
  {
    xlm: 10,
    label: '10 XLM',
    desc: 'Recommended ⭐ — ~$1.55 USD, optimal balance & natural anti-sniper depth',
    isRecommended: true,
  },
  {
    xlm: 20,
    label: '20 XLM',
    desc: 'Deep — ~$3.10 USD, deeper pool for community launches',
  },
  {
    xlm: 50,
    label: '50 XLM',
    desc: 'Whale — For DAOs and established projects',
  },
]

/**
 * Calculates graduation progress for a token based on its XLM reserve (stroops, 7 decimals).
 */
export function graduationProgress(
  reserveXlmStroops: bigint,
  targetXlm: number = GRADUATION_TARGET_XLM,
): GraduationStatus {
  const safeTarget =
    Number.isFinite(targetXlm) && targetXlm > 0 ? targetXlm : GRADUATION_TARGET_XLM
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
