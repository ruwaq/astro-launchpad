/** XLM nativo: 7 decimales (stroops). */
export const XLM_DECIMALS = 7

/** Reserva mínima que dejamos al usar MAX en una compra. */
export const XLM_FEE_BUFFER = 10_000_000n

/**
 * Balance nativo (XLM) de una cuenta desde Horizon. Se usa para mostrar el
 * saldo disponible antes de comprar un token con XLM.
 */
export async function fetchXlmBalance(publicKey: string): Promise<number> {
  const response = await fetch(
    `https://horizon-testnet.stellar.org/accounts/${encodeURIComponent(publicKey)}`,
  )
  if (!response.ok) return 0
  const data = (await response.json()) as {
    balances?: Array<{ asset_type?: string; balance?: string }>
  }
  const native = data.balances?.find(
    (balance) => balance.asset_type === 'native',
  )
  return native?.balance ? Number(native.balance) : 0
}

/**
 * Convierte un balance XLM de Horizon (number) a stroops. Los saldos de una
 * cuenta de testnet están muy por debajo de `MAX_SAFE_INTEGER`, así que no hay
 * pérdida práctica; para montos de usuario usamos siempre bigint.
 */
export function xlmToStroops(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n
  return BigInt(Math.floor(value * 10 ** XLM_DECIMALS))
}
