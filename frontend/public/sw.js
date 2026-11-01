/**
 * Service worker de Floodgate.
 *
 * Estrategia deliberadamente conservadora:
 * - Precachea el shell (index + assets con hash + manifest/iconos).
 * - Navegación: network-first, con fallback al index cacheado.
 * - Assets estáticos: cache-first.
 * - NUNCA cachea RPC, Horizon, wallet relays ni respuestas de datos.
 *
 * No hay operaciones offline: la app avisa y deja claro que la red manda.
 */
// El build id lo inyecta scripts/stamp-sw.mjs tras compilar: cada deploy
// estrena caché y el activate borra las anteriores.
const CACHE = 'floodgate-shell-__BUILD_ID__'
const SHELL = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

async function precache() {
  const cache = await caches.open(CACHE)
  const index = await fetch('/', { cache: 'no-cache' })
  if (!index.ok) throw new Error('No se pudo precachear el index')
  await cache.put('/', index.clone())

  const html = await index.text()
  const assets = new Set(
    [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
      (match) => match[1],
    ),
  )

  await Promise.all(
    [...assets].map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-cache' })
        if (response.ok) await cache.put(url, response)
      } catch {
        // Un asset que falla no invalida el shell ya cacheado.
      }
    }),
  )

  await Promise.all(
    SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-cache' })
        if (response.ok) await cache.put(url, response)
      } catch {
        // Iconos/manifest no críticos para operar.
      }
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (response.ok) {
            const cache = await caches.open(CACHE)
            await cache.put('/', response.clone())
          }
          return response
        } catch {
          const cache = await caches.open(CACHE)
          return (await cache.match('/')) ?? Response.error()
        }
      })(),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE)
          await cache.put(request, response.clone())
        }
        return response
      })(),
    )
  }
})
