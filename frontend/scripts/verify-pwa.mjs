/**
 * Verificación de artefactos PWA (sin navegador): manifest válido, service
 * worker copiado a `dist`, precache del shell y registro en el bundle.
 * No sustituye a una prueba offline real; valida que el build los incluya.
 *
 * Uso: npm run build && npm run verify:pwa
 */
import { readFile, readdir } from 'node:fs/promises'

let failures = 0
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`ok   ${name}${detail ? ` · ${detail}` : ''}`)
  } else {
    failures++
    console.log(`FAIL ${name}${detail ? ` · ${detail}` : ''}`)
  }
}

const dist = new URL('../dist/', import.meta.url)

const manifest = JSON.parse(
  await readFile(new URL('manifest.webmanifest', dist), 'utf8'),
)
check('manifest con nombre y start_url', Boolean(manifest.name && manifest.start_url))
check('manifest con iconos', Array.isArray(manifest.icons) && manifest.icons.length >= 2)

const sw = await readFile(new URL('sw.js', dist), 'utf8')
check(
  'service worker copiado y estampado',
  /astrogate-shell-[a-f0-9]{12}/.test(sw) && !sw.includes('__BUILD_ID__'),
)
check('SW precachea index/assets', sw.includes("fetch('/', { cache: 'no-cache' })"))
check('SW usa network-first en navegación', sw.includes("request.mode === 'navigate'"))
check('SW no cachea orígenes externos', sw.includes('url.origin !== self.location.origin'))

const index = await readFile(new URL('index.html', dist), 'utf8')
check('index referencia el manifest', index.includes('manifest.webmanifest'))
check('index referencia assets con hash', /\/assets\/[^"]+\.js/.test(index))

const headers = await readFile(new URL('_headers', dist), 'utf8')
check('headers revalidan /sw.js', /\/sw\.js[\s\S]*?Cache-Control:\s*no-cache/.test(headers))

const assets = await readdir(new URL('assets/', dist))
let registered = false
for (const file of assets.filter((name) => name.endsWith('.js'))) {
  const source = await readFile(new URL(`assets/${file}`, dist), 'utf8')
  if (source.includes('serviceWorker') && source.includes('/sw.js')) {
    registered = true
    break
  }
}
check('el bundle registra el service worker', registered)

if (failures > 0) {
  console.error(`\n${failures} fallo(s) PWA`)
  process.exitCode = 1
} else {
  console.log('\nPWA OK · manifest + shell offline + registro')
}
