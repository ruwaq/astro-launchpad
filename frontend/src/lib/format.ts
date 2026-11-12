/** Formats an on-chain amount (base units) to readable decimal. Handles negative amounts cleanly. */
export function formatAmount(amount: bigint, decimals: number): string {
  if (decimals <= 0) return amount.toString()
  const isNegative = amount < 0n
  const abs = isNegative ? -amount : amount
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const fraction = (abs % base)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')
  const formatted = fraction ? `${whole}.${fraction}` : `${whole}`
  return isNegative ? `-${formatted}` : formatted
}

/** Converts a readable decimal string to base units (i128). Tolerates dots, commas, and thousands separators. */
export function parseAmount(value: string, decimals: number): bigint {
  const trimmed = normalizeDecimalString(value)
  if (!trimmed || !/^\d*(\.\d*)?$/.test(trimmed)) return 0n

  const safeDecimals = Math.max(0, Math.trunc(decimals))
  const [whole = '0', fraction = ''] = trimmed.split('.')
  const padded = fraction.padEnd(safeDecimals, '0').slice(0, safeDecimals)
  try {
    const base = 10n ** BigInt(safeDecimals)
    return BigInt(whole || '0') * base + BigInt(padded || '0')
  } catch {
    return 0n
  }
}

/** Normalizes localized decimal inputs with commas, dots, and thousands separators. */
function normalizeDecimalString(val: string): string {
  let s = val.trim()
  if (!s) return ''
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
      // e.g. 1,234.56 -> 1234.56
      s = s.replaceAll(',', '')
    } else {
      // e.g. 1.234,56 -> 1234.56
      s = s.replaceAll('.', '').replace(',', '.')
    }
  } else if (hasComma) {
    const commaCount = (s.match(/,/g) || []).length
    if (commaCount > 1 || /^\d{1,3}(,\d{3})+$/.test(s)) {
      // e.g. 1,000,000 or 1,000 -> 1000000 or 1000
      s = s.replaceAll(',', '')
    } else {
      // Single comma decimal e.g. 10,5 -> 10.5
      s = s.replace(',', '.')
    }
  } else if (hasDot) {
    const dotCount = (s.match(/\./g) || []).length
    if (dotCount > 1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      // e.g. 1.000.000 -> 1000000
      s = s.replaceAll('.', '')
    }
  }
  return s
}

/** Shortens a public key or hash for display: GABC…WXYZ */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Extracts a human-readable message from errors (wallet, RPC, contract). */
export function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null
  if (!raw) return 'Unknown error'

  const lower = raw.toLowerCase()
  if (
    lower.includes('user declined') ||
    lower.includes('user rejected') ||
    lower.includes('rejected by user') ||
    lower.includes('cancelled by user')
  ) {
    return 'Transaction cancelled in wallet.'
  }
  if (
    raw.includes('Error(Contract, #100)') ||
    lower.includes('insufficientbalance') ||
    lower.includes('insufficient balance')
  ) {
    return 'Insufficient balance to complete transaction.'
  }
  if (
    raw.includes('Error(Auth, InvalidAction)') ||
    lower.includes('unauthorized')
  ) {
    return 'Authorization denied by contract (check active account or permissions).'
  }
  if (
    lower.includes('insufficient output amount') ||
    lower.includes('insufficientoutputamount')
  ) {
    return 'Price moved beyond your allowed slippage. Increase slippage tolerance or reduce amount.'
  }
  if (
    lower.includes('insufficient liquidity') ||
    lower.includes('insufficientliquidity')
  ) {
    return 'Insufficient liquidity in the pool for this transaction.'
  }
  if (
    lower.includes('insufficient a amount') ||
    lower.includes('insufficient b amount') ||
    lower.includes('insufficientaamount') ||
    lower.includes('insufficientbamount') ||
    raw.includes('Error(Contract, #302)') ||
    raw.includes('Error(Contract, #303)')
  ) {
    return 'Token and XLM ratio does not match pool reserves. Enable "Maintain pool ratio" and try again.'
  }
  if (
    raw.includes('Error(Contract, #1)') ||
    lower.includes('notinitialized') ||
    lower.includes('not initialized')
  ) {
    return 'Launchpad contract is not initialized on this network.'
  }
  if (
    raw.includes('Error(Contract, #2)') ||
    lower.includes('invalidamount') ||
    lower.includes('invalid amount')
  ) {
    return 'Invalid amount: check minimum XLM LP (1 XLM), supply, or burn shout amount.'
  }
  if (
    raw.includes('Error(Contract, #3)') ||
    lower.includes('pairalreadyseeded') ||
    lower.includes('pair already exists')
  ) {
    return 'Soroswap pair already exists with non-zero liquidity. Tokens cannot be launched over existing pairs.'
  }
  if (
    raw.includes('Error(Contract, #4)') ||
    lower.includes('invalidmetadata') ||
    lower.includes('invalid metadata')
  ) {
    return 'Invalid metadata: name/symbol must be 1–32 bytes, message 1–160 bytes, and off-chain metadata ≤ 512 bytes.'
  }
  if (lower.includes('expired') || lower.includes('deadline')) {
    return 'Transaction timed out (deadline expired). Please try again.'
  }
  if (lower.includes('txbadseq') || lower.includes('tx_bad_seq')) {
    return 'Account sequence currently in use by another pending transaction. Wait 5 seconds and retry.'
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('429') ||
    lower.includes('too many requests')
  ) {
    return 'Testnet RPC node is overloaded or unreachable. Please try again in a few seconds.'
  }
  return raw
}

/**
 * Ensures an external web link begins strictly with http:// or https://.
 * Rejects javascript:, data:, vbscript:, etc. to prevent XSS.
 */
export function sanitizeHttpUrl(url?: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      // Reject userinfo (username / password) to defeat credential-spoofing phishing attacks
      // (e.g. https://astrogate.io@malicious-drainer.xyz)
      if (parsed.username || parsed.password) {
        return null
      }
      return parsed.href
    }
    return null
  } catch {
    // If it's a domain like "example.com", prepend https://
    if (/^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`
    }
    return null
  }
}

/**
 * Sanitizes a Telegram link or handle into a safe https://t.me/... link.
 */
export function sanitizeTelegramUrl(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('https://t.me/') || trimmed.startsWith('http://t.me/')) {
    return sanitizeHttpUrl(trimmed)
  }
  if (trimmed.includes(':') || trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('(')) {
    return null
  }
  const clean = trimmed.replace(/^@/, '')
  if (/^[a-zA-Z0-9_]{1,64}$/.test(clean)) {
    return `https://t.me/${clean}`
  }
  return null
}

/**
 * Sanitizes a Twitter / X link or handle into a safe https://x.com/... link.
 */
export function sanitizeTwitterUrl(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (
    trimmed.startsWith('https://x.com/') ||
    trimmed.startsWith('https://twitter.com/') ||
    trimmed.startsWith('http://x.com/') ||
    trimmed.startsWith('http://twitter.com/')
  ) {
    return sanitizeHttpUrl(trimmed)
  }
  if (trimmed.includes(':') || trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('(')) {
    return null
  }
  const clean = trimmed.replace(/^@/, '')
  if (/^[a-zA-Z0-9_]{1,64}$/.test(clean)) {
    return `https://x.com/${clean}`
  }
  return null
}
