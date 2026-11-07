/**
 * Sonda de solo lectura: ¿qué eventos emite la factory de Soroswap?
 * Sirve para decidir si el listado de tokens puede salir de la red (sin backend).
 *
 * Uso: node scripts/probe-events.mjs [ventana_de_ledgers]
 */
import { rpc, scValToNative } from '@stellar/stellar-sdk'
import { RPC_URL, SOROSWAP_FACTORY } from '../src/lib/network.ts'

const windowSize = Number(process.argv[2] ?? 10000)
const server = new rpc.Server(RPC_URL)

const latest = await server.getLatestLedger()
const startLedger = Math.max(1, latest.sequence - windowSize)
console.log(`ledgers ${startLedger}..${latest.sequence} (${windowSize})`)

const { events } = await server.getEvents({
  startLedger,
  filters: [
    {
      type: 'contract',
      contractIds: [SOROSWAP_FACTORY],
    },
  ],
  limit: 200,
})

console.log(`eventos de factory: ${events.length}`)
for (const event of events) {
  let topics
  let value
  try {
    topics = event.topic.map((t) => scValToNative(t))
    value = scValToNative(event.value)
  } catch (error) {
    topics = event.topic
    value = `(no decodificable: ${error.message})`
  }
  console.log(
    JSON.stringify(
      {
        ledger: event.ledger,
        txHash: event.txHash,
        contractId: event.contractId?.toString(),
        topics,
        value,
      },
      (_key, v) => (typeof v === 'bigint' ? v.toString() : v),
    ),
  )
}
