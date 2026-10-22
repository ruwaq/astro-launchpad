/**
 * Ajusta los bindings generados por `stellar-contract-bindings-typescript` para
 * que compilen con las opciones estrictas del frontend (verbatimModuleSyntax,
 * erasableSyntaxOnly, noUnusedLocals).
 *
 * Reglas aplicadas:
 *  1. Separa en imports de tipos los nombres que solo existen como tipos.
 *  2. Convierte la property parameter del constructor en campo + asignacion
 *     (no es codigo "erasable").
 *  3. Quita imports sin usar.
 *
 * Es idempotente: se puede correr despues de cada regeneracion.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Exports que si existen en runtime dentro de '@stellar/stellar-sdk/contract'. */
const RUNTIME_SDK_EXPORTS = new Set([
  'Spec',
  'AssembledTransaction',
  'SentTransaction',
  'Client',
  'KeypairSigner',
  'BasicNodeSigner',
])

/** Nombres declarados como valor (runtime) en el archivo de types.ts. */
function runtimeTypeExports(typesSource) {
  const names = new Set()
  for (const match of typesSource.matchAll(/export\s+const\s+(\w+)/g)) {
    names.add(match[1])
  }
  return names
}

/** Divide una lista de nombres en valor vs tipo. Soporta "X as Y". */
function splitImports(names, runtime) {
  const values = []
  const types = []
  for (const entry of names) {
    const original = entry.split(/\s+as\s+/)[0].trim()
    if (runtime.has(original)) {
      values.push(entry)
    } else {
      types.push(entry)
    }
  }
  return { values, types }
}

function patchClient(dir, typesSource) {
  const path = join(dir, 'client.ts')
  let source = readFileSync(path, 'utf8')
  const localRuntime = runtimeTypeExports(typesSource)

  // 1. Import de './types.js': separar tipos.
  source = source.replace(
    /import\s+\{([^}]+)\}\s+from\s+'\.\/types\.js';/g,
    (match, names) => {
      const list = names.split(',').map((n) => n.trim()).filter(Boolean)
      const { values, types } = splitImports(list, localRuntime)
      const lines = []
      if (values.length) {
        lines.push(`import {${values.join(', ')}} from './types.js';`)
      }
      if (types.length) {
        lines.push(`import type {${types.join(', ')}} from './types.js';`)
      }
      return lines.join('\n')
    },
  )

  // 2. Import del SDK: separar tipos.
  source = source.replace(
    /import\s+\{([^}]+)\}\s+from\s+'@stellar\/stellar-sdk\/contract';/g,
    (match, names) => {
      const list = names.split(',').map((n) => n.trim()).filter(Boolean)
      const { values, types } = splitImports(list, RUNTIME_SDK_EXPORTS)
      const lines = []
      if (values.length) {
        lines.push(`import {${values.join(', ')}} from '@stellar/stellar-sdk/contract';`)
      }
      if (types.length) {
        lines.push(
          `import type {${types.join(', ')}} from '@stellar/stellar-sdk/contract';`,
        )
      }
      return lines.join('\n')
    },
  )

  // 3. Constructor: property parameter -> campo + asignacion.
  if (source.includes('constructor(public readonly options: ContractClientOptions) {')) {
    source = source.replace(
      /constructor\(public readonly options: ContractClientOptions\) \{([\s\S]*?)\n      options\n    \);/,
      (match, body) =>
        `readonly options: ContractClientOptions;\n` +
        `  constructor(options: ContractClientOptions) {${body}\n      options\n    );\n` +
        `    this.options = options;`,
    )
  }

  writeFileSync(path, source)
}

function patchTypes(dir) {
  const path = join(dir, 'types.ts')
  let source = readFileSync(path, 'utf8')

  // Quita imports sin usar (p.ej. Address si el archivo no lo usa).
  source = source.replace(
    /import\s+\{([^}]+)\}\s+from\s+'@stellar\/stellar-sdk';\n/g,
    (match, names) => {
      const list = names.split(',').map((n) => n.trim()).filter(Boolean)
      const used = list.filter((name) => {
        const body = source.slice(match.length)
        return new RegExp(`\\b${name}\\b`).test(body)
      })
      if (used.length === list.length) return match
      if (used.length === 0) return ''
      return `import {${used.join(', ')}} from '@stellar/stellar-sdk';\n`
    },
  )

  writeFileSync(path, source)
}

/**
 * Los enums de error se generan como `const` (valor), pero el cliente los usa
 * como tipo en las firmas (`Result<T, MiError>`). Anade el alias de tipo.
 */
function patchErrorTypes(dir) {
  const path = join(dir, 'types.ts')
  const source = readFileSync(path, 'utf8')

  const names = [...source.matchAll(/export\s+const\s+(\w+)\s*=/g)].map((m) => m[1])
  const missing = names.filter(
    (name) => !new RegExp(`export\\s+(type|interface)\\s+${name}\\b`).test(source),
  )
  if (missing.length === 0) return

  const aliases = missing
    .map((name) => `export type ${name} = { message: string }`)
    .join('\n')
  writeFileSync(
    path,
    `${source.trimEnd()}\n\n// Alias de tipo para los enums de error (usados como tipo en las firmas).\n${aliases}\n`,
  )
}

export function patchBindings(dir) {
  const typesPath = join(dir, 'types.ts')
  const typesSource = readFileSync(typesPath, 'utf8')
  patchClient(dir, typesSource)
  patchTypes(dir)
  patchErrorTypes(dir)
  console.log(`ok: ${dir}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  patchBindings(process.argv[2] ?? 'src/contracts')
}
