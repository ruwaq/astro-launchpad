import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TokenArt } from '../components/TokenArt'
import { ARCHETYPES, PALETTES, artSeed, tokenArtSpec } from './art'

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

  it('normalizes whitespace in token IDs deterministically', () => {
    const specNormal = tokenArtSpec(tokenA)
    const specPadded = tokenArtSpec(`   ${tokenA}  \n `)

    expect(specPadded.seed).toBe(specNormal.seed)
    expect(specPadded.editionCode).toBe(specNormal.editionCode)
    expect(specPadded.archetype).toBe(specNormal.archetype)
    expect(specPadded.paletteName).toBe(specNormal.paletteName)
    expect(specPadded.shapes).toEqual(specNormal.shapes)
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

  it('decouples traits across bit slices achieving rich diversity without entropy collapse', () => {
    const seenPalettes = new Set<string>()
    const seenArchetypes = new Set<string>()
    const seenRingCounts = new Set<number>()
    const seenRotations = new Set<number>()
    const combinations = new Set<string>()

    // Sample a cohort of 500 distinct token addresses
    for (let i = 0; i < 500; i++) {
      const spec = tokenArtSpec(`CSAMPLE_TESTNET_TOKEN_ADDRESS_${i}`)
      seenPalettes.add(spec.paletteName)
      seenArchetypes.add(spec.archetype)
      seenRingCounts.add(spec.ringCount)
      seenRotations.add(spec.rotation)

      const key = `${spec.paletteName}|${spec.archetype}|${spec.ringCount}|${spec.rotation}|${spec.shapes[0].light}`
      combinations.add(key)
    }

    // All palettes, archetypes, and ring counts are reachable
    expect(seenPalettes.size).toBe(PALETTES.length)
    expect(seenArchetypes.size).toBe(ARCHETYPES.length)
    expect(seenRingCounts.size).toBe(4) // 2, 3, 4, 5 rings
    expect(seenRotations.size).toBeGreaterThan(6)

    // Ensure state space is not collapsed into the old 24-combination modulo bug
    expect(combinations.size).toBeGreaterThan(100)
  })
})

