/** Formatea un amount on-chain (base units) a decimal legible. */
export function formatAmount(amount: bigint, decimals: number): string {
  if (decimals <= 0) return amount.toString()
  const base = 10n ** BigInt(decimals)
  const whole = amount / base
  const fraction = (amount % base)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : `${whole}`
}

/** Convierte un valor decimal legible a base units (i128). */
export function parseAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  const [whole = '0', fraction = ''] = trimmed.split('.')
  const padded = fraction.padEnd(decimals, '0').slice(0, decimals)
  const base = 10n ** BigInt(decimals)
  return BigInt(whole || '0') * base + BigInt(padded || '0')
}

/** Recorta una dirección para mostrarla: GABC…WXYZ */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Mensaje legible de un error cualquiera (wallet, red, contrato). */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Error desconocido'
}
