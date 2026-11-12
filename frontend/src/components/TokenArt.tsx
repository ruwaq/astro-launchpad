import { useId, useState } from 'react'
import { tokenArtSpec } from '../lib/art'

type Props = {
  id: string
  symbol?: string
  logoUrl?: string
  className?: string
}

/** Protocol whitelist to block unsafe/scriptable image URL schemes */
function isValidImageUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (/^(https?:\/\/|\/|ipfs:\/\/)/i.test(trimmed)) {
    return true
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(trimmed)) {
    return true
  }
  return false
}

/**
 * Clean deterministic visual token identity: displays custom logo if provided,
 * or a multi-layered geometric vector emblem derived from the contract address.
 */
export function TokenArt({ id, symbol, logoUrl, className }: Props) {
  const [failedLogoKey, setFailedLogoKey] = useState<string | null>(null)
  const rawInstanceId = useId()
  const instanceId = rawInstanceId.replace(/[^a-zA-Z0-9_-]/g, '')

  const safeLogoUrl = logoUrl && isValidImageUrl(logoUrl) ? logoUrl.trim() : null
  const currentLogoKey = safeLogoUrl ? `${id}:${safeLogoUrl}` : null
  const imageError = currentLogoKey !== null && failedLogoKey === currentLogoKey

  const spec = tokenArtSpec(id)
  const gid = `ag-art-${spec.seed}-${instanceId}`
  const glowId = `ag-glow-${spec.seed}-${instanceId}`
  const gridId = `ag-grid-${spec.seed}-${instanceId}`

  // Strip non-printable, zero-width, and bidirectional control characters
  const rawSymbol = (symbol?.trim() || id.slice(1, 3))
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF\u202A-\u202E]/g, '')
    .trim()
  const mono = (rawSymbol || 'TKN').slice(0, 4).toUpperCase()

  if (safeLogoUrl && !imageError) {
    return (
      <img
        src={safeLogoUrl}
        alt={symbol ?? id}
        onError={() => setFailedLogoKey(currentLogoKey)}
        className={`overflow-hidden object-cover ${className ?? ''}`}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 160 160"
      preserveAspectRatio="xMidYMid slice"
      className={`overflow-hidden ${className ?? ''}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={spec.from} />
          <stop offset="52%" stopColor={spec.via} />
          <stop offset="100%" stopColor={spec.to} />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor={spec.accent} stopOpacity="0.45" />
          <stop offset="100%" stopColor={spec.to} stopOpacity="0" />
        </radialGradient>
        <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse">
          <path
            d="M 16 0 L 0 0 0 16"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.06"
            strokeWidth="0.75"
          />
        </pattern>
      </defs>

      {/* Base Gradient Canvas */}
      <rect width="160" height="160" fill={`url(#${gid})`} />
      <rect width="160" height="160" fill={`url(#${gridId})`} />
      <rect width="160" height="160" fill={`url(#${glowId})`} />

      {/* Ambient Generative Orbs */}
      {spec.shapes.map((shape, index) => {
        const cx = Math.round((shape.cx / 96) * 160)
        const cy = Math.round((shape.cy / 96) * 160)
        const r = Math.round((shape.r / 96) * 160)
        return (
          <circle
            key={index}
            cx={cx}
            cy={cy}
            r={r}
            fill={shape.light ? '#ffffff' : '#020617'}
            fillOpacity={shape.light ? 0.12 : 0.22}
          />
        )
      })}

      {/* Archetype Geometric Layer */}
      <g transform={`translate(80, 80) rotate(${spec.rotation})`}>
        {Array.from({ length: spec.ringCount }).map((_, idx) => {
          const radius = 28 + idx * 14
          return (
            <circle
              key={idx}
              cx="0"
              cy="0"
              r={radius}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.22 - idx * 0.04}
              strokeWidth={idx === 0 ? '1.5' : '1'}
              strokeDasharray={spec.archetype === 'Chromatic Rings' ? '6 4' : undefined}
            />
          )
        })}
        {spec.archetype === 'Sacred Geometry' || spec.archetype === 'Solar Prism' ? (
          <polygon
            points="0,-54 47,27 -47,27"
            fill="none"
            stroke={spec.accent}
            strokeOpacity="0.35"
            strokeWidth="1.25"
          />
        ) : null}
        {spec.archetype === 'Sacred Geometry' ? (
          <polygon
            points="0,54 47,-27 -47,-27"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.25"
            strokeWidth="1.25"
          />
        ) : null}
        {spec.archetype === 'Cyber Horizon' ? (
          <>
            <line
              x1="-54"
              y1="0"
              x2="54"
              y2="0"
              stroke={spec.accent}
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
            <line
              x1="-42"
              y1="-16"
              x2="42"
              y2="-16"
              stroke="#ffffff"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1="-42"
              y1="16"
              x2="42"
              y2="16"
              stroke="#ffffff"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </>
        ) : null}
      </g>

      {/* Glass Pedestal Monogram */}
      <rect
        x="34"
        y="56"
        width="92"
        height="48"
        rx="14"
        fill="#020617"
        fillOpacity="0.38"
        stroke="#ffffff"
        strokeOpacity="0.24"
        strokeWidth="1"
      />
      <text
        x="80"
        y={mono.length > 3 ? '86' : '87'}
        textAnchor="middle"
        fontSize={mono.length > 3 ? '18' : '24'}
        fontWeight="800"
        fill="#ffffff"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing={mono.length > 3 ? '1' : '1.5'}
        lengthAdjust="spacingAndGlyphs"
        textLength={mono.length > 3 ? '72' : undefined}
      >
        {mono}
      </text>
    </svg>
  )
}
