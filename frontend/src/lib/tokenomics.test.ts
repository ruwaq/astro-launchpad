import { describe, expect, it } from 'vitest'
import {
  auditTokenSecurity,
  calculateSupplySharePercent,
  DEFAULT_OPTIMIZED_SEED_XLM,
  graduationProgress,
  poolAllocationBase,
  SEED_LIQUIDITY_PRESETS,
  STELLAR_BURN_ADDRESS,
  WHALE_TRADE_SHARE_BPS,
  whaleThresholdBase,
} from './tokenomics'

describe('allocation math (single source for 995M/5M figures)', () => {
  it('reparte 0.5% creador y 99.5% pool sobre el supply estándar', () => {
    const oneBillion = 1_000_000_000n * 10_000_000n // 1B con 7 decimales
    expect(poolAllocationBase(oneBillion)).toBe(995_000_000n * 10_000_000n) // 995M (99.5%)
    expect(STELLAR_BURN_ADDRESS).toHaveLength(56)
  })

  it('devuelve 0 sobre supplies inválidos', () => {
    expect(poolAllocationBase(0n)).toBe(0n)
  })
})

describe('whale threshold', () => {
  it('marca ballena a partir del 1% del supply del fair launch en base units', () => {
    expect(WHALE_TRADE_SHARE_BPS).toBe(100n)
    // 1% de 1B con 7 decimales = 10M tokens = 10M * 1e7 base units.
    expect(whaleThresholdBase(7)).toBe(10_000_000n * 10_000_000n)
  })

  it('escala con los decimales del token y tolera valores inválidos', () => {
    expect(whaleThresholdBase(0)).toBe(10_000_000n)
    expect(whaleThresholdBase(-3)).toBe(10_000_000n)
    expect(whaleThresholdBase(2.9)).toBe(10_000_000n * 100n)
    expect(whaleThresholdBase()).toBe(whaleThresholdBase(7))
  })
})

describe('graduationProgress', () => {
  const stroops = 10_000_000n

  it('clasifica etapas desde sin liquidez hasta graduado en 2000 XLM', () => {
    expect(graduationProgress(0n).stage).toBe('no-pool')
    expect(graduationProgress(100n * stroops).stage).toBe('seed')
    expect(graduationProgress(500n * stroops).stage).toBe('rising')
    expect(graduationProgress(500n * stroops).percent).toBe(25)
    expect(graduationProgress(1_200n * stroops).stage).toBe('heating')
    const grad = graduationProgress(2_500n * stroops)
    expect(grad.stage).toBe('graduated')
    expect(grad.graduated).toBe(true)
    expect(grad.percent).toBe(100)
  })
})

describe('auditTokenSecurity', () => {
  it('certifica fair launch cuando ownership está renunciado y hay pool', () => {
    const audit = auditTokenSecurity({
      owner: null,
      totalSupply: 1_000n,
      pool: {
        exists: true,
        pairId: 'CPAIR',
        reserveToken: 990n,
        reserveXlm: 100n,
      },
    })
    expect(audit.ownershipRenounced).toBe(true)
    expect(audit.poolSupplyPercent).toBe(99)
    expect(audit.isFairLaunchSafe).toBe(true)
  })

  it('marca no seguro si el owner sigue activo o no hay liquidez', () => {
    const withOwner = auditTokenSecurity({
      owner: 'GOWNER',
      totalSupply: 1_000n,
      pool: {
        exists: true,
        pairId: 'CPAIR',
        reserveToken: 990n,
        reserveXlm: 100n,
      },
    })
    expect(withOwner.ownershipRenounced).toBe(false)
    expect(withOwner.isFairLaunchSafe).toBe(false)
  })
})

describe('fair seed & supply share math', () => {
  it('define una semilla inicial balanceada de 10 XLM y presets', () => {
    expect(DEFAULT_OPTIMIZED_SEED_XLM).toBe(10)
    expect(SEED_LIQUIDITY_PRESETS.length).toBeGreaterThanOrEqual(4)
    const recommended = SEED_LIQUIDITY_PRESETS.find((p) => p.isRecommended)
    expect(recommended?.xlm).toBe(10)
  })

  it('calcula el porcentaje de tokens adquiridos sobre el pool sin bloquear libre comercio', () => {
    const poolTokens = 995_000_000n * 10_000_000n // 995M tokens con 7 decimales
    const order10M = 10_000_000n * 10_000_000n
    const percent = calculateSupplySharePercent(order10M, poolTokens)
    // 10M / 995M ≈ 1.005% -> 1.00%
    expect(percent).toBeCloseTo(1.0, 1)

    // Si orden es 0 o negativo
    expect(calculateSupplySharePercent(0n, poolTokens)).toBe(0)
  })
})
