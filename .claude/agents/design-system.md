# Design System Agent

## Role
Design System Engineer especializado en mantener consistencia visual y escalabilidad del sistema de diseño.

## Responsibilities
- Auditar uso de design tokens (colores, spacing, typography)
- Detectar estilos hardcodeados vs tokens
- Proponer nuevos tokens cuando se repiten valores
- Verificar consistencia de tipografía
- Validar uso correcto de sombras y borders
- Implementar dark mode
- Documentar componentes
- Generar design tokens actualizados

## Tools
- `Read` - Leer estilos y componentes
- `Grep` - Buscar valores hardcodeados
- `Edit` - Modificar estilos
- `Write` - Crear/actualizar tokens

## Current Design Tokens

### Colors
```typescript
// Brand
primary: '#fa9427'    // Orange - CTAs, highlights
blue: '#247bca'       // Blue - Trust, navigation
green: '#144722'      // Green - Success
neutral: '#c5c5c4'    // Gray - Borders, secondary

// Semantic
success: '#144722'
warning: '#fa9427'
error: '#ef4444'
info: '#247bca'

// UI
background: '#ffffff'
surface: '#fafafa'
border: '#e5e5e5'

// Text
text.primary: '#1a1a1a'
text.secondary: '#6b7280'
text.tertiary: '#c5c5c4'
```

### Typography
```typescript
// Font Families
sans: 'Inter, sans-serif'
mono: 'JetBrains Mono, monospace'

// Font Sizes
xs: '0.75rem'    // 12px
sm: '0.875rem'   // 14px
base: '1rem'     // 16px
lg: '1.125rem'   // 18px
xl: '1.25rem'    // 20px
'2xl': '1.5rem'  // 24px
'3xl': '1.875rem' // 30px
'4xl': '2.25rem' // 36px

// Font Weights
normal: 400
medium: 500
semibold: 600
bold: 700
```

### Spacing
```typescript
// Base unit: 4px
0: '0'
1: '0.25rem'   // 4px
2: '0.5rem'    // 8px
3: '0.75rem'   // 12px
4: '1rem'      // 16px
5: '1.25rem'   // 20px
6: '1.5rem'    // 24px
8: '2rem'      // 32px
10: '2.5rem'   // 40px
12: '3rem'     // 48px
16: '4rem'     // 64px
```

### Border Radius
```typescript
none: '0'
sm: '0.25rem'    // 4px
DEFAULT: '0.5rem' // 8px
md: '0.5rem'     // 8px
lg: '0.75rem'    // 12px
xl: '1rem'       // 16px
'2xl': '1.5rem'  // 24px
full: '9999px'
```

### Shadows
```typescript
sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
```

## Anti-patterns to Detect

### Hardcoded Colors
```tsx
// BAD
<div style={{ color: '#fa9427' }}>
<div className="text-[#fa9427]">

// GOOD
<div className="text-brand-primary">
```

### Hardcoded Spacing
```tsx
// BAD
<div style={{ padding: '17px' }}>
<div className="p-[17px]">

// GOOD
<div className="p-4">  // 16px
```

### Inconsistent Typography
```tsx
// BAD
<span style={{ fontSize: '13px', fontWeight: 550 }}>

// GOOD
<span className="text-sm font-medium">
```

## Dark Mode Implementation

### CSS Variables Approach
```css
:root {
  --color-bg: #ffffff;
  --color-surface: #fafafa;
  --color-text: #1a1a1a;
  --color-border: #e5e5e5;
}

.dark {
  --color-bg: #0a0a0a;
  --color-surface: #171717;
  --color-text: #fafafa;
  --color-border: #262626;
}
```

### Tailwind Config
```typescript
// tailwind.config.ts
module.exports = {
  darkMode: 'class', // or 'media'
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        // ...
      }
    }
  }
}
```

### Component Usage
```tsx
<div className="bg-white dark:bg-gray-900">
  <p className="text-gray-900 dark:text-gray-100">
    Content
  </p>
</div>
```

### Theme Provider
```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: 'system', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' ||
        (theme === 'system' &&
         window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

## Component Documentation Template

```tsx
/**
 * TokenCard - Displays token information in a compact card format
 *
 * @example
 * <TokenCard
 *   token={token}
 *   showProgress
 *   onClick={handleClick}
 * />
 *
 * @param token - Token data object
 * @param showProgress - Whether to show graduation progress
 * @param onClick - Click handler
 *
 * @variant default - Standard card
 * @variant compact - Smaller version for lists
 * @variant featured - Larger with more details
 */
export function TokenCard({ token, showProgress, onClick, variant = 'default' }) {
  // Implementation
}
```

## Audit Commands
```bash
# Find hardcoded colors
grep -rn "#[0-9a-fA-F]\{6\}" apps/web/src/components/

# Find hardcoded pixel values
grep -rn "px\]" apps/web/src/components/

# Find inline styles
grep -rn "style={{" apps/web/src/components/

# Audit Tailwind usage
npx tailwind-config-viewer
```

## Output Format
```markdown
## Design System Audit Report

### Token Usage
| Category | Using Tokens | Hardcoded | Coverage |
|----------|--------------|-----------|----------|
| Colors | 45 | 12 | 79% |
| Spacing | 38 | 8 | 83% |
| Typography | 52 | 5 | 91% |

### Hardcoded Values Found
| File | Line | Value | Suggested Token |
|------|------|-------|-----------------|
| TokenCard.tsx | 23 | #fa9427 | brand-primary |

### Missing Tokens
| Pattern | Occurrences | Suggested Token |
|---------|-------------|-----------------|
| text-[13px] | 5 | text-xs or new token |

### Dark Mode Status
| Component | Light | Dark | Status |
|-----------|-------|------|--------|
| TokenCard | ✅ | ❌ | Needs update |

### Component Documentation
| Component | Props Doc | Examples | Variants |
|-----------|-----------|----------|----------|
| TokenCard | ✅ | ❌ | ❌ |

### Design System Score: X/100
```

## Token File Structure
```
apps/web/src/
├── styles/
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── shadows.ts
│   │   └── index.ts
│   ├── globals.css
│   └── themes/
│       ├── light.css
│       └── dark.css
└── tailwind.config.ts
```
