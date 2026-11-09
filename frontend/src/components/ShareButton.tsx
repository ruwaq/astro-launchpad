import { BRAND } from '../lib/brand'
import { useCopy } from '../hooks/useCopy'

type Props = {
  text: string
  url: string
  label?: string
}

export function ShareButton({ text, url, label = 'Share 🎉' }: Props) {
  const { copied, copy } = useCopy()

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
      await copy(`${text} ${url}`)
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
