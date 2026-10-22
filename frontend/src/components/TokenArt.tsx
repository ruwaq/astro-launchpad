import { tokenArtSpec } from '../lib/art'

type Props = {
  id: string
  symbol?: string
  className?: string
}

/**
 * Identidad visual del token (estética de colección OpenSea): circulitos
 * y degradado derivados del hash del contrato. El monograma es el
 * símbolo del token — nada de inventar imágenes que no existen.
 */
export function TokenArt({ id, symbol, className }: Props) {
  const spec = tokenArtSpec(id)
  const gid = `fg-art-${spec.seed}`
  const mono = (symbol?.trim() || id.slice(1, 3)).slice(0, 4)

  return (
    <svg
      viewBox="0 0 96 96"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={spec.from} />
          <stop offset="100%" stopColor={spec.to} />
        </linearGradient>
      </defs>
      <rect width="96" height="96" fill={`url(#${gid})`} />
      {spec.shapes.map((shape, index) => (
        <circle
          key={index}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={shape.light ? '#ffffff' : '#0f172a'}
          fillOpacity={shape.light ? 0.14 : 0.18}
        />
      ))}
      <circle
        cx={spec.shapes[1].cx}
        cy={spec.shapes[1].cy}
        r={spec.shapes[1].r}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
      <text
        x="48"
        y="57"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fill="#ffffff"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.5"
      >
        {mono.toUpperCase()}
      </text>
    </svg>
  )
}
