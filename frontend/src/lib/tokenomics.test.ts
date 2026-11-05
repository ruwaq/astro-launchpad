import { describe, expect, it } from 'vitest'
import {
  auditTokenSecurity,
  calculateProtocolRevenue,
  graduationProgress,
  splitFairLaunchSupply,
  STELLAR_BURN_ADDRESS,
} from './tokenomics'

describe('splitFairLaunchSupply', () => {
  it('reparte 1% creador, 79% curva y 20% reserva DEX (99% pool)', () => {
    const oneBillion = 1_000_000_000n * 10_000_000n // 1B con 7 decimales
    const { creatorAmount, poolAmount, curveSaleAmount, dexReserveAmount } =
      splitFairLaunchSupply(oneBillion)
    expect(creatorAmount).toBe(10_000_000n * 10_000_000n) // 10M (1%)
    expect(poolAmount).toBe(990_000_000n * 10_000_000n) // 990M (99%)
    expect(curveSaleAmount).toBe(790_000_000n * 10_000_000n) // 790M (79%)
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

  it('clasifica etapas desde sin liquidez hasta graduado en 1000 XLM', () => {
    expect(graduationProgress(0n).stage).toBe('no-pool')
    expect(graduationProgress(20n * stroops).stage).toBe('seed')
    expect(graduationProgress(250n * stroops).stage).toBe('rising')
    expect(graduationProgress(250n * stroops).percent).toBe(25)
    expect(graduationProgress(600n * stroops).stage).toBe('heating')
    const grad = graduationProgress(1_200n * stroops)
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
