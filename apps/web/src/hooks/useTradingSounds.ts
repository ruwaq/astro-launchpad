/**
 * Trading Sounds Hook
 *
 * Provides audio feedback for trading actions.
 * Currently disabled - sounds will be enabled when audio files are added.
 *
 * To enable sounds:
 * 1. Add MP3 files to /public/sounds/ directory
 * 2. Set SOUNDS_ENABLED to true
 *
 * Sound files needed:
 * - /public/sounds/buy.mp3 - Success sound for buy transactions
 * - /public/sounds/sell.mp3 - Success sound for sell transactions
 * - /public/sounds/notification.mp3 - Soft ping for new events
 * - /public/sounds/milestone.mp3 - Celebration sound for achievements (graduation)
 * - /public/sounds/error.mp3 - Error feedback
 * - /public/sounds/click.mp3 - UI interaction feedback
 * - /public/sounds/whoosh.mp3 - Transition sound
 */

'use client';

import { useCallback } from 'react';

// Feature flag - sounds disabled until audio files are added
const SOUNDS_ENABLED = false;

interface UseTradingSoundsOptions {
  volume?: number;
  enabled?: boolean;
}

export function useTradingSounds(_options: UseTradingSoundsOptions = {}) {
  // No-op functions until sound files are added
  // This prevents 404 errors from the use-sound library trying to load missing files

  const noop = useCallback(() => {
    // Sound playback disabled - enable when audio files are available
  }, []);

  return {
    playBuy: noop,       // Success sound for buy transactions
    playSell: noop,      // Success sound for sell transactions
    playNotification: noop, // Soft ping for new events
    playMilestone: noop, // Celebration sound for achievements
    playError: noop,     // Error feedback
    playClick: noop,     // UI interaction feedback
    playWhoosh: noop,    // Transition sound
  };
}

// Hook for haptic feedback on mobile
export function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return {
    lightTap: () => vibrate(10),
    mediumTap: () => vibrate(20),
    success: () => vibrate([10, 50, 10]),
    error: () => vibrate([50, 30, 50]),
    celebration: () => vibrate([10, 20, 10, 20, 10, 50, 100]),
  };
}
