/**
 * Page Visibility Hook
 *
 * PERFORMANCE: Detects when the browser tab is visible/hidden
 * Use this to pause polling when the tab is not visible
 * This saves bandwidth and reduces API load significantly
 *
 * Usage:
 * const isVisible = usePageVisibility();
 * useEffect(() => {
 *   if (isVisible) startPolling();
 *   else stopPolling();
 * }, [isVisible]);
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that returns whether the page is currently visible
 * Uses the Page Visibility API
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // SSR check
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    // Set initial state
    setIsVisible(document.visibilityState === 'visible');

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Hook for visibility-aware polling
 * Automatically pauses polling when tab is not visible
 *
 * @param callback - Function to call on each poll
 * @param interval - Polling interval in ms (when visible)
 * @param options - Additional options
 * @returns Control functions { startPolling, stopPolling, isPolling }
 */
export function useVisibilityAwarePolling(
  callback: () => void | Promise<void>,
  interval: number,
  options: {
    /** Whether polling is enabled. Default: true */
    enabled?: boolean;
    /** Run callback immediately on mount. Default: true */
    immediate?: boolean;
    /** Continue polling in background (reduced rate). Default: false */
    backgroundPolling?: boolean;
    /** Background polling interval multiplier. Default: 4x */
    backgroundMultiplier?: number;
  } = {}
) {
  const {
    enabled = true,
    immediate = true,
    backgroundPolling = false,
    backgroundMultiplier = 4,
  } = options;

  const isVisible = usePageVisibility();
  const [isPolling, setIsPolling] = useState(false);

  // Determine effective interval based on visibility
  const effectiveInterval = isVisible
    ? interval
    : backgroundPolling
    ? interval * backgroundMultiplier
    : null;

  useEffect(() => {
    if (!enabled) {
      setIsPolling(false);
      return;
    }

    // If not visible and no background polling, pause
    if (!isVisible && !backgroundPolling) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    // Run immediately if requested
    if (immediate && isVisible) {
      callback();
    }

    // Set up interval
    if (effectiveInterval) {
      const intervalId = setInterval(() => {
        callback();
      }, effectiveInterval);

      return () => clearInterval(intervalId);
    }
  }, [callback, effectiveInterval, enabled, immediate, isVisible, backgroundPolling]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  return { isPolling, isVisible, startPolling, stopPolling };
}

export default usePageVisibility;
