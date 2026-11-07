import { describe, expect, it } from 'vitest'
import {
  auditTokenSecurity,
  calculateProtocolRevenue,
  calculateSupplySharePercent,
  DEFAULT_OPTIMIZED_SEED_XLM,
  graduationProgress,
  SEED_LIQUIDITY_PRESETS,
  splitFairLaunchSupply,
  STELLAR_BURN_ADDRESS,
} from './tokenomics'

describe('splitFairLaunchSupply', () => {
  it('reparte 0.5% creador, 79.5% curva y 20% reserva DEX (99.5% pool)', () => {
    const oneBillion = 1_000_000_000n * 10_000_000n // 1B con 7 decimales
    const { creatorAmount, poolAmount, curveSaleAmount, dexReserveAmount } =
      splitFairLaunchSupply(oneBillion)
    expect(creatorAmount).toBe(5_000_000n * 10_000_000n) // 5M (0.5%)
    expect(poolAmount).toBe(995_000_000n * 10_000_000n) // 995M (99.5%)
    expect(curveSaleAmount).toBe(795_000_000n * 10_000_000n) // 795M (79.5%)
    expect(dexReserveAmount).toBe(200_000_000n * 10_000_000n) // 200M (20%)
    expect(creatorAmount + poolAmount).toBe(oneBillion)
    expect(STELLAR_BURN_ADDRESS).toHaveLength(56)
  })

  it('devuelve 0 si el supply es inválido', () => {
    expect(splitFairLaunchSupply(0n)).toEqual({
      creatorAmount: 0n,
      poolAmount: 0n,
      curveSaleAmount: 0n,
      dexReserveAmount: 0n,
    })
  })
})

describe('calculateProtocolRevenue', () => {
  it('calcula ingresos de los developers y recompensas del creador antes y después de graduarse', () => {
    const preGrad = calculateProtocolRevenue({ volumeXlm: 1_000, graduated: false })
    expect(preGrad.deployFeeXlm).toBe(2)
    expect(preGrad.protocolTradingFeeXlm).toBe(7) // 0.70% de 1000
    expect(preGrad.creatorTradingRewardXlm).toBe(3) // 0.30% de 1000
    expect(preGrad.totalProtocolRevenueXlm).toBe(9)

    const postGrad = calculateProtocolRevenue({ volumeXlm: 1_000, graduated: true })
    expect(postGrad.graduationProtocolFeeXlm).toBe(15)
    expect(postGrad.graduationCreatorRewardXlm).toBe(5)
    expect(postGrad.totalProtocolRevenueXlm).toBe(24) // 2 + 7 + 15
    expect(postGrad.totalCreatorRewardXlm).toBe(8) // 3 + 5
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
