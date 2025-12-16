/**
 * Graduation Toast System - Usage Examples
 *
 * This file demonstrates how to use the graduation notification system
 * in different parts of the application.
 */

'use client';

import { useState } from 'react';
import {
  showGraduationToast,
  showGraduationNotification,
  showNearGraduationWarning,
} from './graduationToast';

export function GraduationToastExamples() {
  const [tokenSymbol] = useState('SHIBA');

  return (
    <div className="p-8 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Graduation Toast Examples</h1>

      {/* Example 1: Full Graduation Toast */}
      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-xl font-semibold">1. Full Graduation Toast</h2>
        <p className="text-sm text-gray-600">
          Complete celebration toast with confetti, CTA, and all features
        </p>
        <button
          onClick={() => {
            showGraduationToast({
              tokenSymbol: 'SHIBA',
              tokenName: 'Shiba Token',
              ammPairAddress: 'CPAIR123ABC',
              onCtaClick: () => {
                console.log('User clicked CTA - navigating to DEX');
                alert('Would navigate to DEX pair page');
              },
            });
          }}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
        >
          Show Full Graduation Toast
        </button>
      </section>

      {/* Example 2: Simple Notification */}
      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-xl font-semibold">2. Simple Graduation Notification</h2>
        <p className="text-sm text-gray-600">
          Simpler toast for background/non-critical contexts
        </p>
        <button
          onClick={() => {
            showGraduationNotification('DOGE');
          }}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Show Simple Notification
        </button>
      </section>

      {/* Example 3: Near Graduation Warning */}
      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-xl font-semibold">3. Near Graduation Warning</h2>
        <p className="text-sm text-gray-600">
          Alert users their trade may trigger graduation
        </p>
        <button
          onClick={() => {
            showNearGraduationWarning('PEPE', 5.25);
          }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
        >
          Show Warning (5.25 XLM remaining)
        </button>
      </section>

      {/* Example 4: Trading Widget Integration */}
      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-xl font-semibold">4. Trading Widget Integration</h2>
        <p className="text-sm text-gray-600 mb-2">
          Detect graduation after successful trade
        </p>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
          {`// In TradingWidgetPremium handleTrade() success
const wasPreGraduation = tradingMode === 'bonding';

setTimeout(async () => {
  await loadTokenInfo();

  if (wasPreGraduation && ammContext) {
    showGraduationToast({
      tokenSymbol,
      tokenName,
      ammPairAddress: ammContext.ammPairAddress,
    });
  }
}, 2000);`}
        </pre>
      </section>

      {/* Example 5: Token Page Integration */}
      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-xl font-semibold">5. Token Page Polling Detection</h2>
        <p className="text-sm text-gray-600 mb-2">
          Detect graduation via background polling
        </p>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
          {`// In token page fetchToken callback
const previousGraduationStatusRef = useRef<boolean | null>(null);

if (
  !isInitialFetch &&
  previousGraduationStatusRef.current === false &&
  isGraduated &&
  !hasShownGraduationToastRef.current
) {
  showGraduationToast({
    tokenSymbol: token.symbol,
    tokenName: token.name,
    ammPairAddress: ammPairAddress || undefined,
  });

  hasShownGraduationToastRef.current = true;
}

previousGraduationStatusRef.current = isGraduated;`}
        </pre>
      </section>

      {/* Example 6: WebSocket Integration (Future) */}
      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-xl font-semibold">6. WebSocket Integration (Future)</h2>
        <p className="text-sm text-gray-600 mb-2">
          Real-time graduation events
        </p>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
          {`// In WebSocket message handler
socket.on('token:graduated', (data) => {
  showGraduationToast({
    tokenSymbol: data.symbol,
    tokenName: data.name,
    ammPairAddress: data.ammPairAddress,
    onCtaClick: () => {
      // Navigate to token page or DEX
      router.push(\`/t/\${data.address}\`);
    },
  });
});`}
        </pre>
      </section>

      {/* Example 7: Custom CTA Actions */}
      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-xl font-semibold">7. Custom CTA Actions</h2>
        <p className="text-sm text-gray-600">
          Different actions for different contexts
        </p>
        <div className="space-y-2">
          <button
            onClick={() => {
              showGraduationToast({
                tokenSymbol: 'SHIBA',
                onCtaClick: () => {
                  // Refresh page to show AMM interface
                  window.location.reload();
                },
              });
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Graduation with Page Reload
          </button>

          <button
            onClick={() => {
              showGraduationToast({
                tokenSymbol: 'SHIBA',
                ammPairAddress: 'CPAIR123',
                onCtaClick: () => {
                  // Open DEX in new tab
                  window.open(
                    'https://astroswap.io/pair/CPAIR123',
                    '_blank'
                  );
                },
              });
            }}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 ml-2"
          >
            Graduation with New Tab
          </button>
        </div>
      </section>

      {/* Example 8: Multiple Graduations */}
      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-xl font-semibold">8. Multiple Graduations</h2>
        <p className="text-sm text-gray-600">
          Handle multiple tokens graduating simultaneously
        </p>
        <button
          onClick={() => {
            const tokens = ['SHIBA', 'DOGE', 'PEPE'];

            tokens.forEach((symbol, index) => {
              setTimeout(() => {
                showGraduationToast({
                  tokenSymbol: symbol,
                  tokenName: `${symbol} Token`,
                });
              }, index * 2000); // Stagger by 2 seconds
            });
          }}
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
        >
          Simulate 3 Graduations
        </button>
      </section>

      {/* Notes */}
      <section className="border-t pt-4 mt-6">
        <h2 className="text-lg font-semibold mb-2">Implementation Notes</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Confetti automatically triggers on all graduation toasts</li>
          <li>Haptic feedback works on mobile devices with vibration support</li>
          <li>Toast auto-dismisses after 10 seconds (configurable)</li>
          <li>Each toast has unique ID to prevent duplicates</li>
          <li>Secondary confetti burst occurs after 500ms</li>
          <li>Respects prefers-reduced-motion for accessibility</li>
          <li>Sound effects available when audio files are added</li>
        </ul>
      </section>
    </div>
  );
}

/**
 * Example: Graduation detection in trading context
 */
export function useGraduationDetection() {
  const [previousTradingMode, setPreviousTradingMode] = useState<string | null>(null);

  const checkForGraduation = (
    currentMode: string,
    tokenSymbol: string,
    tokenName?: string,
    ammPairAddress?: string
  ) => {
    if (previousTradingMode === 'bonding' && currentMode === 'amm') {
      // Graduation detected!
      showGraduationToast({
        tokenSymbol,
        tokenName,
        ammPairAddress,
        onCtaClick: () => {
          window.location.reload();
        },
      });
    }

    setPreviousTradingMode(currentMode);
  };

  return { checkForGraduation };
}

/**
 * Example: Pre-trade graduation warning
 */
export function useGraduationWarning(
  tokenSymbol: string,
  xlmRaised: number,
  graduationThreshold: number
) {
  const showWarningIfNeeded = (tradeAmount: number) => {
    const remaining = graduationThreshold - xlmRaised;

    // If trade would trigger graduation
    if (tradeAmount >= remaining && remaining > 0) {
      showNearGraduationWarning(tokenSymbol, remaining);
      return true;
    }

    // If very close to graduation (< 10% remaining)
    if (remaining < graduationThreshold * 0.1 && remaining > 0) {
      showNearGraduationWarning(tokenSymbol, remaining);
      return true;
    }

    return false;
  };

  return { showWarningIfNeeded };
}
