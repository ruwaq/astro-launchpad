/**
 * Verificación del descubrimiento de tokens contra testnet + casos unitarios
 * del parser de eventos (sin mocks de red: los eventos reales se leen del RPC).
 *
 * Uso: node scripts/verify-discovery.mjs
 * No necesita STELLAR_SECRET: todo son lecturas.
 */
import { createServer } from 'vite'
import { nativeToScVal } from '@stellar/stellar-sdk'

const XLM = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const ASTRO = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'

let failures = 0
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`ok   ${name}${detail ? ` · ${detail}` : ''}`)
  } else {
    failures++
    console.log(`FAIL ${name}${detail ? ` · ${detail}` : ''}`)
  }
}

function pairEvent({ pair, token0, token1, ledger = 123 }) {
  return {
    ledger,
    topic: [
      nativeToScVal('SoroswapFactory', { type: 'symbol' }),
      nativeToScVal('new_pair', { type: 'symbol' }),
    ],
    value: nativeToScVal({
      new_pairs_length: 1,
      pair,
      token_0: token0,
      token_1: token1,
    }),
  }
}

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const discovery = await vite.ssrLoadModule('/src/lib/discovery.ts')

  // --- Casos unitarios del parser -----------------------------------------
  const tokenA = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'
  const tokenB = 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
  const pair = 'CA32TMZ2AODXI7K7B6T2YPZR52HJKFCY5GT2DNHMOL326DLSNPX55BUP'

  const withXlm = discovery.parseNewPairEvent(
    pairEvent({ pair, token0: tokenA, token1: XLM }),
  )
  check('parsea par token/XLM (token primero)', withXlm?.tokenId === tokenA)
  check('conserva el id del par', withXlm?.pairId === pair)

  const xlmFirst = discovery.parseNewPairEvent(
    pairEvent({ pair: tokenB, token0: XLM, token1: tokenB }),
  )
  check('parsea par XLM/token (XLM primero)', xlmFirst?.tokenId === tokenB)

  const noXlm = discovery.parseNewPairEvent(
    pairEvent({ pair: tokenA, token0: tokenA, token1: tokenB }),
  )
  check('descarta pares sin XLM', noXlm === null)

  const wrongTopic = discovery.parseNewPairEvent({
    ...pairEvent({ pair, token0: tokenA, token1: XLM }),
    topic: [nativeToScVal('Otra', { type: 'symbol' })],
  })
  check('descarta eventos de otro contrato', wrongTopic === null)

  const deduped = discovery.newestPairPerToken([
    { tokenId: tokenA, pairId: 'viejo', ledger: 10 },
    { tokenId: tokenA, pairId: 'nuevo', ledger: 20 },
    { tokenId: tokenB, pairId: 'otro', ledger: 15 },
  ])
  check(
    'deduplica por token y ordena por novedad',
    deduped.length === 2 &&
      deduped[0].pairId === 'nuevo' &&
      deduped[1].pairId === 'otro',
  )

  // --- Red real ------------------------------------------------------------
  let startedAt = performance.now()
  const pairs = await discovery.discoverPairs()
  console.log(
    `\npares descubiertos: ${pairs.length} (${Math.round(
      performance.now() - startedAt,
    )} ms)`,
  )
  check('hay pares recientes en la ventana', pairs.length > 0)
  check(
    'el par de ASTRO aparece',
    pairs.some((p) => p.tokenId === ASTRO),
  )

  startedAt = performance.now()
  const listings = await discovery.discoverTokens({ maxTokens: 6 })
  console.log(
    `listados: ${listings.length} (${Math.round(
      performance.now() - startedAt,
    )} ms)`,
  )
  for (const listing of listings) {
    console.log(
      `  ${listing.symbol.padEnd(10)} ${listing.name.padEnd(24)} ` +
        `reservas ${listing.pool.reserveToken}/${listing.pool.reserveXlm}`,
    )
  }
  check('hay al menos un token listado', listings.length > 0)
  check(
    'todos los listados tienen metadata y reservas',
    listings.every(
      (l) => l.symbol && l.decimals > 0 && l.pool.reserveXlm >= 0n,
    ),
  )

  const astroListing = listings.find((l) => l.id === ASTRO)
  check(
    'ASTRO siempre aparece (token fijado)',
    Boolean(astroListing) && astroListing.pool.exists,
    astroListing ? `reservas ${astroListing.pool.reserveToken}` : 'ausente',
  )
} finally {
  await vite.close()
}

if (failures > 0) {
  console.error(`\n${failures} comprobación(es) fallidas`)
  process.exit(1)
}
console.log('\ndiscovery OK')
