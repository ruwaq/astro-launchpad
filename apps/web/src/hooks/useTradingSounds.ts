/**
 * Trading Sounds Hook
 *
 * Provides audio feedback for trading actions using use-sound library.
 * All sounds are optional and respect user preferences.
 * Falls back silently if sound files are not available.
 */

'use client';

import useSound from 'use-sound';
import { useCallback, useEffect, useState } from 'react';

// Sound file paths (relative to public folder)
// Using free sounds from mixkit.co or similar
const SOUNDS = {
  buy: '/sounds/buy-success.mp3',
  sell: '/sounds/sell-success.mp3',
  notification: '/sounds/notification.mp3',
  milestone: '/sounds/milestone.mp3',
  error: '/sounds/error.mp3',
  click: '/sounds/click.mp3',
  whoosh: '/sounds/whoosh.mp3',
} as const;

interface UseTradingSoundsOptions {
  volume?: number;
  enabled?: boolean;
}

export function useTradingSounds(options: UseTradingSoundsOptions = {}) {
  const { volume = 0.5, enabled = true } = options;

  // Initialize sounds with lazy loading
  const [playBuySound] = useSound(SOUNDS.buy, {
    volume: volume * 0.7,
    interrupt: true,
  });

  const [playSellSound] = useSound(SOUNDS.sell, {
    volume: volume * 0.6,
    interrupt: true,
  });

  const [playNotificationSound] = useSound(SOUNDS.notification, {
    volume: volume * 0.4,
    interrupt: false,
  });

  const [playMilestoneSound] = useSound(SOUNDS.milestone, {
    volume: volume * 0.8,
    interrupt: true,
  });

  const [playErrorSound] = useSound(SOUNDS.error, {
    volume: volume * 0.5,
    interrupt: true,
  });

  const [playClickSound] = useSound(SOUNDS.click, {
    volume: volume * 0.3,
    interrupt: true,
  });

  const [playWhooshSound] = useSound(SOUNDS.whoosh, {
    volume: volume * 0.4,
    interrupt: true,
  });

  // Wrapped functions that check if sounds are enabled
  const playBuy = useCallback(() => {
    if (enabled) playBuySound();
  }, [enabled, playBuySound]);

  const playSell = useCallback(() => {
    if (enabled) playSellSound();
  }, [enabled, playSellSound]);

  const playNotification = useCallback(() => {
    if (enabled) playNotificationSound();
  }, [enabled, playNotificationSound]);

  const playMilestone = useCallback(() => {
    if (enabled) playMilestoneSound();
  }, [enabled, playMilestoneSound]);

  const playError = useCallback(() => {
    if (enabled) playErrorSound();
  }, [enabled, playErrorSound]);

  const playClick = useCallback(() => {
    if (enabled) playClickSound();
  }, [enabled, playClickSound]);

  const playWhoosh = useCallback(() => {
    if (enabled) playWhooshSound();
  }, [enabled, playWhooshSound]);

  return {
    playBuy,       // Success sound for buy transactions
    playSell,      // Success sound for sell transactions
    playNotification, // Soft ping for new events
    playMilestone, // Celebration sound for achievements
    playError,     // Error feedback
    playClick,     // UI interaction feedback
    playWhoosh,    // Transition sound
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
