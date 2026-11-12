/**
 * Registers the service worker in production only. In dev, HMR and Vite
 * require an unintercepted network and caching assets would add noise.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Failed to register service worker:', error)
      })
    },
    { once: true },
  )
}
