/**
 * Nonce Store - Prevents Replay Attacks
 *
 * Tracks used nonces within the signature validity window (30 seconds).
 * Each nonce can only be used once to prevent replay attacks.
 *
 * Implementation: In-memory Map with automatic TTL cleanup.
 * For production at scale, consider Redis-based implementation.
 */

// SECURITY: Nonce TTL must match SIGNATURE_MAX_AGE_MS in context.ts
const NONCE_TTL_MS = 30 * 1000; // 30 seconds

// Cleanup interval for expired nonces
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

// Store: nonce -> timestamp when it was used
const usedNonces = new Map<string, number>();

// Cleanup timer reference
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Start the nonce cleanup timer
 * Called automatically on first nonce check
 */
function startCleanupTimer(): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [nonce, usedAt] of usedNonces) {
      if (now - usedAt > NONCE_TTL_MS) {
        usedNonces.delete(nonce);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[NonceStore] Cleaned ${cleaned} expired nonces, ${usedNonces.size} remaining`);
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't keep process alive just for cleanup
  cleanupTimer.unref();
}

/**
 * Check if a nonce has already been used
 * @param nonce - The nonce to check
 * @returns true if nonce is valid (not used), false if already used
 */
export function checkAndUseNonce(nonce: string): { valid: boolean; error?: string } {
  // Start cleanup timer on first use
  startCleanupTimer();

  // Validate nonce format
  if (!nonce || nonce.length < 8) {
    return { valid: false, error: 'Nonce too short (minimum 8 characters)' };
  }

  if (nonce.length > 64) {
    return { valid: false, error: 'Nonce too long (maximum 64 characters)' };
  }

  // Check if nonce was already used
  if (usedNonces.has(nonce)) {
    return { valid: false, error: 'Nonce already used (possible replay attack)' };
  }

  // Mark nonce as used
  usedNonces.set(nonce, Date.now());

  return { valid: true };
}

/**
 * Get current nonce store stats (for monitoring)
 */
export function getNonceStoreStats(): { activeNonces: number; oldestNonceAgeMs: number | null } {
  const now = Date.now();
  let oldestAge: number | null = null;

  for (const usedAt of usedNonces.values()) {
    const age = now - usedAt;
    if (oldestAge === null || age > oldestAge) {
      oldestAge = age;
    }
  }

  return {
    activeNonces: usedNonces.size,
    oldestNonceAgeMs: oldestAge,
  };
}

/**
 * Clear all nonces (for testing)
 */
export function clearNonceStore(): void {
  usedNonces.clear();
}

/**
 * Stop the cleanup timer (for graceful shutdown)
 */
export function stopNonceCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
