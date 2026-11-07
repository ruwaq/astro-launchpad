import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Vuelve arriba al cambiar de ruta (los deep links no heredan scroll). */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
