/**
 * Ratchet de `npm audit`: bloquea REGRESIONES de vulnerabilidades.
 *
 * El baseline actual es transitivo de los módulos de wallet de
 * `@creit.tech/stellar-wallets-kit` (@hot-wallet/sdk → near-js/elliptic,
 * @reown/appkit → zod, etc.) y no tiene fix sin downgrade del kit. Cuando el
 * kit suelte una versión limpia, BAJAR `baseline` en ci.yml y aquí.
 *
 * Uso: node scripts/npm-audit-ratchet.mjs [baseline=30]
 * (el CI pasa el baseline también por env `AUDIT_BASELINE`).
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const argBaseline = Number(process.argv[2] ?? '')
const envBaseline = Number(process.env.AUDIT_BASELINE ?? '')
const baseline = Number.isFinite(argBaseline) && argBaseline > 0
  ? argBaseline
  : Number.isFinite(envBaseline) && envBaseline > 0
    ? envBaseline
    : 30

const result = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  // npm audit sale con 1 cuando hay vulnerabilidades: no es un fallo aquí.
  stdio: ['ignore', 'pipe', 'ignore'],
  maxBuffer: 16 * 1024 * 1024,
})

let audit
try {
  audit = JSON.parse(result.stdout)
} catch {
  console.error('✗ npm audit --json devolvió salida no parseable (¿sin red?)')
  process.exit(1)
}

const metadata = audit.metadata?.vulnerabilities ?? {}
const counts = [
  'critical',
  'high',
  'moderate',
  'low',
].map((level) => Number(metadata[level] ?? 0))
const total = counts.reduce((sum, n) => sum + n, 0)
const [criticalCount] = counts

console.log(
  `Vulnerabilidades npm audit: ${total} (crit ${counts[0]} · high ${counts[1]} · mod ${counts[2]} · low ${counts[3]}) — baseline ${baseline}`,
)

if (criticalCount > 0) {
  console.error(
    `✗ Fallo crítico de seguridad: se detectaron ${criticalCount} vulnerabilidades críticas en npm audit.`,
  )
  process.exit(1)
}

if (total > baseline) {
  console.error(
    '✗ Se superó el baseline de vulnerabilidades: revisa si una nueva dependencia añadió transitivos.',
  )
  process.exit(1)
}
if (total < baseline) {
  console.log(
    `ℹ Aviso: las vulnerabilidades bajaron de ${baseline} a ${total}. Se puede reducir el baseline en ci.yml y scripts/npm-audit-ratchet.mjs.`,
  )
}
console.log('✓ npm audit dentro del baseline')
