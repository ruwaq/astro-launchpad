import { useEffect, useRef, useState } from 'react'

/**
 * Clipboard copy helper with transient state and proper cleanup:
 * - Cancels timeout on unmount (avoids setState after unmount).
 * - Successive copies reset the timer without resurrecting stale state.
 */
export function useCopy(resetAfterMs = 1800): {
  copied: boolean
  /** Last copied value (useful for UIs with multiple copyable rows/fields). */
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
      // Clipboard permission denied or unavailable: keep state honest.
    }
  }

  return { copied, lastCopied, copy }
}
