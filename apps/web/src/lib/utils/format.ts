/**
 * Formatting utilities
 * Centralized formatting functions for consistent display
 */

/**
 * Format a Stellar address for display (truncated)
 * @param address - Full Stellar address (56 chars)
 * @param startChars - Number of characters to show at start (default: 4)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Formatted address like "GABC...WXYZ"
 */
export function formatAddress(
  address: string | null | undefined,
  startChars = 4,
  endChars = 4
): string {
  if (!address) return '';
  if (address.length <= startChars + endChars + 3) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// Note: For IPFS URL conversion, use getIpfsUrl from '@/lib/utils/ipfs'

/**
 * Format a number with locale-aware separators
 * @param value - Number or string to format
 * @param options - Intl.NumberFormat options
 * @returns Formatted number string
 */
export function formatNumber(
  value: number | string | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';

  return num.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    ...options,
  });
}

/**
 * Format XLM amount with proper decimals
 * @param stroops - Amount in stroops (1 XLM = 10^7 stroops)
 * @returns Formatted XLM string
 */
export function formatXLM(stroops: bigint | number | string): string {
  const value = typeof stroops === 'bigint'
    ? Number(stroops) / 10_000_000
    : Number(stroops) / 10_000_000;
  return formatNumber(value, { maximumFractionDigits: 7 });
}

/**
 * Format percentage with optional sign
 * @param value - Percentage value (e.g., 5.5 for 5.5%)
 * @param showSign - Whether to show + sign for positive values
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number | null | undefined,
  showSign = false
): string {
  if (value === null || value === undefined) return '0%';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)}%`;
}

/**
 * Format a date relative to now
 * @param date - Date to format
 * @returns Relative time string like "2 hours ago"
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

// ============================================
// Input Sanitization Utilities (XSS Prevention)
// ============================================

/**
 * Sanitize numeric input for trading amounts
 * Only allows digits, decimal point, and optional leading minus
 * Prevents XSS by stripping all non-numeric characters
 * @param input - Raw user input
 * @param options - Sanitization options
 * @returns Sanitized numeric string
 */
export function sanitizeNumericInput(
  input: string,
  options: {
    allowNegative?: boolean;
    maxDecimals?: number;
    maxLength?: number;
  } = {}
): string {
  const { allowNegative = false, maxDecimals = 7, maxLength = 20 } = options;

  // Remove all non-numeric characters except decimal point and minus
  let sanitized = input.replace(/[^\d.-]/g, '');

  // Handle negative sign
  if (!allowNegative) {
    sanitized = sanitized.replace(/-/g, '');
  } else {
    // Keep only leading minus
    const hasLeadingMinus = sanitized.startsWith('-');
    sanitized = sanitized.replace(/-/g, '');
    if (hasLeadingMinus) {
      sanitized = '-' + sanitized;
    }
  }

  // Handle multiple decimal points - keep only first
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }

  // Limit decimal places
  if (parts.length === 2 && parts[1].length > maxDecimals) {
    sanitized = parts[0] + '.' + parts[1].slice(0, maxDecimals);
  }

  // Limit total length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize text input to prevent XSS
 * Escapes HTML special characters
 * @param input - Raw user input
 * @returns Sanitized text safe for display
 */
export function sanitizeTextInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parse and validate a numeric input safely
 * @param input - User input string
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed number or fallback
 */
export function safeParseFloat(
  input: string | null | undefined,
  fallback = 0
): number {
  if (!input) return fallback;
  const sanitized = sanitizeNumericInput(input);
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? fallback : parsed;
}
