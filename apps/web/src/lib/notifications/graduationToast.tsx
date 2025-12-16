/**
 * Graduation Toast Notification System
 *
 * Provides eye-catching celebration toasts when a token graduates from
 * the bonding curve to the AMM DEX with locked liquidity.
 *
 * Features:
 * - Confetti animation integration
 * - Celebration styling (green/gold gradient)
 * - Actionable CTA to trade on DEX
 * - Auto-dismiss after 10 seconds
 * - Haptic feedback on mobile
 * - Sound effects (when enabled)
 */

'use client';

import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface GraduationToastOptions {
  tokenSymbol: string;
  tokenName?: string;
  ammPairAddress?: string;
  onCtaClick?: () => void;
}

/**
 * Show a celebration toast when a token graduates to the AMM
 *
 * @param options - Graduation notification options
 * @param options.tokenSymbol - Token symbol (e.g., "SHIBA")
 * @param options.tokenName - Optional full token name
 * @param options.ammPairAddress - Optional AMM pair address for linking
 * @param options.onCtaClick - Optional callback when CTA is clicked
 */
export function showGraduationToast({
  tokenSymbol,
  tokenName,
  ammPairAddress,
  onCtaClick,
}: GraduationToastOptions): void {
  // Trigger confetti celebration
  confetti({
    particleCount: 150,
    spread: 120,
    origin: { y: 0.5 },
    colors: ['#10b981', '#f59e0b', '#fbbf24', '#34d399', '#a7f3d0'],
    scalar: 1.2,
    ticks: 200,
  });

  // Haptic feedback on mobile
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([10, 20, 10, 20, 10, 50, 100]);
  }

  // Show custom toast with celebration styling
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}
        style={{
          animation: t.visible
            ? 'toast-enter 0.3s ease-out'
            : 'toast-leave 0.2s ease-in',
        }}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            {/* Celebration Icon */}
            <div className="flex-shrink-0 pt-0.5">
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-3xl">🎓</span>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-lg font-bold text-white drop-shadow-sm">
                Token Graduated!
              </p>
              <p className="mt-1 text-sm text-white/90">
                {tokenName || tokenSymbol} reached $69k market cap and is now
                trading on AstroSwap DEX with locked liquidity!
              </p>
              {/* CTA Button */}
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  if (onCtaClick) {
                    onCtaClick();
                  } else if (ammPairAddress) {
                    // Default: open DEX pair in new tab
                    window.open(
                      `https://astroswap.io/pair/${ammPairAddress}`,
                      '_blank'
                    );
                  }
                }}
                className="mt-3 px-4 py-2 bg-white text-emerald-600 font-semibold rounded-lg hover:bg-emerald-50 transition-colors shadow-md flex items-center gap-2 text-sm"
              >
                <span>🚀</span>
                Trade on AstroSwap DEX
              </button>
            </div>
          </div>
        </div>
        {/* Close button */}
        <div className="flex border-l border-white/20">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-white hover:bg-white/10 focus:outline-none transition-colors"
            aria-label="Dismiss"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    ),
    {
      duration: 10000, // 10 seconds
      position: 'top-center',
      id: `graduation-${tokenSymbol}-${Date.now()}`, // Unique ID to prevent duplicates
    }
  );

  // Additional confetti burst after 500ms for extra celebration
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#f59e0b', '#10b981'],
      scalar: 0.8,
    });
  }, 500);
}

/**
 * Show a simpler graduation notification (fallback for lower priority contexts)
 */
export function showGraduationNotification(tokenSymbol: string): void {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#10b981', '#f59e0b', '#34d399'],
  });

  toast.success(
    `${tokenSymbol} graduated to AstroSwap DEX! Now trading with locked liquidity.`,
    {
      icon: '🎓',
      duration: 8000,
      style: {
        background: 'linear-gradient(to right, #10b981, #059669)',
        color: '#fff',
        fontWeight: '600',
        padding: '16px 24px',
        borderRadius: '12px',
      },
    }
  );
}

/**
 * Show a "near graduation" warning toast
 * Alerts users that their trade will trigger graduation
 */
export function showNearGraduationWarning(
  tokenSymbol: string,
  remainingXlm: number
): void {
  toast(
    (t) => (
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <p className="font-semibold text-gray-900">
            Graduation Imminent!
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {tokenSymbol} needs only {remainingXlm.toFixed(2)} XLM more to graduate
            to the AMM. Your trade may trigger it!
          </p>
        </div>
      </div>
    ),
    {
      duration: 6000,
      icon: '📢',
      style: {
        background: '#fef3c7',
        border: '1px solid #fbbf24',
        borderRadius: '12px',
        padding: '16px',
      },
    }
  );
}
