/**
 * Paridad de CSP y cabeceras de seguridad:
 * La política de seguridad y cabeceras HTTP deben ser IDÉNTICAS en las tres
 * fuentes de despliegue (Vercel, Cloudflare/Pages `_headers` y nginx).
 * Si una copia se actualiza y la otra no, la app rompe en producción o la
 * política queda más laxa en algunos despliegues. `npm run check` lo ejecuta.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

/** Orígenes que la app usa de verdad (lib/xlm.ts, wallet kit, friendbot, reown fonts). */
const REQUIRED_ORIGINS = [
  'https://*.stellar.org',
  'wss://*.stellar.org',
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'wss://*.walletconnect.com',
  'wss://*.walletconnect.org',
  'https://*.reown.com',
  'https://*.web3modal.org',
  'https://*.web3modal.com',
  'https://fonts.reown.com',
  'https://api.coinbase.com',
  'https://api.binance.com',
  'https://api.coingecko.com',
  'https://friendbot.stellar.org',
]

/** Origen eliminado del código (lib/xlm.ts ya no consulta CryptoCompare). */
const RETIRED_ORIGINS = ['cryptocompare']

/** Cabeceras de seguridad compartidas que deben coincidir en todos los entornos. */
const SHARED_SECURITY_HEADERS = [
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'strict-transport-security',
]

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim().replace(/;\s*$/, ';')
}

function extractFromVercel(text) {
  const json = JSON.parse(text)
  const catchAll = json.headers?.find((entry) => entry.source === '/(.*)')
  const headers = catchAll?.headers ?? []
  const map = new Map()
  for (const h of headers) {
    map.set(h.key.toLowerCase(), normalize(h.value))
  }
  return map
}

function extractFromHeadersFile(text) {
  const map = new Map()
  const blockMatch = text.match(/\/\*\s*\n([\s\S]*?)(?=\n\s*\/|\n\s*#\s*[A-Z]|$)/i)
  const lines = (blockMatch ? blockMatch[1] : text).split('\n')
  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0 && !line.trim().startsWith('#')) {
      const key = line.slice(0, colonIdx).trim().toLowerCase()
      const val = line.slice(colonIdx + 1).trim()
      map.set(key, normalize(val))
    }
  }
  return map
}

function extractFromNginx(text) {
  const map = new Map()
  const regex = /add_header\s+([\w-]+)\s+"([^"]+)"/gi
  let match
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].toLowerCase()
    const val = normalize(match[2])
    if (!map.has(key)) {
      map.set(key, val)
    }
  }
  return map
}

const sources = [
  ['vercel.json', join(root, 'vercel.json'), extractFromVercel],
  ['public/_headers', join(root, 'public/_headers'), extractFromHeadersFile],
  ['nginx.conf', join(root, 'nginx.conf'), extractFromNginx],
]

const extracted = []
for (const [name, path, extract] of sources) {
  const raw = await readFile(path, 'utf8')
  extracted.push({ name, headers: extract(raw) })
}

let failed = false

// 1. Verificar paridad exacta de todas las cabeceras de seguridad compartidas
const [first, ...rest] = extracted
for (const headerKey of SHARED_SECURITY_HEADERS) {
  const expected = first.headers.get(headerKey)
  if (!expected) {
    failed = true
    console.error(`✗ ${first.name}: falta cabecera obligatoria ${headerKey}`)
    continue
  }
  for (const other of rest) {
    const actual = other.headers.get(headerKey)
    if (!actual) {
      failed = true
      console.error(`✗ ${other.name}: falta cabecera obligatoria ${headerKey}`)
    } else if (actual !== expected) {
      failed = true
      console.error(
        `✗ Cabecera divergente [${headerKey}]: ${first.name} ≠ ${other.name}\n  ${first.name}: ${expected}\n  ${other.name}: ${actual}`,
      )
    }
  }
}

// 2. Verificar orígenes requeridos y retirados en la CSP de cada fuente
for (const { name, headers } of extracted) {
  const policy = headers.get('content-security-policy') ?? ''
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
console.log(
  '✓ Paridad completa de CSP y cabeceras de seguridad en vercel.json, public/_headers y nginx.conf',
)
