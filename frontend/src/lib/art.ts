/**
 * Deterministic generative vector art engine for each token on AstroGate.
 *
 * Derives curated color palettes, generative archetypes, geometric harmonics,
 * and edition codes directly from the contract address hash.
 * 100% SVG & pure math: zero external asset dependencies, zero network requests,
 * and identical visual identity across every device (cosmic generative art style).
 */

export type ArtArchetype =
  | 'Cosmic Nebula'
  | 'Sacred Geometry'
  | 'Chromatic Rings'
  | 'Cyber Horizon'
  | 'Solar Prism'

export type ArtPalette = {
  name: string
  from: string
  via: string
  to: string
  accent: string
}

export type ArtShape = {
  cx: number
  cy: number
  r: number
  light: boolean
}

export type TokenArtSpec = {
  seed: number
  editionCode: string
  archetype: ArtArchetype
  paletteName: string
  from: string
  via: string
  to: string
  accent: string
  rotation: number
  ringCount: number
  shapes: [ArtShape, ArtShape, ArtShape]
}

export const PALETTES: readonly ArtPalette[] = [
  { name: 'Hyperion Cyan', from: '#0ea5e9', via: '#2563eb', to: '#0f172a', accent: '#38bdf8' },
  { name: 'Nebula Violet', from: '#8b5cf6', via: '#ec4899', to: '#0f172a', accent: '#f472b6' },
  { name: 'Emerald Aurora', from: '#10b981', via: '#059669', to: '#022c22', accent: '#34d399' },
  { name: 'Solar Flare', from: '#f59e0b', via: '#ea580c', to: '#1c1917', accent: '#fbbf24' },
  { name: 'Supernova Rose', from: '#f43f5e', via: '#9333ea', to: '#090d16', accent: '#fb7185' },
  { name: 'Quantum Indigo', from: '#6366f1', via: '#06b6d4', to: '#020617', accent: '#22d3ee' },
  { name: 'Cyber Mint', from: '#14b8a6', via: '#3b82f6', to: '#0f172a', accent: '#2dd4bf' },
  { name: 'Crimson Horizon', from: '#ef4444', via: '#f97316', to: '#18181b', accent: '#f87171' },
]

export const ARCHETYPES: readonly ArtArchetype[] = [
  'Cosmic Nebula',
  'Sacred Geometry',
  'Chromatic Rings',
  'Cyber Horizon',
  'Solar Prism',
]

/** FNV-1a 32-bit: fast + uniform distribution for art hashing. Normalizes input with trim. */
export function artSeed(id: string): number {
  const clean = id.trim()
  let hash = 0x811c9dc5
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function byte(hash: number, index: number): number {
  return (hash >>> ((index % 4) * 8)) & 0xff
}

export function tokenArtSpec(id: string): TokenArtSpec {
  const seed = artSeed(id)
  const secondary = artSeed(`${id.trim()}:art`)

  // Decoupled bit-slicing across the 32-bit seed entropy pool
  const palette = PALETTES[seed & 7]
  const archetype = ARCHETYPES[(seed >>> 3) % ARCHETYPES.length]
  const ringCount = 2 + ((seed >>> 6) & 3)
  const rotation = ((seed >>> 8) % 12) * 30
  const editionCode = `#${(((seed >>> 12) % 9000) + 1000).toString(10)}`

  const shape = (i: number): ArtShape => {
    const b1 = byte(seed, (i + 1) % 4)
    const b2 = byte(secondary, i)
    const b3 = byte(seed ^ secondary, (i + 2) % 4)
    return {
      cx: 16 + (b1 % 64),
      cy: 16 + (b2 % 64),
      r: 14 + (b3 % 28),
      light: (b2 & 1) === 0,
    }
  }

  return {
    seed,
    editionCode,
    archetype,
    paletteName: palette.name,
    from: palette.from,
    via: palette.via,
    to: palette.to,
    accent: palette.accent,
    rotation,
    ringCount,
    shapes: [shape(0), shape(1), shape(2)],
  }
}
