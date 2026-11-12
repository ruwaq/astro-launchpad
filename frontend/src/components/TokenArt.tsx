import { useState } from 'react'
import { tokenArtSpec } from '../lib/art'

type Props = {
  id: string
  symbol?: string
  logoUrl?: string
  className?: string
  showBadge?: boolean
}

/**
 * Collector-grade visual identity of the token: displays custom artwork if provided,
 * or a deterministic multi-layered generative SVG NFT artwork derived from the contract address.
 */
export function TokenArt({ id, symbol, logoUrl, className, showBadge = false }: Props) {
  const [failedLogoKey, setFailedLogoKey] = useState<string | null>(null)
  const currentLogoKey = logoUrl ? `${id}:${logoUrl}` : null
  const imageError = currentLogoKey !== null && failedLogoKey === currentLogoKey

  const spec = tokenArtSpec(id)
  const gid = `ag-art-${spec.seed}`
  const glowId = `ag-glow-${spec.seed}`
  const gridId = `ag-grid-${spec.seed}`
  const mono = (symbol?.trim() || id.slice(1, 3)).slice(0, 4).toUpperCase()

  if (logoUrl && !imageError) {
    return (
      <img
        src={logoUrl}
        alt={symbol ?? id}
        onError={() => setFailedLogoKey(currentLogoKey)}
        className={`${className ?? ''} object-cover`}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 160 160"
      preserveAspectRatio="xMidYMid slice"
      className={className}
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
      {spec.shapes.map((shape, index) => (
        <circle
          key={index}
          cx={(shape.cx / 96) * 160}
          cy={(shape.cy / 96) * 160}
          r={(shape.r / 96) * 160}
          fill={shape.light ? '#ffffff' : '#020617'}
          fillOpacity={shape.light ? 0.12 : 0.22}
        />
      ))}

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
        y="87"
        textAnchor="middle"
        fontSize="24"
        fontWeight="800"
        fill="#ffffff"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="1.5"
      >
        {mono}
      </text>

      {showBadge ? (
        <text
          x="80"
          y="146"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="600"
          fill="#e2e8f0"
          fillOpacity="0.75"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          letterSpacing="1.2"
        >
          {spec.archetype.toUpperCase()} · {spec.editionCode}
        </text>
      ) : null}
    </svg>
  )
}
