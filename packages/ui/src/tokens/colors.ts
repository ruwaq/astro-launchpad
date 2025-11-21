/**
 * Astro Shiba Design System - Color Tokens
 *
 * Primary Brand Colors:
 * - Orange (#fa9427): Main brand color, CTAs, highlights
 * - Blue (#247bca): Trust, navigation, primary actions
 * - Green (#144722): Success states, positive feedback
 * - Neutral (#c5c5c4): Text, borders, backgrounds
 */

export const colors = {
  // Brand Colors
  brand: {
    primary: {
      DEFAULT: '#fa9427',      // 🟧 Main brand orange
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#fa9427',          // Main
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },

    blue: {
      DEFAULT: '#247bca',      // 🔵 Trust blue
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#247bca',          // Main
      600: '#1d64a6',
      700: '#1e40af',
      800: '#1e3a8a',
      900: '#1e3a8a',
    },

    green: {
      DEFAULT: '#144722',      // 🟢 Success green
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#144722',          // Main
    },

    neutral: {
      DEFAULT: '#c5c5c4',      // ⚪ Neutral gray
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#c5c5c4',          // Main
      500: '#a3a3a3',
      600: '#737373',
      700: '#525252',
      800: '#404040',
      900: '#262626',
    },
  },

  // Semantic Colors
  semantic: {
    success: '#144722',
    warning: '#fa9427',
    error: '#ef4444',
    info: '#247bca',
  },

  // UI Colors
  ui: {
    background: '#ffffff',
    surface: '#fafafa',
    border: '#e5e5e5',

    text: {
      primary: '#1a1a1a',
      secondary: '#6b7280',
      tertiary: '#c5c5c4',
      inverse: '#ffffff',
    },

    overlay: 'rgba(0, 0, 0, 0.5)',
  },
} as const;

export type ColorToken = typeof colors;
