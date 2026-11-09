import { useEffect, useRef, useState } from 'react'

/**
 * Copiado al portapapeles con estado transitorio y cleanup correcto:
 * - El timeout se cancela al desmontar (sin setState tras unmount).
 * - Copiar dos veces seguidas no resucita el estado de la primera (reset).
 */
export function useCopy(resetAfterMs = 1800): {
  copied: boolean
  /** Último valor copiado (para UIs con varias filas/campos copiables). */
  lastCopied: string | null
  copy: (value: string) => Promise<void>
} {
  const [copied, setCopied] = useState(false)
  const [lastCopied, setLastCopied] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function copy(value: string): Promise<void> {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setLastCopied(value)
      timerRef.current = setTimeout(() => setCopied(false), resetAfterMs)
    } catch {
      // Sin permiso de portapapeles: sin estado engañoso.
    }
  }

  return { copied, lastCopied, copy }
}
