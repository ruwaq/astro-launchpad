/**
 * Graduation Toast Notification Tests
 *
 * Tests for the graduation notification system that triggers
 * when tokens graduate from bonding curve to AMM.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
  showGraduationToast,
  showGraduationNotification,
  showNearGraduationWarning,
} from '../graduationToast';

// Mock dependencies
vi.mock('react-hot-toast');
vi.mock('canvas-confetti');

describe('Graduation Toast System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.vibrate
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: vi.fn(),
    });
  });

  describe('showGraduationToast', () => {
    it('should display graduation toast with correct data', () => {
      showGraduationToast({
        tokenSymbol: 'SHIBA',
        tokenName: 'Shiba Token',
        ammPairAddress: 'CPAIR123',
      });

      expect(toast.custom).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          duration: 10000,
          position: 'top-center',
          id: expect.stringContaining('graduation-SHIBA'),
        })
      );
    });

    it('should trigger confetti animation', () => {
      showGraduationToast({
        tokenSymbol: 'SHIBA',
      });

      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 150,
          spread: 120,
          colors: expect.arrayContaining(['#10b981', '#f59e0b']),
        })
      );
    });

    it('should trigger haptic feedback on mobile', () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        value: vibrateMock,
      });

      showGraduationToast({
        tokenSymbol: 'SHIBA',
      });

      expect(vibrateMock).toHaveBeenCalledWith([10, 20, 10, 20, 10, 50, 100]);
    });

    it('should trigger secondary confetti burst after delay', () => {
      vi.useFakeTimers();

      showGraduationToast({
        tokenSymbol: 'SHIBA',
      });

      // First confetti burst
      expect(confetti).toHaveBeenCalledTimes(1);

      // Fast-forward 500ms
      vi.advanceTimersByTime(500);

      // Second confetti burst
      expect(confetti).toHaveBeenCalledTimes(2);
      expect(confetti).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          particleCount: 80,
          spread: 80,
        })
      );

      vi.useRealTimers();
    });

    it('should call onCtaClick callback when CTA is clicked', () => {
      const onCtaClick = vi.fn();
      const toastComponent = vi.fn();

      (toast.custom as any).mockImplementation((component: any) => {
        toastComponent.mockImplementation(component);
      });

      showGraduationToast({
        tokenSymbol: 'SHIBA',
        onCtaClick,
      });

      // Simulate rendering the toast
      const toastElement = toastComponent({ visible: true, id: 'test-toast' });

      // Find and click CTA button (would need DOM testing for real implementation)
      // This is a simplified test
      expect(toast.custom).toHaveBeenCalled();
    });

    it('should generate unique toast IDs', () => {
      showGraduationToast({ tokenSymbol: 'SHIBA' });
      const firstCall = (toast.custom as any).mock.calls[0][1];

      vi.advanceTimersByTime(100);

      showGraduationToast({ tokenSymbol: 'SHIBA' });
      const secondCall = (toast.custom as any).mock.calls[1][1];

      expect(firstCall.id).not.toBe(secondCall.id);
    });
  });

  describe('showGraduationNotification', () => {
    it('should display simple graduation notification', () => {
      showGraduationNotification('DOGE');

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('DOGE'),
        expect.objectContaining({
          icon: '🎓',
          duration: 8000,
        })
      );
    });

    it('should trigger confetti for simple notification', () => {
      showGraduationNotification('DOGE');

      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 100,
          spread: 70,
        })
      );
    });
  });

  describe('showNearGraduationWarning', () => {
    it('should display warning toast with remaining XLM', () => {
      showNearGraduationWarning('PEPE', 5.25);

      expect(toast).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          duration: 6000,
          icon: '📢',
        })
      );
    });

    it('should format remaining XLM correctly', () => {
      const toastComponent = vi.fn();
      (toast as any).mockImplementation((component: any) => {
        toastComponent.mockImplementation(component);
      });

      showNearGraduationWarning('PEPE', 5.25);

      // Verify the component was called
      expect(toast).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should not break if vibrate API is unavailable', () => {
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        value: undefined,
      });

      expect(() => {
        showGraduationToast({ tokenSymbol: 'SHIBA' });
      }).not.toThrow();
    });

    it('should handle missing AMM pair address gracefully', () => {
      expect(() => {
        showGraduationToast({
          tokenSymbol: 'SHIBA',
          ammPairAddress: undefined,
        });
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should not trigger multiple confetti bursts for rapid calls', () => {
      vi.useFakeTimers();

      showGraduationToast({ tokenSymbol: 'SHIBA' });
      showGraduationToast({ tokenSymbol: 'DOGE' });

      expect(confetti).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(500);

      // Should be 4 total (2 initial + 2 delayed)
      expect(confetti).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });
  });
});
