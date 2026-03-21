# Security Audit Application - Soroban Audit Bank

> **Project**: Astro Launchpad - SAC Factory Contract
> **Date**: 2026-03-19
> **Status**: Ready for Audit
> **Contact**: dev@astrolaunch.io

---

## Executive Summary

Astro Launchpad is a fair-launch token platform on Stellar Soroban, enabling anyone to create and trade tokens with automated liquidity via bonding curves. The SAC Factory contract is the core component managing token launches, trading, and graduation to DEX.

**Key Features**:
- 30-second token creation
- Bonding curve pricing (constant product AMM)
- Automatic graduation at $69k market cap
- Liquidity lock (LP tokens burned permanently)
- Anti-rug protection

**Request**: Professional security audit before mainnet deployment
**Budget**: $50k-100k (flexible based on scope)
**Timeline**: 4-6 weeks

---

## 1. Contract Overview

### Architecture

```
SAC Factory (Main Contract)
├── Token Creation (launch_token, launch_token_v2)
├── Trading Engine (buy, sell)
│   └── Bonding Curve (constant product: x * y = k)
├── Graduation System
│   ├── Market Cap Tracking
│   ├── Oracle Integration (DIA)
│   └── DEX Deployment (AstroSwap)
└── Access Control (RBAC)
```

### Core Functionality

#### 1. Token Launch
- **Function**: `launch_token()`, `launch_token_v2()`
- **Purpose**: Deploy SAC or pure Soroban tokens
- **Fee**: 10 XLM (anti-spam)
- **Validation**: Name, symbol, issuer, metadata

#### 2. Trading
- **Buy**: `buy(buyer, token, xlm_amount, min_tokens_out, deadline)`
- **Sell**: `sell(seller, token, token_amount, min_xlm_out, deadline)`
- **Fees**: 0.30% (0.05% protocol + 0.25% LP)
- **Slippage**: User-defined protection

#### 3. Graduation
- **Trigger**: $69k market cap (configurable)
- **Process**: Deploy AMM pair, transfer liquidity, burn LP tokens
- **Oracle**: DIA price feed for USD conversion
- **Bridge**: DEX bridge integration for cross-contract calls

### Dependencies

```toml
soroban-sdk = "25.2.0"
astro-core-shared = { git = "...", tag = "v1.5.0" }
```

**Shared Math Functions**:
- `apply_bps()` - Fee calculation
- `get_amount_out()` - AMM output calculation
- All math from audited `astro-core` library

---

## 2. Security Measures Implemented

### A. Soroban Best Practices 2026 ✅

#### 1. Storage Optimization
**Implementation**: `src/storage_optimization.rs`
- Check-before-write pattern
- 10-20% gas savings
- Prevents unnecessary storage writes

#### 2. TTL Management
**Implementation**: `src/state_management.rs`
- Auto-extension for Persistent storage
- ~60 day TTL for critical config
- Prevents config expiration

#### 3. Input Validation
**Implementation**: `src/input_validation.rs`
- Size limits on all unbounded types
- DoS prevention
- Limits:
  - Name: 32 chars
  - Symbol: 12 chars
  - Image URL: 256 chars
  - Description: 512 chars
  - Fee tiers: Max 10

#### 4. Pausable Pattern
**Implementation**: `src/state_management.rs`
- Emergency pause capability
- Multi-role access control
- 5 contract states (Uninitialized, Active, Paused, Migrating, Deprecated)

#### 5. Property-Based Fuzzing
**Implementation**: `fuzz/`
- 3 fuzz targets (bonding curve, buy, sell)
- 32 security properties tested
- Extended fuzzing infrastructure (24+ hours)

#### 6. Hierarchical Error Codes
**Implementation**: `src/errors.rs`
- OpenZeppelin pattern
- 100-999 range by category
- Prevents collisions, aids debugging

#### 7. RBAC System
**Implementation**: `src/access_control.rs`
- 5 roles: Owner, PauseAdmin, TreasuryAdmin, FeeAdmin, EmergencyPauser
- Granular permissions
- Batch operations support

#### 8. Temporary Storage Optimization
**Implementation**: `src/temporary_storage.rs`
- Cheaper storage for ephemeral data
- Cache, rate limiting, nonces

### B. Test Coverage

**Total Tests**: 120+ passing
- Core contract tests: 107
- Input validation tests: 10
- Best practices tests: 14
- Integration tests: 5
- Error hierarchy tests: 3
- Access control tests: 4

**Test Categories**:
- Initialization
- Token launch (SAC and Soroban)
- Buy/sell operations
- Graduation flow
- Anti-whale protection
- Fee management
- Access control
- Bonding curve math
- Resource tracking
- Edge cases

### C. CI/CD Security

