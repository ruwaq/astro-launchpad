/**
 * Registra el service worker solo en producción. En dev no se toca: HMR y
 * Vite necesitan red limpia y un SW cacheando assets solo añadiría ruido.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('No se pudo registrar el service worker', error)
      })
    },
    { once: true },
  )
}
