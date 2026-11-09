/**
 * Paridad de CSP: la política de seguridad debe ser IDÉNTICA en las tres
 * fuentes de despliegue (Vercel, Cloudflare/Pages `_headers` y nginx).
 * Si una copia se actualiza y la otra no, la app rompe en producción o la
 * política queda más laxa en algunos despliegues. `npm run check` lo ejecuta.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

/** Orígenes que la app usa de verdad (lib/xlm.ts, wallet kit, friendbot). */
const REQUIRED_ORIGINS = [
  'https://*.stellar.org',
  'wss://*.stellar.org',
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'wss://*.walletconnect.com',
  'wss://*.walletconnect.org',
  'https://*.reown.com',
  'https://api.coinbase.com',
  'https://api.binance.com',
  'https://api.coingecko.com',
  'https://friendbot.stellar.org',
]

/** Origen eliminado del código (lib/xlm.ts ya no consulta CryptoCompare). */
const RETIRED_ORIGINS = ['cryptocompare']

function normalize(csp) {
  return csp.replace(/\s+/g, ' ').trim().replace(/;\s*$/, ';')
}

function extractFromVercel(text) {
  const json = JSON.parse(text)
  const policy = json.headers
    ?.flatMap((entry) => entry.headers ?? [])
    .find((header) => header.key.toLowerCase() === 'content-security-policy')
    ?.value
  if (!policy) throw new Error('vercel.json: no encuentra Content-Security-Policy')
  return policy
}

function extractFromHeadersFile(text) {
  const match = text.match(/^\s*Content-Security-Policy:\s*(.+)$/im)
  if (!match) throw new Error('_headers: no encuentra Content-Security-Policy')
  return match[1]
}

function extractFromNginx(text) {
  const match = text.match(/add_header\s+Content-Security-Policy\s+"([^"]+)"/i)
  if (!match) throw new Error('nginx.conf: no encuentra Content-Security-Policy')
  return match[1]
}

const sources = [
  ['vercel.json', join(root, 'vercel.json'), extractFromVercel],
  ['public/_headers', join(root, 'public/_headers'), extractFromHeadersFile],
  ['nginx.conf', join(root, 'nginx.conf'), extractFromNginx],
]

const extracted = []
for (const [name, path, extract] of sources) {
  const raw = await readFile(path, 'utf8')
  extracted.push({ name, policy: normalize(extract(raw)) })
}

const [first, ...rest] = extracted
let failed = false
for (const other of rest) {
  if (other.policy !== first.policy) {
    failed = true
    console.error(`✗ CSP divergente: ${first.name} ≠ ${other.name}`)
  }
}

for (const { name, policy } of extracted) {
  for (const origin of REQUIRED_ORIGINS) {
    if (!policy.includes(origin)) {
      failed = true
      console.error(`✗ ${name}: falta origen requerido ${origin}`)
    }
  }
  for (const retired of RETIRED_ORIGINS) {
    if (policy.toLowerCase().includes(retired)) {
      failed = true
      console.error(`✗ ${name}: contiene origen retirado ${retired}`)
    }
  }
}

if (failed) process.exit(1)
console.log('✓ CSP idéntica en vercel.json, public/_headers y nginx.conf')
