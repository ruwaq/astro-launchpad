# /test-coverage - Análisis y Mejora de Cobertura de Tests

Analiza la cobertura actual y genera tests faltantes.

## Agente Involucrado

### Test Generator Agent
- Analizar cobertura actual
- Identificar código sin tests
- Generar tests unitarios
- Crear tests de integración
- Proponer tests E2E

## Targets de Cobertura

| Área | Target | Prioridad |
|------|--------|-----------|
| Hooks | 90% | Alta |
| Utils/Helpers | 100% | Alta |
| Backend Services | 90% | Alta |
| Backend Resolvers | 85% | Alta |
| Frontend Components | 70% | Media |
| Smart Contracts | 95% | Crítica |

## Análisis por Área

### Frontend Hooks
```
apps/web/src/hooks/
├── useToken.ts
├── useBalance.ts
├── usePrice.ts
└── useApi.ts
```

Tests requeridos:
- [ ] useToken - fetch, cache, refresh
- [ ] useBalance - loading, error, success
- [ ] usePrice - polling, direction change
- [ ] useApi - queries, mutations, error handling

### Frontend Components
```
apps/web/src/components/
├── trading/
├── token/
├── widgets/
└── layout/
```

Tests requeridos:
- [ ] TokenCard - render, loading, click
- [ ] TradingInterface - amount input, submit
- [ ] Navbar - wallet connect, disconnect

### Backend Services
```
backend/api-gateway-v2/src/
├── graphql/resolvers/
└── lib/
```

Tests requeridos:
- [ ] Token resolvers - CRUD operations
- [ ] Fee calculations - edge cases
- [ ] Cache service - hit, miss, invalidation

### Smart Contracts
```
contracts/sac-factory/src/
├── bonding_curve.rs
├── fee_management.rs
└── access_control.rs
```

Tests requeridos:
- [ ] Bonding curve - price calculations
- [ ] Fee system - correct percentages
- [ ] Access control - role validation
- [ ] Edge cases - zero amounts, max values

## Commands
```bash
# Run tests with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter @repo/web test

# Run contract tests
cd contracts/sac-factory && cargo test

# Generate coverage report
pnpm test:coverage -- --reporter=html
```

## Test Templates

### Hook Test
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useToken } from './useToken';

describe('useToken', () => {
  it('should fetch token data', async () => {
    const { result } = renderHook(() => useToken('CXXX...'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.token).toBeDefined();
    expect(result.current.token?.symbol).toBe('TEST');
  });

  it('should handle errors', async () => {
    const { result } = renderHook(() => useToken('invalid'));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

### Component Test
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenCard } from './TokenCard';

describe('TokenCard', () => {
  const mockToken = {
    address: 'CXXX...',
    name: 'Test Token',
    symbol: 'TEST',
    price: 1.5,
  };

  it('renders token info', () => {
    render(<TokenCard token={mockToken} />);

    expect(screen.getByText('Test Token')).toBeInTheDocument();
    expect(screen.getByText('TEST')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<TokenCard token={mockToken} onClick={onClick} />);

    fireEvent.click(screen.getByRole('article'));
    expect(onClick).toHaveBeenCalledWith(mockToken);
  });
});
```

### Contract Test
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_calculate_price() {
        let env = Env::default();

        let price = calculate_bonding_price(
            &env,
            1000_0000000,  // supply
            100_0000000,   // reserve
            10_0000000,    // amount
        );

        assert!(price > 0);
        assert_eq!(price, expected_price);
    }
}
```

## Output Esperado

```markdown
# 🧪 TEST COVERAGE REPORT

## Current Coverage
| Area | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| Hooks | 45% | 30% | 50% | 45% |
| Components | 20% | 15% | 25% | 20% |
| Services | 60% | 50% | 65% | 60% |
| Contracts | 75% | 70% | 80% | 75% |

## Gaps Identified
| File | Missing Tests | Priority |
|------|---------------|----------|
| useToken.ts | 5 | High |
| TradingWidget.tsx | 8 | High |
| fee-resolvers.ts | 3 | Medium |

## Tests Generated
| File | Tests Added | Coverage Δ |
|------|-------------|------------|
| useToken.test.ts | 5 | +45% |
| TokenCard.test.tsx | 4 | +30% |

## New Coverage
| Area | Before | After | Target |
|------|--------|-------|--------|
| Hooks | 45% | 90% | 90% ✅ |
| Components | 20% | 70% | 70% ✅ |

## Remaining Gaps
1. [File needing tests]
2. [File needing tests]

## Test Commands
\`\`\`bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage
\`\`\`
```
