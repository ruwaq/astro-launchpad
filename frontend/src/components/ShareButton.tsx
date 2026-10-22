import { useState } from 'react'

type Props = {
  text: string
  url: string
  label?: string
}

/**
 * Compartir nativo del móvil (Web Share API) con fallback a copiar link.
 * El equivalente honesto de "shillemea tu meme": mientras más creadores
 * compartan, más Fees actúmulan en su pool.
 */
export function ShareButton({ text, url, label = 'Compartir 🎉' }: Props) {
  const [copied, setCopied] = useState(false)

  async function onShare() {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined
    if (nav?.share) {
      try {
        await nav.share({ title: 'Floodgate 🌊', text, url })
        return
      } catch {
        return // el usuario canceló el sheet nativo
      }
    }
    if (nav?.clipboard) {
      try {
        await nav.clipboard.writeText(`${text} ${url}`)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      } catch {
        // clipboard bloqueado: no hay nada más que hacer
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onShare()}
      className="min-h-[44px] rounded-lg border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-xs font-medium text-emerald-300 hover:border-emerald-600"
    >
      {copied ? 'Link copiado ✓' : label}
    </button>
  )
}
