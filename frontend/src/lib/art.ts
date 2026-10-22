/**
 * Arte generativo determinista para cada token: el hash del contrato
 * elige una paleta curada y la posición de las formas. Mismo contrato →
 * misma identidad visual en cualquier dispositivo. SVG puro: cero red,
 * cero imágenes, cero andamiaje externo (el estilo OpenSea, honesto).
 */

const PALETTES = [
  { from: '#8b5cf6', to: '#22d3ee' }, // violeta → cian
  { from: '#ec4899', to: '#fb923c' }, // fucsia → naranja
  { from: '#38bdf8', to: '#4ade80' }, // azul → verde menta
  { from: '#f43f5e', to: '#a78bfa' }, // rojo → lavanda
  { from: '#2dd4bf', to: '#0f4c5c' }, // turquesa profunda
  { from: '#facc15', to: '#f97316' }, // dorado → ámbar
  { from: '#94a3b8', to: '#334155' }, // acero noche
  { from: '#a3e635', to: '#0e7490' }, // lima → petróleo
] as const

export type TokenArtSpec = {
  /** Hash de origen (garantiza ids únicos de gradientes SVG). */
  seed: number
  from: string
  to: string
  shapes: Array<{ cx: number; cy: number; r: number; light: boolean }>
}

/** FNV-1a 32 bits: velocidad + distribución suficiente para arte. */
export function artSeed(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function salted(seed: number, salt: number): number {
  return Math.imul(seed ^ salt, 0x9e3779b1) >>> 0
}

export function tokenArtSpec(id: string): TokenArtSpec {
  const seed = artSeed(id)
  const palette = PALETTES[seed % PALETTES.length]
  const shapes = [1, 2, 3].map((salt, index) => {
    const mix = salted(seed, salt)
    return {
      cx: 10 + (mix % 77), // 10..86 dentro del lienzo 96
      cy: 10 + ((mix >>> 7) % 77),
      r: 10 + ((mix >>> 14) % 18) + index * 7, // anillos de tamas variados
      light: (mix >>> 20) % 2 === 0,
    }
  })
  return { seed, from: palette.from, to: palette.to, shapes }
}
