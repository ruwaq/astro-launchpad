# Graduation Notification System

This module provides a comprehensive notification system for token graduation events in the Astro Launchpad application.

## Overview

When a token reaches the $69k market cap threshold, it "graduates" from the bonding curve to the AstroSwap DEX with locked liquidity. This is a major milestone that deserves a celebration!

## Features

- **Eye-catching celebration toast** with green/gold gradient styling
- **Confetti animations** using canvas-confetti library
- **Haptic feedback** on mobile devices
- **Actionable CTA button** to trade on AstroSwap DEX
- **Auto-dismiss** after 10 seconds
- **Sound effects** (when enabled via useTradingSounds hook)
- **Prevents duplicate toasts** using unique IDs

## Usage

### Basic Graduation Toast

```typescript
import { showGraduationToast } from '@/lib/notifications/graduationToast';

// Show when a token graduates
showGraduationToast({
  tokenSymbol: 'SHIBA',
  tokenName: 'Shiba Token',
  ammPairAddress: 'CXXX...', // Optional AMM pair address
  onCtaClick: () => {
    // Custom action when user clicks "Trade on AstroSwap DEX"
    window.location.href = '/trade';
  },
});
```

### Simple Graduation Notification

```typescript
import { showGraduationNotification } from '@/lib/notifications/graduationToast';

// Simpler notification (fallback for lower priority contexts)
showGraduationNotification('SHIBA');
```

### Near Graduation Warning

```typescript
import { showNearGraduationWarning } from '@/lib/notifications/graduationToast';

// Alert users that their trade will trigger graduation
showNearGraduationWarning('SHIBA', 5.25); // 5.25 XLM remaining
```

## Integration Points

### 1. TradingWidgetPremium

The trading widget automatically detects graduation after successful trades:

```typescript
// In handleTrade() success handler
const wasPreGraduation = tradingMode === 'bonding';

// After reloading token info
if (wasPreGraduation && tradingMode === 'amm' && ammContext) {
  showGraduationToast({
    tokenSymbol,
    tokenName,
    ammPairAddress: ammContext.ammPairAddress,
  });
}
```

### 2. Token Detail Page

Background polling detects graduation events:

```typescript
// Track previous graduation status
const previousGraduationStatusRef = useRef<boolean | null>(null);

// In fetchToken() callback
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
}
```

### 3. WebSocket Events (Future)

Can be triggered by real-time graduation events:

```typescript
// In WebSocket message handler
socket.on('token:graduated', (data) => {
  showGraduationToast({
    tokenSymbol: data.symbol,
    tokenName: data.name,
    ammPairAddress: data.ammPairAddress,
  });
});
```

## Styling

The graduation toast uses a custom gradient design:

- **Background**: Gradient from emerald-500 → green-500 → teal-500
- **Icon**: 🎓 graduation cap emoji in white circle
- **Text**: White text with drop shadow for readability
- **CTA Button**: White background with emerald-600 text
- **Shadow**: Large shadow (shadow-2xl) for prominence

## Animations

### Confetti

Two confetti bursts are triggered:

1. **Initial burst**: 150 particles, wide spread (120°), green/gold colors
2. **Secondary burst**: 80 particles after 500ms, smaller spread (80°)

### Toast Animations

- **Enter**: Slide in from right with scale effect (0.3s ease-out)
- **Leave**: Slide out to right with scale effect (0.2s ease-in)

CSS animations are defined in `globals.css`:

```css
@keyframes toast-enter {
  0% {
    transform: translateX(100%) scale(0.95);
    opacity: 0;
  }
  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
}
```

### Haptic Feedback

Mobile devices receive a celebration pattern:

```typescript
navigator.vibrate([10, 20, 10, 20, 10, 50, 100]);
```

## Dependencies

- **react-hot-toast**: Toast notification library
- **canvas-confetti**: Confetti animations
- **lucide-react**: Icons (if needed for future enhancements)

## Accessibility

- **ARIA labels**: Close button has `aria-label="Dismiss"`
- **Keyboard navigation**: Toast can be dismissed with keyboard
- **Motion preferences**: Respects `prefers-reduced-motion` (animations disabled)
- **Color contrast**: White text on green background meets WCAG AA standards
- **Focus management**: CTA button is focusable and keyboard accessible

## Configuration

### Toast Duration

Default: 10 seconds (10000ms)

```typescript
toast.custom(component, {
  duration: 10000, // Adjust as needed
});
```

### Confetti Customization

Modify particle count, spread, colors, etc.:

```typescript
confetti({
  particleCount: 150, // Number of particles
  spread: 120, // Spread angle in degrees
  origin: { y: 0.5 }, // Origin point (0-1)
  colors: ['#10b981', '#f59e0b', '#fbbf24'], // Custom colors
  scalar: 1.2, // Size multiplier
  ticks: 200, // Duration (higher = longer)
});
```

## Testing

### Manual Testing

1. Create a token close to graduation threshold
2. Execute a buy trade that triggers graduation
3. Verify toast appears with confetti
4. Test CTA button navigation
5. Test dismiss button

### Automated Testing

```typescript
import { showGraduationToast } from '@/lib/notifications/graduationToast';

describe('Graduation Toast', () => {
  it('should display graduation notification', () => {
    showGraduationToast({
      tokenSymbol: 'TEST',
      tokenName: 'Test Token',
    });

    expect(screen.getByText('Token Graduated!')).toBeInTheDocument();
    expect(screen.getByText(/TEST/)).toBeInTheDocument();
  });
});
```

## Future Enhancements

- [ ] WebSocket integration for real-time graduation events
- [ ] Sound effects when audio files are added
- [ ] Social sharing button ("Share graduation on Twitter")
- [ ] Graduation leaderboard link
- [ ] Custom graduation badges/achievements
- [ ] Animated SVG icons instead of emoji
- [ ] Multiple language support
- [ ] Graduation statistics in toast

## Troubleshooting

### Toast not appearing

1. Check that `react-hot-toast` Toaster is in providers
2. Verify token status changed from 'Bonding' to 'Graduated'
3. Check browser console for errors
4. Ensure `hasShownGraduationToastRef` is not blocking

### Confetti not showing

1. Verify `canvas-confetti` is installed
2. Check browser canvas support
3. Look for CSP (Content Security Policy) issues

### Haptic feedback not working

1. Only works on mobile devices with vibration support
2. User may have disabled vibration in device settings
3. Check browser vibration API support

## License

MIT
