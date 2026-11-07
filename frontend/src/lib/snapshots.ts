/**
 * Historial local de reservas de un par token/XLM.
 *
 * El par de Soroswap no emite eventos `swap`, así que el RPC no permite
 * reconstruir el histórico. Mientras no haya un indexer, guardamos snapshots
 * en `localStorage` cuando la app consulta el pool. Es honesto: el gráfico
 * solo muestra lo que este navegador ha visto, no un histórico global.
 */
export type ReserveSnapshot = {
  /** Unix timestamp en milisegundos. */
  t: number
  /** Reserva de XLM en stroops, serializada como string (bigint seguro). */
  xlm: string
  /** Reserva del token en base units, serializada como string. */
  token: string
}

export type SnapshotHistory = Record<string, ReserveSnapshot[]>

/** Pulso mínimo de 5 minutos; 288 puntos cubren al menos 24 h de pulsos. */
export const SNAPSHOT_BUCKET_MS = 5 * 60_000
export const MAX_SNAPSHOTS_PER_TOKEN = 288
export const MAX_TRACKED_TOKENS = 30

const STORAGE_KEY = 'floodgate.reserve-history.v1'
const XLM_DECIMALS = 7

/**
 * Caché en memoria + suscriptores. `useSyncExternalStore` exige que
 * `getSnapshot` devuelva la misma referencia si no hay cambios; leer y parsear
 * localStorage en cada render rompería esa garantía.
 */
let cache: SnapshotHistory | null = null
const listeners = new Map<string, Set<() => void>>()
const EMPTY_SNAPSHOTS: ReserveSnapshot[] = []

function isSnapshot(value: unknown): value is ReserveSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const snapshot = value as Record<string, unknown>
  return (
    typeof snapshot.t === 'number' &&
    Number.isFinite(snapshot.t) &&
    typeof snapshot.xlm === 'string' &&
    typeof snapshot.token === 'string'
  )
}

/**
 * Añade un snapshot sin crecer sin límite. Los cambios de reservas se guardan
 * en cuanto se observan (para que un swap se vea en el gráfico); si no cambian,
 * basta un pulso cada bucket para dibujar una línea plana.
 */
export function appendSnapshot(
  history: ReserveSnapshot[],
  next: ReserveSnapshot,
  bucketMs = SNAPSHOT_BUCKET_MS,
  max = MAX_SNAPSHOTS_PER_TOKEN,
): ReserveSnapshot[] {
  const limit = Math.max(1, Math.trunc(max))
  if (history.length === 0) return [next].slice(-limit)

  const last = history[history.length - 1]
  if (!last || next.t < last.t) return history

  if (next.t - last.t < bucketMs) {
    const changed = next.xlm !== last.xlm || next.token !== last.token
    return changed ? [...history, next].slice(-limit) : history
  }

  return [...history, next].slice(-limit)
}

export type ChartPoint = {
  x: number
  y: number
  value: number
}

/**
 * Convierte valores en coordenadas SVG. Es pura para poder testear el gráfico
 * sin navegador y para reutilizarla si cambia el ancho del viewBox.
 */
export function toChartPoints(
  values: number[],
  width = 320,
  height = 120,
  padding = 12,
): { points: ChartPoint[]; min: number; max: number } {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return { points: [], min: 0, max: 0 }

  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min
  const innerWidth = Math.max(1, width - padding * 2)
  const innerHeight = Math.max(1, height - padding * 2)

  const points = finite.map((value, index) => {
    const ratio =
      finite.length === 1 ? 0.5 : index / Math.max(1, finite.length - 1)
    const normalized = span === 0 ? 0.5 : (value - min) / span
    return {
      x: padding + ratio * innerWidth,
      // SVG crece hacia abajo: invertimos el eje Y.
      y: padding + (1 - normalized) * innerHeight,
      value,
    }
  })

  return { points, min, max }
}

/** Precio spot en XLM a partir de una lectura de reservas. */
export function snapshotPrice(
  snapshot: ReserveSnapshot,
  decimals: number,
): number {
  const xlm = Number(snapshot.xlm)
  const token = Number(snapshot.token)
  if (!Number.isFinite(xlm) || !Number.isFinite(token) || token <= 0) return 0

  const safeDecimals = Math.max(0, Math.trunc(decimals))
  const tokenUnits = token / 10 ** safeDecimals
  if (tokenUnits <= 0) return 0
  return xlm / 10 ** XLM_DECIMALS / tokenUnits
}

/** Liquidez del lado XLM en unidades (no stroops), para el gráfico. */
export function snapshotLiquidity(snapshot: ReserveSnapshot): number {
  const xlm = Number(snapshot.xlm)
  return Number.isFinite(xlm) ? xlm / 10 ** XLM_DECIMALS : 0
}

export function loadHistory(): SnapshotHistory {
  if (typeof window === 'undefined') return {}
  if (cache !== null) return cache

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cache = {}
      return cache
    }
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      cache = {}
      return cache
    }

    const history: SnapshotHistory = {}
    for (const [tokenId, snapshots] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!tokenId.startsWith('C') || !Array.isArray(snapshots)) continue
      const valid = snapshots
        .filter(isSnapshot)
        .slice(-MAX_SNAPSHOTS_PER_TOKEN)
      if (valid.length > 0) history[tokenId] = valid
    }
    cache = history
    return cache
  } catch {
    cache = {}
    return cache
  }
}

function saveHistory(history: SnapshotHistory) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Modo privado o cuota llena: el gráfico sigue con lo que haya en memoria.
  }
}

export function getSnapshots(tokenId: string): ReserveSnapshot[] {
  return loadHistory()[tokenId] ?? EMPTY_SNAPSHOTS
}

/** Suscripción por token para `useSyncExternalStore`. */
export function subscribeSnapshots(
  tokenId: string,
  listener: () => void,
): () => void {
  let set = listeners.get(tokenId)
  if (!set) {
    set = new Set()
    listeners.set(tokenId, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
    if (set?.size === 0) listeners.delete(tokenId)
  }
}

function notify(tokenId: string) {
  const set = listeners.get(tokenId)
  if (!set) return
  for (const listener of set) listener()
}

/**
 * Registra una lectura del pool. Devuelve el historial resultante para que el
 * componente pueda pintarlo sin volver a leer localStorage.
 */
export function recordSnapshot(
  tokenId: string,
  reserveXlm: bigint,
  reserveToken: bigint,
  now = Date.now(),
): ReserveSnapshot[] {
  if (!tokenId.startsWith('C')) return []
  const history = loadHistory()
  const previous = history[tokenId] ?? []
  const next = appendSnapshot(previous, {
    t: now,
    xlm: reserveXlm.toString(),
    token: reserveToken.toString(),
  })
  // Sin cambios dentro del bucket no hace falta escribir ni notificar.
  if (next === previous) return next
  history[tokenId] = next

  // Limita también el número de tokens con historial (los más recientes).
  const kept = Object.entries(history)
    .sort((a, b) => {
      const lastA = a[1][a[1].length - 1]?.t ?? 0
      const lastB = b[1][b[1].length - 1]?.t ?? 0
      return lastB - lastA
    })
    .slice(0, MAX_TRACKED_TOKENS)

  saveHistory(Object.fromEntries(kept))
  cache = Object.fromEntries(kept)
  notify(tokenId)
  return next
}
