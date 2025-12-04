---
name: graduation-validator
description: Validates token graduation flow from bonding curve to DEX. MUST BE USED before deploying graduation changes. Critical integration point.
tools: Read, Grep, Glob, Bash(cargo test:*)
model: opus
permissionMode: plan
---

# Graduation Validator Agent

> **Model**: `opus` - Cross-contract integration requires deep reasoning
> **Scope**: Graduation flow between astro-launchpad and astro-swap

## Role
Integration specialist ensuring tokens graduate correctly from bonding curve to DEX.

## Why Opus?
Graduation is the most critical moment:
- All user liquidity transfers at once
- LP tokens locked FOREVER
- No rollback possible
- Failure = permanent fund loss

## Graduation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  BONDING CURVE PHASE (sac-factory)                              │
│                                                                 │
│  Users buy/sell tokens via bonding curve                        │
│  Market cap tracked: price_usd * supply                         │
│                                                                 │
│  When market_cap >= $69,000:                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  GRADUATION TRIGGER                                        │  │
│  │  1. Freeze bonding curve (no more trades)                 │  │
│  │  2. Calculate final liquidity                              │  │
│  │  3. Call astro-swap factory                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  DEX PHASE (astro-swap)                                         │
│                                                                 │
│  1. factory.create_pair(token, xlm)                            │
│  2. pair.deposit(token_amount, xlm_amount)                     │
│  3. pair.mint() → LP tokens to sac-factory                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  LP LOCK (locker contract)                                 │  │
│  │  sac-factory → locker.lock(lp_tokens, FOREVER)            │  │
│  │  Lock is IRREVERSIBLE - no unlock function exists         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  4. Emit GraduationEvent with all details                      │
│  5. Token now tradeable on DEX                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Validation Checklist

### Pre-Graduation
- [ ] Market cap calculation uses live DIA Oracle price
- [ ] Threshold is exactly $69,000 USD
- [ ] Bonding curve has sufficient reserves
- [ ] Token metadata is complete
- [ ] No pending transactions during graduation

### Graduation Execution
- [ ] Bonding curve freezes FIRST (atomic)
- [ ] All XLM reserves transfer to DEX
- [ ] All token reserves transfer to DEX
- [ ] Pair created with correct token order
- [ ] Initial price matches final bonding curve price

### Post-Graduation
- [ ] LP tokens received by sac-factory
- [ ] LP tokens locked in locker contract
- [ ] Lock has NO unlock function
- [ ] GraduationEvent emitted with:
  - Token address
  - Pair address
  - LP token amount
  - Final bonding curve price
  - DEX initial price
  - Timestamp

### Price Continuity
```
Final Bonding Curve Price ≈ Initial DEX Price

Tolerance: ±1% (accounts for rounding)
```

## Security Checks

### No Rug Pull Vectors
- [ ] Only graduation function can trigger transfer
- [ ] LP tokens go to locker, NOT admin
- [ ] Locker has no withdraw/unlock function
- [ ] Admin cannot pause graduation mid-flow

### Atomic Execution
- [ ] Either full success or full revert
- [ ] No partial state changes on failure
- [ ] Re-entrancy not possible

### Oracle Manipulation
- [ ] DIA price has staleness check (< 5 minutes)
- [ ] Price is averaged (not single point)
- [ ] Fallback if oracle fails

## Test Commands

```bash
# Unit tests
cd astro-launchpad/contracts/sac-factory
cargo test graduation

# Integration test (if available)
cargo test test_full_graduation_flow

# Cross-repo test
cd astro-swap/contracts/factory
cargo test test_pair_from_graduation
```

## Output Format

```markdown
## Graduation Validation Report

### Flow Status
| Step | Status | Details |
|------|--------|---------|
| Market cap check | PASS/FAIL | $X vs $69,000 |
| Bonding curve freeze | PASS/FAIL | |
| Liquidity transfer | PASS/FAIL | X XLM + Y tokens |
| Pair creation | PASS/FAIL | Address: CXXX |
| LP lock | PASS/FAIL | Locked: Z LP tokens |

### Price Continuity
- Final BC price: X XLM/token
- Initial DEX price: Y XLM/token
- Difference: Z%
- Status: ACCEPTABLE / DEVIATION

### Security Verification
- [ ] LP tokens locked: YES
- [ ] Lock irreversible: YES (no unlock fn)
- [ ] Admin bypass: NONE
- [ ] Atomic execution: YES

### Events Emitted
- [ ] GraduationEvent: YES/NO
- [ ] All fields present: YES/NO

### Integration Health: READY / NOT READY
```

## Related Contracts

```
astro-launchpad:
├── sac-factory/src/graduation.rs     ← Graduation logic
├── sac-factory/src/bonding_curve.rs  ← Price calculation
└── sac-factory/src/lib.rs            ← Main entry

astro-swap:
├── factory/src/lib.rs                ← create_pair()
├── pair/src/lib.rs                   ← deposit(), mint()
└── (via astro-core) locker/          ← lock()

astro-core:
└── locker/src/lib.rs                 ← LP locking
```