**GitHub Actions**: `.github/workflows/security-audit.yml`
- Scout security analysis
- cargo-audit (dependency vulnerabilities)
- Fuzzing tests (5 min runs)
- Clippy security lints

**Security Lints**:
```bash
-W clippy::integer_arithmetic
-W clippy::unwrap_used
-W clippy::panic
-W clippy::indexing_slicing
-W clippy::cast_possible_truncation
```

---

## 3. Critical Areas for Audit

### Priority 1: High Risk

#### 1. Bonding Curve Math
**File**: `src/bonding_curve.rs`

**Functions**:
- `calculate_buy()` - Token output from XLM input
- `calculate_sell()` - XLM output from token input
- `update_after_buy()` - Update reserves
- `update_after_sell()` - Update reserves

**Properties to Verify**:
- ✅ Constant product invariant (K = xlm_reserve * token_reserve)
- ✅ No integer overflow/underflow
- ✅ Monotonicity (more input = more output)
- ✅ Rounding always favors liquidity
- ✅ Can't buy/sell more than available
- ✅ Price increases after buy, decreases after sell

**Risks**:
- Rounding errors could allow draining reserves
- Integer overflow with extreme values
- Price manipulation via flash loans (mitigated by fees)

#### 2. Graduation Logic
**File**: `src/lib.rs` (lines 802-953)

**Functions**:
- `try_graduate_token()` - Deploy AMM and migrate liquidity
- `check_graduation()` - Check if token meets threshold

**Properties to Verify**:
- ✅ Liquidity correctly transferred to AMM
- ✅ LP tokens burned (irreversible)
- ✅ No re-entrance possible
- ✅ Atomic operation (all-or-nothing)
- ⚠️ Race condition: concurrent graduation attempts

**Risks**:
- Loss of funds if graduation fails mid-way
- Oracle price manipulation
- Front-running graduation

#### 3. Anti-Whale Protection
**File**: `src/anti_whale.rs`

**Functions**:
- `validate_buy()` - Check buy limits
- `record_buy()` - Update holdings tracking
- `validate_fee_tiers()` - Validate progressive fees

**Properties to Verify**:
- ✅ Holdings tracking accurate
- ✅ Cooldown period enforced
- ✅ Progressive fees calculated correctly
- ⚠️ Desync between internal tracking and actual balances

**Risks**:
- Bypass via multiple wallets
- Holdings tracking desync
- Fee calculation overflow

### Priority 2: Medium Risk

#### 4. Access Control
**File**: `src/access_control.rs`

**Areas**:
- Role management
- Ownership transfer
- Emergency pause

**Risks**:
- Admin key compromise
- Insufficient privilege separation

#### 5. Oracle Integration
**File**: `src/price_oracle.rs`

**Areas**:
- DIA price feed integration
- Stale price detection
- Fallback mechanisms

**Risks**:
- Oracle failure blocking operations
- Price manipulation
- Stale price acceptance

#### 6. Fee Management
**File**: `src/fee_management.rs`

**Areas**:
- Fee calculation
- Fee distribution
- Fee updates

**Risks**:
- Fee bypass
- Rounding errors
- Excessive fees

### Priority 3: Low Risk

#### 7. State Management
**File**: `src/state_management.rs`

**Areas**:
- Pause/unpause
- State transitions
- TTL management

#### 8. Storage
**File**: `src/storage.rs`

**Areas**:
- Data persistence
- Key-value management
- TTL extension

---

## 4. Known Issues & Mitigations

### Issue 1: Locked XLM Accounting (FIXED)
**Severity**: Medium
**Description**: `locked_xlm` was not properly decremented on sells
**Fix**: Added `locked_xlm_tests.rs` with regression tests
**Status**: ✅ Fixed and tested

### Issue 2: Graduation Race Condition
**Severity**: Medium
**Description**: Multiple concurrent graduation attempts possible
**Mitigation**: Added `GraduationAlreadyInProgress` error
**Status**: ⚠️ Needs audit verification

### Issue 3: Oracle Dependency
**Severity**: Low
**Description**: Graduation blocked if oracle fails
**Mitigation**: Configurable min market cap, can be disabled
**Status**: ✅ Acceptable risk

---

## 5. Fuzzing Results

### Extended Fuzzing (24+ Hours) - Pending

**Setup**:
```bash
./fuzz/run_extended_fuzzing.sh 86400  # 24 hours
```

**Targets**:
1. `fuzz_bonding_curve` - 10 mathematical properties
2. `fuzz_buy_function` - 10 input validation properties
3. `fuzz_sell_function` - 12 safety properties

**Status**: Infrastructure ready, long-run pending before mainnet

**Quick Fuzzing (5 minutes)**:
- ✅ No crashes detected
- ✅ All invariants held
- ✅ Edge cases handled

---

## 6. Deployment Plan

