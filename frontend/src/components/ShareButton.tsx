import { useState } from 'react'
import { BRAND } from '../lib/brand'

type Props = {
  text: string
  url: string
  label?: string
}

export function ShareButton({ text, url, label = 'Share 🎉' }: Props) {
  const [copied, setCopied] = useState(false)

  async function onShare() {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined
    if (nav?.share) {
      try {
        await nav.share({ title: `${BRAND.name} ${BRAND.emoji}`, text, url })
        return
      } catch {
        return
      }
    }
    if (nav?.clipboard) {
      try {
        await nav.clipboard.writeText(`${text} ${url}`)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      } catch {
        // Clipboard access denied
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onShare()}
      className="min-h-[44px] rounded-lg border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-xs font-medium text-emerald-300 hover:border-emerald-600"
    >
      {copied ? 'Link copied ✓' : label}
    </button>
  )
}
