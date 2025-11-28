/**
 * Tests for usePageVisibility Hook
 *
 * Tests the page visibility detection and visibility-aware polling functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageVisibility, useVisibilityAwarePolling } from '@/hooks/usePageVisibility';

describe('usePageVisibility', () => {
  let visibilityState: string;
  let visibilityListeners: Array<() => void> = [];

  beforeEach(() => {
    visibilityState = 'visible';
    visibilityListeners = [];

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'visibilitychange') {
        visibilityListeners.push(handler as () => void);
      }
    });

    vi.spyOn(document, 'removeEventListener').mockImplementation((event, handler) => {
      if (event === 'visibilitychange') {
        visibilityListeners = visibilityListeners.filter((h) => h !== handler);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const triggerVisibilityChange = (state: 'visible' | 'hidden') => {
    visibilityState = state;
    visibilityListeners.forEach((listener) => listener());
  };

  it('should return true when page is visible', () => {
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);
  });

  it('should return false when page is hidden', () => {
    visibilityState = 'hidden';
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(false);
  });

  it('should update when visibility changes to hidden', () => {
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);

    act(() => {
      triggerVisibilityChange('hidden');
    });

    expect(result.current).toBe(false);
  });

  it('should update when visibility changes to visible', () => {
    visibilityState = 'hidden';
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(false);

    act(() => {
      triggerVisibilityChange('visible');
    });

    expect(result.current).toBe(true);
  });

  it('should add event listener on mount', () => {
    renderHook(() => usePageVisibility());
    expect(document.addEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
  });

  it('should remove event listener on unmount', () => {
    const { unmount } = renderHook(() => usePageVisibility());
    unmount();
    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
  });
});

describe('useVisibilityAwarePolling', () => {
  let visibilityState: string;
  let visibilityListeners: Array<() => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    visibilityState = 'visible';
    visibilityListeners = [];

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'visibilitychange') {
        visibilityListeners.push(handler as () => void);
      }
    });

    vi.spyOn(document, 'removeEventListener').mockImplementation((event, handler) => {
      if (event === 'visibilitychange') {
        visibilityListeners = visibilityListeners.filter((h) => h !== handler);
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const triggerVisibilityChange = (state: 'visible' | 'hidden') => {
    visibilityState = state;
    visibilityListeners.forEach((listener) => listener());
  };

  it('should call callback immediately when immediate is true', () => {
    const callback = vi.fn();
    renderHook(() =>
      useVisibilityAwarePolling(callback, 1000, { immediate: true })
    );

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback immediately when immediate is false', () => {
    const callback = vi.fn();
    renderHook(() =>
      useVisibilityAwarePolling(callback, 1000, { immediate: false })
    );

    expect(callback).not.toHaveBeenCalled();
  });

  it('should call callback on interval', () => {
    const callback = vi.fn();
    renderHook(() =>
      useVisibilityAwarePolling(callback, 1000, { immediate: false })
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should stop polling when page becomes hidden', () => {
    const callback = vi.fn();
    const { rerender } = renderHook(() =>
      useVisibilityAwarePolling(callback, 1000, { immediate: false })
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      triggerVisibilityChange('hidden');
    });
    rerender();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should still be 1 - no more calls while hidden
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should resume polling when page becomes visible', () => {
    visibilityState = 'hidden';
    const callback = vi.fn();
    const { rerender } = renderHook(() =>
      useVisibilityAwarePolling(callback, 1000, { immediate: false })
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      triggerVisibilityChange('visible');
    });
    rerender();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not poll when enabled is false', () => {
    const callback = vi.fn();
    renderHook(() =>
      useVisibilityAwarePolling(callback, 1000, {
        enabled: false,
        immediate: false,
      })
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should continue polling in background when backgroundPolling is true', () => {
    const callback = vi.fn();
    const { rerender } = renderHook(() =>
      useVisibilityAwarePolling(callback, 1000, {
        immediate: false,
        backgroundPolling: true,
        backgroundMultiplier: 4,
      })
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      triggerVisibilityChange('hidden');
    });
    rerender();

    // Background interval is 4x (4000ms)
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should return isPolling state', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useVisibilityAwarePolling(callback, 1000, { enabled: true })
    );

    expect(result.current.isPolling).toBe(true);
  });

  it('should return isVisible state', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useVisibilityAwarePolling(callback, 1000)
    );

    expect(result.current.isVisible).toBe(true);
  });
});
