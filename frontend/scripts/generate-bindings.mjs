/**
 * Regenera los bindings TypeScript de los contratos que usa el frontend.
 *
 * Pasos: generar con el CLI del JS SDK -> aplanar la estructura que crea ->
 * parchear para las opciones estrictas de TypeScript del frontend.
 *
 * Uso: npm run bindings
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { patchBindings } from './patch-bindings.mjs'

const network = readFileSync('src/lib/network.ts', 'utf8')

/** Lee una constante `export const X = '...'` de src/lib/network.ts. */
function constant(name) {
  const value = network.match(new RegExp(`${name} =\\s*'([^']+)'`))?.[1]
  if (!value) {
    console.error(`No se encontró ${name} en src/lib/network.ts`)
    process.exit(1)
  }
  return value
}

const CONTRACTS = [
  {
    id: constant('ASTRO_TOKEN_ID'),
    name: 'AstroToken',
    out: 'src/contracts',
  },
  {
    id: constant('SOROSWAP_ROUTER'),
    name: 'SoroswapRouter',
    out: 'src/contracts/soroswap-router',
  },
  {
    id: constant('SOROSWAP_FACTORY'),
    name: 'SoroswapFactory',
    out: 'src/contracts/soroswap-factory',
  },
  {
    id: constant('XLM_SAC'),
    name: 'XlmSac',
    out: 'src/contracts/xlm-sac',
  },
]

for (const contract of CONTRACTS) {
  console.log(`\n== ${contract.name} (${contract.id}) ==`)
  execFileSync(
    './node_modules/.bin/stellar-contract-bindings-typescript',
    [
      '--contract-id',
      contract.id,
      '--network',
      'testnet',
      '--output-dir',
      contract.out,
      '--contract-name',
      contract.name,
      '--overwrite',
    ],
    { stdio: 'inherit' },
  )

  // El generador deja los .ts dentro de `src/`; los movemos al nivel del output.
  const generated = join(contract.out, 'src')
  if (existsSync(generated)) {
    for (const file of ['client.ts', 'types.ts', 'index.ts']) {
      renameSync(join(generated, file), join(contract.out, file))
    }
    rmSync(generated, { recursive: true, force: true })
  }
  for (const file of ['package.json', 'tsconfig.json']) {
    rmSync(join(contract.out, file), { force: true })
  }

  patchBindings(contract.out)
}

console.log('\nBindings listos')
