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
    wasmHash: constant('ASTRO_WASM_HASH'),
    name: 'AstroToken',
    out: 'src/contracts',
  },
  {
    id: constant('LAUNCHPAD_CONTRACT_ID'),
    name: 'AstroLaunchpad',
    out: 'src/contracts/launchpad',
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
    // El spec del par es común a todos los pares (mismo wasm); el client se
    // construye con el contractId de cada par en runtime.
    id: 'CA32TMZ2AODXI7K7B6T2YPZR52HJKFCY5GT2DNHMOL326DLSNPX55BUP',
    name: 'SoroswapPair',
    out: 'src/contracts/soroswap-pair',
  },
  {
    id: constant('XLM_SAC'),
    name: 'XlmSac',
    out: 'src/contracts/xlm-sac',
  },
]

for (const contract of CONTRACTS) {
  const targetLabel = contract.wasmHash ?? contract.id
  console.log(`\n== ${contract.name} (${targetLabel}) ==`)
  const targetArgs = contract.wasmHash
    ? ['--wasm-hash', contract.wasmHash]
    : ['--contract-id', contract.id]
  execFileSync(
    './node_modules/.bin/stellar-contract-bindings-typescript',
    [
      ...targetArgs,
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
