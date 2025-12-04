/**
 * Rate Limiting Hook
 *
 * Prevents abuse of trade operations by limiting the frequency of actions.
 * Uses a sliding window approach with configurable limits.
 */

import { useRef, useCallback } from 'react';

interface RateLimitConfig {
  /** Maximum number of actions allowed in the window */
  maxActions: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional callback when rate limited */
  onRateLimited?: () => void;
}

interface RateLimitResult {
  /** Check if an action is allowed and record it if so */
  checkAndRecord: () => boolean;
  /** Check if an action would be allowed without recording */
  canPerform: () => boolean;
  /** Get remaining actions in current window */
  getRemainingActions: () => number;
  /** Get time until next action is allowed (ms) */
  getTimeUntilReset: () => number;
  /** Reset the rate limit (use sparingly) */
  reset: () => void;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxActions: 5,      // 5 trades
  windowMs: 60000,    // per minute
};

/**
 * Hook to rate limit user actions
 *
 * @example
 * const { checkAndRecord, canPerform } = useRateLimit({
 *   maxActions: 5,
 *   windowMs: 60000,
 *   onRateLimited: () => toast.error('Too many trades. Please wait.')
 * });
 *
 * const handleTrade = () => {
 *   if (!checkAndRecord()) return; // Rate limited
 *   // ... perform trade
 * };
 */
export function useRateLimit(config?: Partial<RateLimitConfig>): RateLimitResult {
  const { maxActions, windowMs, onRateLimited } = { ...DEFAULT_CONFIG, ...config };

  // Store timestamps of recent actions
  const actionsRef = useRef<number[]>([]);

  /**
   * Remove expired actions from the window
   */
  const cleanupExpired = useCallback(() => {
    const now = Date.now();
    const cutoff = now - windowMs;
    actionsRef.current = actionsRef.current.filter(ts => ts > cutoff);
  }, [windowMs]);

  /**
   * Check if an action is allowed and record it
   */
  const checkAndRecord = useCallback((): boolean => {
    cleanupExpired();

    if (actionsRef.current.length >= maxActions) {
      onRateLimited?.();
      return false;
    }

    actionsRef.current.push(Date.now());
    return true;
  }, [maxActions, cleanupExpired, onRateLimited]);

  /**
   * Check if an action would be allowed (without recording)
   */
  const canPerform = useCallback((): boolean => {
    cleanupExpired();
    return actionsRef.current.length < maxActions;
  }, [maxActions, cleanupExpired]);

  /**
   * Get remaining actions in current window
   */
  const getRemainingActions = useCallback((): number => {
    cleanupExpired();
    return Math.max(0, maxActions - actionsRef.current.length);
  }, [maxActions, cleanupExpired]);

  /**
   * Get time until rate limit resets (oldest action expires)
   */
  const getTimeUntilReset = useCallback((): number => {
    cleanupExpired();

    if (actionsRef.current.length === 0) {
      return 0;
    }

    const oldestAction = actionsRef.current[0];
    const resetTime = oldestAction + windowMs;
    return Math.max(0, resetTime - Date.now());
  }, [windowMs, cleanupExpired]);

  /**
   * Reset the rate limit
   */
  const reset = useCallback(() => {
    actionsRef.current = [];
  }, []);

  return {
    checkAndRecord,
    canPerform,
    getRemainingActions,
    getTimeUntilReset,
    reset,
  };
}

/**
 * Default rate limit configurations for different operations
 */
export const RATE_LIMIT_CONFIGS = {
  /** Trading operations - 5 per minute */
  trade: {
    maxActions: 5,
    windowMs: 60000,
  },
  /** Token creation - 3 per hour */
  createToken: {
    maxActions: 3,
    windowMs: 3600000,
  },
  /** API calls - 30 per minute */
  apiCall: {
    maxActions: 30,
    windowMs: 60000,
  },
} as const;

export default useRateLimit;
