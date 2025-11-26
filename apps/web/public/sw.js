/**
 * Service Worker for Astro Shiba PWA
 *
 * Provides:
 * - Offline capability for static assets
 * - Network-first strategy for API calls
 * - Push notifications
 * - Background sync for transactions
 */

const CACHE_NAME = 'astro-shiba-v1';
const STATIC_CACHE = 'astro-shiba-static-v1';
const DYNAMIC_CACHE = 'astro-shiba-dynamic-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/explore',
  '/create',
  '/portfolio',
  '/offline',
];

// API routes that should use network-first strategy
const API_ROUTES = [
  '/api/',
  'graphql',
  'soroban-testnet.stellar.org',
];

// Install event - cache static assets with graceful error handling
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      console.log('[SW] Caching static assets');

      // Graceful fallback: cache each asset individually
      // If one fails, continue with others instead of failing entire operation
      const cachePromises = STATIC_ASSETS.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            console.log(`[SW] ✓ Cached: ${url}`);
          } else {
            console.warn(`[SW] ✗ Failed to cache (${response.status}): ${url}`);
          }
        } catch (error) {
          console.warn(`[SW] ✗ Error caching ${url}:`, error.message);
        }
      });

      await Promise.allSettled(cachePromises);
      console.log('[SW] Static asset caching completed');
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Check if this is an API route
  const isApiRoute = API_ROUTES.some((route) => url.href.includes(route));

  if (isApiRoute) {
    // Network-first strategy for API calls
    event.respondWith(networkFirst(request));
  } else {
    // Cache-first strategy for static assets
    event.respondWith(cacheFirst(request));
  }
});

// Cache-first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    throw error;
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Cache successful API responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from Astro Shiba',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [100, 50, 100],
      tag: data.tag || 'default',
      renotify: true,
      data: {
        url: data.url || '/',
        dateOfArrival: Date.now(),
      },
      actions: data.actions || [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Astro Shiba',
        options
      )
    );
  } catch (error) {
    console.error('[SW] Error handling push:', error);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if none exists
      return clients.openWindow(urlToOpen);
    })
  );
});

// Background sync for failed transactions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  // This would sync any pending transactions stored in IndexedDB
  // Implementation depends on your transaction queue system
  console.log('[SW] Syncing pending transactions...');
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
