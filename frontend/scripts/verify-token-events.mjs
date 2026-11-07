/**
 * Verificación de la actividad on-chain del token: parser + lectura real de
 * `getEvents` en testnet. Sin backend y sin `STELLAR_SECRET`.
 *
 * Uso: npm run verify:token-events
 */
import { createServer } from 'vite'

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

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const tokenEvents = await vite.ssrLoadModule('/src/lib/token-events.ts')

  const startedAt = performance.now()
  const events = await tokenEvents.fetchTokenEvents(ASTRO, { maxEvents: 20 })
  const elapsed = Math.round(performance.now() - startedAt)

  console.log(`eventos ASTRO: ${events.length} (${elapsed} ms)`)
  for (const event of events.slice(0, 5)) {
    console.log(
      `  ${event.kind.padEnd(8)} ${event.amount} ` +
        `ledger ${event.ledger} ${event.at} ${event.txHash ?? ''}`,
    )
  }

  check('retorna array de eventos válido', Array.isArray(events))
  check(
    'todos tienen monto, ledger y timestamp',
    events.every(
      (event) =>
        event.amount > 0n &&
        Number.isFinite(event.ledger) &&
        !Number.isNaN(Date.parse(event.at)),
    ),
  )
  check(
    'están ordenados de más reciente a más viejo',
    events.every(
      (event, index) =>
        index === 0 || events[index - 1].ledger >= event.ledger,
    ),
  )
  check(
    'los tipos son transfer/mint/burn',
    events.every((event) =>
      ['transfer', 'mint', 'burn'].includes(event.kind),
    ),
  )
  check(
    'las transferencias tienen from y to',
    events
      .filter((event) => event.kind === 'transfer')
      .every((event) => event.from && event.to),
  )

  if (failures > 0) {
    console.error(`\n${failures} fallo(s)`)
    process.exitCode = 1
  } else {
    console.log('\nactividad on-chain OK')
  }
} finally {
  await vite.close()
}
