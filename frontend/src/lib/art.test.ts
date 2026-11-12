import { describe, expect, it } from 'vitest'
import { artSeed, tokenArtSpec } from './art'

describe('art', () => {
  const tokenA = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'
  const tokenB = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

  it('generates deterministic seed and spec for identical ID', () => {
    const spec1 = tokenArtSpec(tokenA)
    const spec2 = tokenArtSpec(tokenA)

    expect(spec1.seed).toBe(spec2.seed)
    expect(spec1.archetype).toBe(spec2.archetype)
    expect(spec1.paletteName).toBe(spec2.paletteName)
    expect(spec1.editionCode).toBe(spec2.editionCode)
    expect(spec1.from).toBe(spec2.from)
    expect(spec1.to).toBe(spec2.to)
    expect(spec1.shapes).toEqual(spec2.shapes)
  })

  it('generates distinct seeds and specs for different token IDs', () => {
    const seedA = artSeed(tokenA)
    const seedB = artSeed(tokenB)
    expect(seedA).not.toBe(seedB)

    const specA = tokenArtSpec(tokenA)
    const specB = tokenArtSpec(tokenB)
    expect(specA.editionCode).not.toBe(specB.editionCode)
  })

  it('produces valid shape geometry within bounds', () => {
    const spec = tokenArtSpec(tokenA)
    expect(spec.shapes).toHaveLength(3)

    for (const shape of spec.shapes) {
      expect(shape.cx).toBeGreaterThanOrEqual(16)
      expect(shape.cx).toBeLessThanOrEqual(80)
      expect(shape.cy).toBeGreaterThanOrEqual(16)
      expect(shape.cy).toBeLessThanOrEqual(80)
      expect(shape.r).toBeGreaterThan(0)
      expect(typeof shape.light).toBe('boolean')
    }
  })
})
