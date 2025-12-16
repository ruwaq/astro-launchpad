/**
 * Shared Passkey Challenge Secret
 *
 * Centralized secret management for passkey challenge signing/verification.
 * This module ensures the same secret is used across options and verify routes.
 */

import crypto from 'crypto';

// Development-only: cryptographically secure random secret (generated once at module load)
// This is ephemeral and will change on every server restart - acceptable for dev only
const DEV_SECRET = crypto.randomBytes(32).toString('hex');

/**
 * Get the secret key for HMAC signing of passkey challenges.
 *
 * Security guarantees:
 * - Production: ALWAYS requires PASSKEY_CHALLENGE_SECRET env var (minimum 32 chars)
 * - Development: Uses ephemeral cryptographically secure random secret
 *
 * @throws Error in production if secret is missing or too short
 */
export function getSecretKey(): string {
  const secret = process.env.PASSKEY_CHALLENGE_SECRET;

  if (secret) {
    // Validate secret length (minimum 32 chars for security)
    if (secret.length < 32) {
      console.error('CRITICAL: PASSKEY_CHALLENGE_SECRET must be at least 32 characters');
      throw new Error('Server configuration error: secret too short');
    }
    return secret;
  }

  // In production, require the secret (checked at runtime, not build time)
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: PASSKEY_CHALLENGE_SECRET environment variable is required in production');
    throw new Error('Server configuration error');
  }

  // Development-only: use ephemeral cryptographically secure secret
  // Warning is only logged once per module load to avoid spam
  return DEV_SECRET;
}
