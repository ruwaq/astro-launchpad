/**
 * Client-side Rate Limiter
 *
 * Prevents API abuse by throttling requests from the client.
 * Uses a sliding window algorithm for smooth rate limiting.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RequestRecord {
  timestamps: number[];
}

const requestRecords: Map<string, RequestRecord> = new Map();

// Rate limit configurations per endpoint type
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Trading operations - stricter limits
  trade: { maxRequests: 10, windowMs: 60_000 }, // 10 per minute
  // Price queries - more lenient
  price: { maxRequests: 60, windowMs: 60_000 }, // 60 per minute
  // Token creation - very strict
  create: { maxRequests: 3, windowMs: 300_000 }, // 3 per 5 minutes
  // Default for other operations
  default: { maxRequests: 30, windowMs: 60_000 }, // 30 per minute
};

/**
 * Check if a request should be rate limited
 * @param key - Unique identifier for the rate limit bucket (e.g., 'trade', 'price')
 * @returns true if request should be allowed, false if rate limited
 */
export function checkRateLimit(key: string): boolean {
  const config = RATE_LIMITS[key] || RATE_LIMITS.default;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create record for this key
  let record = requestRecords.get(key);
  if (!record) {
    record = { timestamps: [] };
    requestRecords.set(key, record);
  }

  // Remove timestamps outside the window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  // Check if we're at the limit
  if (record.timestamps.length >= config.maxRequests) {
    return false;
  }

  // Add current timestamp
  record.timestamps.push(now);
  return true;
}

/**
 * Get remaining requests in the current window
 */
export function getRemainingRequests(key: string): number {
  const config = RATE_LIMITS[key] || RATE_LIMITS.default;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const record = requestRecords.get(key);
  if (!record) return config.maxRequests;

  const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);
  return Math.max(0, config.maxRequests - validTimestamps.length);
}

/**
 * Get time until rate limit resets (in ms)
 */
export function getResetTime(key: string): number {
  const config = RATE_LIMITS[key] || RATE_LIMITS.default;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const record = requestRecords.get(key);
  if (!record || record.timestamps.length === 0) return 0;

  const oldestInWindow = record.timestamps.find((ts) => ts > windowStart);
  if (!oldestInWindow) return 0;

  return Math.max(0, oldestInWindow + config.windowMs - now);
}

/**
 * Rate limited fetch wrapper
 * Throws RateLimitError if rate limited
 */
export class RateLimitError extends Error {
  constructor(
    public key: string,
    public resetMs: number
  ) {
    super(`Rate limit exceeded for ${key}. Try again in ${Math.ceil(resetMs / 1000)}s`);
    this.name = 'RateLimitError';
  }
}

/**
 * Wrapper for rate-limited operations
 */
export async function withRateLimit<T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  if (!checkRateLimit(key)) {
    throw new RateLimitError(key, getResetTime(key));
  }
  return operation();
}

/**
 * Hook-friendly rate limit check
 */
export function useRateLimitCheck(key: string): {
  canProceed: boolean;
  remaining: number;
  resetMs: number;
} {
  return {
    canProceed: checkRateLimit(key),
    remaining: getRemainingRequests(key),
    resetMs: getResetTime(key),
  };
}
