/**
 * AstroGate Service Worker.
 *
 * Deliberately conservative caching strategy:
 * - Pre-caches application shell (index + hashed assets + manifest/icons).
 * - Navigation: network-first, falling back to cached index.
 * - Static assets: cache-first.
 * - NEVER caches RPC, Horizon, wallet relays, or live blockchain data.
 *
 * No offline transactions: app clearly indicates when network connectivity is required.
 */
// Build ID injected by scripts/stamp-sw.mjs at build time: each deploy
// gets a fresh cache, and activate handler evicts previous versions.
const CACHE = 'astrogate-shell-__BUILD_ID__'
const SHELL = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

async function precache() {
  const cache = await caches.open(CACHE)
  const index = await fetch('/', { cache: 'no-cache' })
  if (!index.ok) throw new Error('Failed to precache index shell')
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
        // Failing asset does not invalidate cached shell.
      }
    }),
  )

  await Promise.all(
    SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-cache' })
        if (response.ok) await cache.put(url, response)
      } catch {
        // Non-critical icons / manifest assets.
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
