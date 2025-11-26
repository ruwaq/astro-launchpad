# /ui-refactor - Refactorización de UI

Ejecuta un análisis y refactorización de la arquitectura de componentes UI.

## Agentes Involucrados

Ejecutar secuencialmente:

### 1. UI Architect Agent
- Analizar estructura de componentes
- Detectar:
  - Componentes God (>300 líneas)
  - Prop drilling
  - Hooks mal usados
  - Re-renders innecesarios
- Proponer:
  - Extracción de componentes
  - Compound components
  - Custom hooks

### 2. Design System Agent
- Auditar uso de tokens
- Detectar valores hardcodeados
- Verificar consistencia

### 3. Animation Wizard Agent
- Proponer animaciones para mejorar UX
- Implementar micro-interactions

## Análisis de Componentes

### Estructura Actual
```
components/
├── layout/          # Navbar, Sidebar, DashboardLayout
├── charts/          # BondingCurveChart, AreaChart
├── trading/         # TradingInterface, RecentTrades
├── widgets/         # TradingWidget, TokensWidget, MetricCard
├── token/           # TokenCard, TokenHeader, GraduationProgress
├── auth/            # PasskeyAuth
├── search/          # GlobalSearch
└── transactions/    # TransactionHistory
```

### Métricas a Evaluar
- Líneas por componente (target: <200)
- Props por componente (target: <10)
- Hooks por componente (target: <5)
- Nivel de anidación (target: <3)

## Refactoring Patterns

### Extract Component
```tsx
// BEFORE: Large component
function TokenPage() {
  // 50 lines of trading logic
  // 30 lines of chart logic
  // 100 lines of JSX
}

// AFTER: Extracted components
function TokenPage() {
  return (
    <TokenPageLayout>
      <TokenHeader />
      <TokenChart />
      <TradingSection />
    </TokenPageLayout>
  );
}
```

### Custom Hook Extraction
```tsx
// BEFORE: Logic in component
function TradingWidget() {
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  // 30 lines of trading logic
}

// AFTER: Custom hook
function TradingWidget() {
  const trading = useTrading();
  // Clean component
}
```

### Compound Component
```tsx
// BEFORE: Many props
<TokenCard
  showImage
  showPrice
  showProgress
  showActions
  compact
/>

// AFTER: Compound
<TokenCard>
  <TokenCard.Image />
  <TokenCard.Price />
  <TokenCard.Progress />
</TokenCard>
```

## Output Esperado

```markdown
# 🔧 UI REFACTOR REPORT

## Component Analysis
| Component | Lines | Props | Issues | Priority |
|-----------|-------|-------|--------|----------|
| TradingWidget | 350 | 12 | God component | High |
| TokenCard | 120 | 8 | OK | - |

## Refactoring Plan

### High Priority
1. **Split TradingWidget**
   - Extract `useTradingLogic` hook
   - Create `TokenSelector` component
   - Create `AmountInput` component

### Medium Priority
2. **TokenCard → Compound Component**
   - TokenCard.Image
   - TokenCard.Info
   - TokenCard.Price
   - TokenCard.Progress

### Low Priority
3. **Design Token Cleanup**
   - Replace 12 hardcoded colors
   - Standardize spacing

## Estimated Impact
- Bundle size: -X KB
- Re-renders: -X%
- Maintainability: +X%

## Files to Modify
1. `components/widgets/TradingWidget.tsx`
2. `components/token/TokenCard.tsx`
3. `hooks/useTrading.ts` (new)
```

## Commands
```bash
# Analyze bundle impact
ANALYZE=true pnpm build

# Check for unused exports
npx ts-prune

# Find large files
find apps/web/src/components -name "*.tsx" -exec wc -l {} + | sort -n
```
