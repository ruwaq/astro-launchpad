import { describe, expect, it } from 'vitest'
import {
  appendSnapshot,
  dedupeSnapshots,
  recordSnapshot,
  snapshotLiquidity,
  snapshotPrice,
  toChartPoints,
  type ReserveSnapshot,
} from './snapshots'

function snap(
  t: number,
  xlm = '10000000',
  token = '100000000',
): ReserveSnapshot {
  return { t, xlm, token }
}

describe('appendSnapshot', () => {
  it('empieza con una lectura', () => {
    expect(appendSnapshot([], snap(0))).toEqual([snap(0)])
  })

  it('no duplica una lectura idéntica dentro del mismo bucket', () => {
    const history = [snap(0, '10000000')]
    expect(appendSnapshot(history, snap(60_000, '10000000'))).toBe(history)
  })

  it('añade el cambio de reservas aunque esté dentro del bucket', () => {
    const next = appendSnapshot([snap(0)], snap(60_000, '20000000'))
    expect(next).toHaveLength(2)
    expect(next[1]).toMatchObject({ t: 60_000, xlm: '20000000' })
  })

  it('añade un punto cuando cambia el bucket', () => {
    const next = appendSnapshot([snap(0)], snap(300_000))
    expect(next).toHaveLength(2)
    expect(next[1]?.t).toBe(300_000)
  })

  it('recorta al máximo configurado', () => {
    const history = [snap(0), snap(300_000), snap(600_000)]
    const next = appendSnapshot(history, snap(900_000), 300_000, 3)
    expect(next.map((item) => item.t)).toEqual([300_000, 600_000, 900_000])
  })

  it('ignora relojes hacia atrás', () => {
    const history = [snap(600_000)]
    expect(appendSnapshot(history, snap(300_000))).toBe(history)
  })
})

describe('dedupeSnapshots', () => {
  it('fusiona puntos consecutivos idénticos y conserva el orden', () => {
    const points = [
      snap(1_000, '100', '200'),
      snap(1_000, '100', '200'),
      snap(2_000, '150', '180'),
    ]
    expect(dedupeSnapshots(points)).toEqual([
      snap(1_000, '100', '200'),
      snap(2_000, '150', '180'),
    ])
  })

  it('no fusiona mismo instante con reservas distintas', () => {
    const points = [snap(1_000, '100', '200'), snap(1_000, '110', '190')]
    expect(dedupeSnapshots(points)).toEqual(points)
  })

  it('conserva extremos idénticos no consecutivos', () => {
    const points = [
      snap(1_000, '100', '200'),
      snap(2_000, '150', '180'),
      snap(3_000, '100', '200'),
    ]
    expect(dedupeSnapshots(points)).toEqual(points)
  })
})

describe('toChartPoints', () => {
  it('mapea el mínimo abajo y el máximo arriba', () => {
    const chart = toChartPoints([1, 2, 3], 320, 120, 12)
    expect(chart.points).toHaveLength(3)
    expect(chart.min).toBe(1)
    expect(chart.max).toBe(3)
    expect(chart.points[0]).toMatchObject({ x: 12, y: 108 })
    expect(chart.points[2]).toMatchObject({ x: 308, y: 12 })
    expect(chart.points[1]?.y).toBe(60)
  })

  it('centra una serie plana', () => {
    const chart = toChartPoints([5, 5], 320, 120, 12)
    expect(chart.points[0]?.y).toBe(60)
    expect(chart.points[1]?.y).toBe(60)
  })

  it('devuelve vacío sin valores finitos', () => {
    expect(toChartPoints([], 320, 120, 12)).toEqual({
      points: [],
      min: 0,
      max: 0,
    })
    expect(toChartPoints([Number.NaN], 320, 120, 12).points).toEqual([])
  })
})

describe('snapshotPrice y liquidez', () => {
  it('escala las reservas a unidades humanas', () => {
    const snapshot = snap(0, '10000000', '100000000')
    expect(snapshotPrice(snapshot, 7)).toBeCloseTo(0.1)
    expect(snapshotLiquidity(snapshot)).toBeCloseTo(1)
  })

  it('devuelve 0 si la reserva del token no es válida', () => {
    expect(snapshotPrice(snap(0, '10000000', '0'), 7)).toBe(0)
    expect(snapshotPrice(snap(0, 'abc', '100000000'), 7)).toBe(0)
  })
})

describe('recordSnapshot', () => {
  it('ignora ids que no son contratos', () => {
    expect(recordSnapshot('', 1n, 1n)).toEqual([])
  })
})