describe('TokenArt component rendering', () => {
  const tokenId = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'

  it('renders unique SVG element IDs across multiple instances of the same token in a document', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(TokenArt, { id: tokenId, symbol: 'ASTRO' }),
        createElement(TokenArt, { id: tokenId, symbol: 'ASTRO' }),
      ),
    )

    // Both should contain valid gradients
    expect(html).toContain('linearGradient')

    // Extract all gradient IDs from the rendered DOM
    const idMatches = [...html.matchAll(/id="(ag-art-[^"]+)"/g)].map((m) => m[1])

    expect(idMatches).toHaveLength(2)
    // Within the same page/tree, useId ensures distinct IDs to avoid DOM id shadowing
    expect(idMatches[0]).not.toBe(idMatches[1])
  })

  it('enforces overflow-hidden on the root SVG for proper avatar corner clipping', () => {
    const html = renderToStaticMarkup(
      createElement(TokenArt, { id: tokenId, symbol: 'ASTRO', className: 'h-10 w-10 rounded-xl' }),
    )
    expect(html).toContain('class="overflow-hidden h-10 w-10 rounded-xl"')
  })

  it('renders distinct geometric layers for all 5 archetypes', () => {
    // Collect a token for each archetype
    const archetypeTokens = new Map<string, string>()
    let counter = 0
    while (archetypeTokens.size < ARCHETYPES.length && counter < 1000) {
      const id = `CTEST_ARCHETYPE_${counter++}`
      const spec = tokenArtSpec(id)
      if (!archetypeTokens.has(spec.archetype)) {
        archetypeTokens.set(spec.archetype, id)
      }
    }

    expect(archetypeTokens.size).toBe(5)

    // 1. Cosmic Nebula
    const nebulaHtml = renderToStaticMarkup(
      createElement(TokenArt, { id: archetypeTokens.get('Cosmic Nebula')! }),
    )
    expect(nebulaHtml).toContain('<circle')

    // 2. Sacred Geometry: dual interlocking triangles
    const sacredHtml = renderToStaticMarkup(
      createElement(TokenArt, { id: archetypeTokens.get('Sacred Geometry')! }),
    )
    expect(sacredHtml).toContain('0,-54 47,27 -47,27')
    expect(sacredHtml).toContain('0,54 47,-27 -47,-27')

    // 3. Chromatic Rings: dashed circles
    const chromaticHtml = renderToStaticMarkup(
      createElement(TokenArt, { id: archetypeTokens.get('Chromatic Rings')! }),
    )
    expect(chromaticHtml).toContain('stroke-dasharray="6 4"')

    // 4. Cyber Horizon: distinct horizon beam and harmonic chord rails
    const cyberHtml = renderToStaticMarkup(
      createElement(TokenArt, { id: archetypeTokens.get('Cyber Horizon')! }),
    )
    expect(cyberHtml).toContain('x1="-54"')
    expect(cyberHtml).toContain('stroke-dasharray="3 3"')

    // 5. Solar Prism: single prism polygon
    const solarHtml = renderToStaticMarkup(
      createElement(TokenArt, { id: archetypeTokens.get('Solar Prism')! }),
    )
    expect(solarHtml).toContain('0,-54 47,27 -47,27')
    expect(solarHtml).not.toContain('0,54 47,-27 -47,-27')
  })

  it('sanitizes logoUrl by protocol whitelist and falls back to SVG on unsafe schemes', () => {
    // Safe HTTPS URL -> renders <img>
    const safeHtml = renderToStaticMarkup(
      createElement(TokenArt, {
        id: tokenId,
        logoUrl: 'https://example.com/logo.png',
        symbol: 'SAFE',
      }),
    )
    expect(safeHtml).toContain('<img')
    expect(safeHtml).toContain('src="https://example.com/logo.png"')

    // Malicious javascript: URL -> falls back to generative <svg>
    const xssHtml = renderToStaticMarkup(
      createElement(TokenArt, {
        id: tokenId,
        logoUrl: 'javascript:alert(1)',
        symbol: 'XSS',
      }),
    )
    expect(xssHtml).not.toContain('<img')
    expect(xssHtml).not.toContain('javascript:')
    expect(xssHtml).toContain('<svg')

    // Malicious data:text/html -> falls back to generative <svg>
    const dataHtml = renderToStaticMarkup(
      createElement(TokenArt, {
        id: tokenId,
        logoUrl: 'data:text/html;base64,PHNjcmlwdD4=',
        symbol: 'DATA',
      }),
    )
    expect(dataHtml).not.toContain('<img')
    expect(dataHtml).toContain('<svg')

    // Safe data:image/png;base64 -> renders <img>
    const validDataImg = renderToStaticMarkup(
      createElement(TokenArt, {
        id: tokenId,
        logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        symbol: 'PNG',
      }),
    )
    expect(validDataImg).toContain('<img')
  })

  it('sanitizes bidirectional overrides and controls in symbols and scales long monograms', () => {
    // Malicious bidi override
    const bidiHtml = renderToStaticMarkup(
      createElement(TokenArt, { id: tokenId, symbol: '\u202EABC\u202C' }),
    )
    expect(bidiHtml).toContain('ABC')
    expect(bidiHtml).not.toContain('\u202E')

    // Long 4-letter symbol receives compact font size and lengthAdjust
    const longHtml = renderToStaticMarkup(
      createElement(TokenArt, { id: tokenId, symbol: 'MOONX' }),
    )
    expect(longHtml).toContain('MOON')
    expect(longHtml).toContain('font-size="18"')
    expect(longHtml).toContain('lengthAdjust="spacingAndGlyphs"')

    // Short 2-letter symbol receives standard 24px font size
    const shortHtml = renderToStaticMarkup(
      createElement(TokenArt, { id: tokenId, symbol: 'XL' }),
    )
    expect(shortHtml).toContain('font-size="24"')
  })
})