### Testnet

**Deployed**: Yes
**Network**: Soroban Testnet
**Contract ID**: `[TBD after final audit]`

**Testing**:
- ✅ Token launch
- ✅ Buy/sell operations
- ✅ Graduation simulation
- ⏳ High-load testing
- ⏳ Frontend integration

### Mainnet

**Requirements Before Deployment**:
1. ✅ All Soroban 2026 best practices implemented
2. ✅ 120+ tests passing
3. ✅ CI/CD security checks
4. ⏳ **Extended fuzzing (24+ hours)**
5. ⏳ **Professional security audit** (THIS APPLICATION)
6. ⏳ Audit fixes implemented
7. ⏳ Final testnet validation

**Timeline**:
- Week 1-2: Extended fuzzing
- Week 3-6: Security audit
- Week 7: Implement audit findings
- Week 8: Final testing
- Week 9: Mainnet deployment

---

## 7. Team & Resources

### Development Team

**Smart Contracts**: Experienced Rust/Soroban developers
**Frontend**: Next.js 15 + React 19
**Backend**: GraphQL + Prisma indexer

### Resources

**Repository**: [Private - available to auditors]
**Documentation**:
- `SOROBAN_BEST_PRACTICES_IMPLEMENTATION.md` - Implementation details
- `fuzz/README.md` - Fuzzing guide
- `CLAUDE.md` - Architecture overview

**Support**:
- Direct communication channel during audit
- On-call for questions
- CI/CD access for auditors

---

## 8. Audit Scope

### In Scope

**Contracts**:
- `sac-factory` (SAC Factory contract) - **PRIMARY**

**Dependencies** (for context):
- `astro-core-shared` (shared math library)

**Lines of Code**:
- SAC Factory: ~2,500 LOC (excluding tests)
- Tests: ~3,000 LOC
- Total: ~5,500 LOC

### Out of Scope

- Frontend code
- Backend indexer
- AMM pair contract (separate audit)
- DEX router contract (separate audit)

### Specific Requests

1. **Bonding Curve Verification**: Mathematical proof of invariants
2. **Graduation Flow**: Step-by-step security review
3. **Anti-Whale Bypass**: Attempt to bypass holdings limits
4. **Oracle Manipulation**: Test price feed attacks
5. **Economic Exploits**: Flash loans, arbitrage, MEV
6. **Access Control**: Role permission matrix verification
7. **Gas Optimization**: Review for excessive resource usage

---

## 9. Budget & Timeline

### Audit Budget

**Proposed**: $50,000 - $100,000
- Flexible based on audit scope
- Willing to adjust for thorough review

**Payment**:
- 50% upfront
- 50% upon completion
- Via Stellar/USDC or bank transfer

### Timeline

**Preferred**: 4-6 weeks
- Week 1-2: Initial review + questions
- Week 3-4: Deep dive + testing
- Week 5: Report draft
- Week 6: Final report + fixes

**Urgency**: High
- Mainnet launch planned for Q2 2026
- Market opportunity time-sensitive

---

## 10. Application Checklist

- ✅ All Soroban 2026 best practices implemented
- ✅ 120+ tests passing
- ✅ Fuzzing infrastructure complete
- ✅ CI/CD security checks enabled
- ✅ Error handling with hierarchical codes
- ✅ RBAC system implemented
- ✅ Storage optimization applied
- ✅ Input validation comprehensive
- ✅ Documentation complete
- ⏳ Extended fuzzing results (pending)
- ⏳ Testnet high-load testing (pending)

---

## 11. Contact & Next Steps

### Primary Contact

**Name**: [Your Name]
**Email**: dev@astrolaunch.io
**Telegram**: @astrolaunchpad
**GitHub**: [Private repo - access upon request]

### Preferred Auditors

1. **Veridise** - Soroban specialists
2. **CoinFabrik** - Scout tool creators
3. **OpenZeppelin** - Stellar contracts experts
4. **Runtime Verification** - Formal verification

### Next Steps

1. Submit application to Soroban Audit Bank
2. Schedule intro call with auditors
3. Provide repo access and documentation
4. Run extended fuzzing during audit process
5. Respond to auditor questions promptly
6. Implement audit findings immediately

---

## References

- [Soroban Audit Bank](https://stellar.org/grants-and-funding/soroban-audit-bank)
- [Veridise Security Checklist](https://github.com/Veridise/soroban-checklist)
- [OpenZeppelin Stellar Contracts](https://docs.openzeppelin.com/stellar-contracts)
- [Soroban Best Practices 2026](../../../SOROBAN_BEST_PRACTICES_2026.md)

---

**Last Updated**: 2026-03-19
**Contract Version**: v0.1.0
**Soroban SDK**: 25.2.0
**Protocol**: 25 "X-Ray"
