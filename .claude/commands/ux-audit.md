# /ux-audit - Auditoría de Experiencia de Usuario

Ejecuta una auditoría completa de UX enfocada en la experiencia del usuario.

## Agentes Involucrados

Ejecutar en paralelo:

### 1. UX Enhancer Agent
- Analizar flujos de usuario principales:
  - Create Token flow
  - Trading flow (buy/sell)
  - Portfolio view
  - Explore/Search
- Detectar puntos de fricción
- Revisar estados de loading/error/empty
- Evaluar feedback visual

### 2. Accessibility Guardian Agent
- Auditar WCAG 2.1 AA compliance
- Verificar navegación por teclado
- Revisar contraste de colores
- Validar ARIA labels

### 3. Animation Wizard Agent
- Evaluar estado actual de animaciones
- Identificar oportunidades de mejora
- Verificar performance de animaciones

## Flujos a Analizar

### Create Token Flow
```
/create → Form → Upload → Preview → Submit → Confirm → Success
```
Verificar:
- [ ] Validación en tiempo real
- [ ] Preview antes de submit
- [ ] Progress indicator
- [ ] Error recovery
- [ ] Success celebration

### Trading Flow
```
Token Page → Amount → Slippage → Confirm → Sign → Success
```
Verificar:
- [ ] Precio en tiempo real
- [ ] Slippage explicado
- [ ] Fee breakdown claro
- [ ] Transaction status
- [ ] Balance updates

### Portfolio Flow
```
/portfolio → Holdings → Created → History → Token Detail
```
Verificar:
- [ ] Empty state útil
- [ ] Loading skeletons
- [ ] Refresh mechanism
- [ ] Navigation clara

## Output Esperado

```markdown
# 🎨 UX AUDIT REPORT

## Overall Score: X/100

## Flow Analysis
| Flow | Steps | Friction | Score |
|------|-------|----------|-------|
| Create Token | 6 | 2 high | 75 |
| Trading | 5 | 1 medium | 85 |
| Portfolio | 4 | 0 | 95 |

## State Coverage
| Component | Loading | Error | Empty | Success |
|-----------|---------|-------|-------|---------|
| TokenList | ✅ | ❌ | ❌ | N/A |
| TradingWidget | ✅ | ✅ | N/A | ✅ |

## Accessibility Score: X/100
- Keyboard Navigation: X/100
- Screen Reader: X/100
- Color Contrast: X/100
- Focus Management: X/100

## Animation Status
- Current coverage: X%
- Performance issues: X
- Opportunities: X

## Top Issues
1. [Critical issue]
2. [High priority]
3. [Medium priority]

## Quick Wins
1. [Easy fix with high impact]
2. [Easy fix with high impact]

## Recommendations
1. [Detailed recommendation]
2. [Detailed recommendation]
```

## Files to Analyze
```
apps/web/src/
├── app/create/page.tsx
├── app/t/[address]/page.tsx
├── app/portfolio/page.tsx
├── app/explore/page.tsx
├── components/trading/
├── components/token/
└── components/widgets/
```
