# Fuzzing Tests for SAC Factory

Implements property-based fuzzing for critical contract functions following Soroban 2026 best practices.

## Overview

Fuzzing tests use `cargo-fuzz` (libFuzzer) to discover edge cases, overflow bugs, and invariant violations through randomized input generation.

## Fuzz Targets

### 1. `fuzz_bonding_curve`
**Purpose**: Test bonding curve math for correctness and safety

**Properties Tested**:
- ✅ No integer overflow/underflow
- ✅ Constant product invariant (K = tokens × XLM)
- ✅ Monotonicity (more input = more output)
- ✅ Price increases after buy, decreases after sell
- ✅ Can't buy/sell more than available
- ✅ Output always positive

**Run**:
```bash
cargo fuzz run fuzz_bonding_curve
```

### 2. `fuzz_buy_function`
**Purpose**: Test buy() input validation and edge cases

**Properties Tested**:
- ✅ Negative amounts rejected
- ✅ Slippage protection works
- ✅ Deadline validation
- ✅ No overflow on extreme values (i128::MAX, i128::MIN)
- ✅ Zero value handling
- ✅ Maximum supply checks

**Run**:
```bash
cargo fuzz run fuzz_buy_function
```

### 3. `fuzz_sell_function`
**Purpose**: Test sell() input validation and edge cases

**Properties Tested**:
- ✅ Negative amounts rejected
- ✅ Slippage protection works
- ✅ Balance checks
- ✅ Can't drain entire XLM reserve
- ✅ Fee calculation safety
- ✅ No overflow on extreme values

**Run**:
```bash
cargo fuzz run fuzz_sell_function
```

## Running Fuzzing Tests

### Quick Run (30 seconds each)
```bash
# From contracts/sac-factory directory
cargo +nightly fuzz run fuzz_bonding_curve -- -max_total_time=30
cargo +nightly fuzz run fuzz_buy_function -- -max_total_time=30
cargo +nightly fuzz run fuzz_sell_function -- -max_total_time=30
```

### Long Run (Recommended for CI)
```bash
# Run each target for 5 minutes
cargo +nightly fuzz run fuzz_bonding_curve -- -max_total_time=300
cargo +nightly fuzz run fuzz_buy_function -- -max_total_time=300
cargo +nightly fuzz run fuzz_sell_function -- -max_total_time=300
```

### Extended Fuzzing (Pre-Mainnet - 24+ Hours)

**CRITICAL for production**: Run extended fuzzing before mainnet deployment.

```bash
# Automated runner - runs all targets in parallel for 24 hours
chmod +x fuzz/run_extended_fuzzing.sh
./fuzz/run_extended_fuzzing.sh 86400  # 24 hours

# Monitor progress
tail -f fuzz/fuzzing_results_*/fuzz_bonding_curve.log
tail -f fuzz/fuzzing_results_*/fuzz_buy_function.log
tail -f fuzz/fuzzing_results_*/fuzz_sell_function.log

# Check summary
./fuzz/fuzzing_results_*/summary.sh

# Stop all fuzzing
./fuzz/stop_fuzzing.sh fuzz/fuzzing_results_*
```

**Recommended Durations**:
- Development: 5 minutes (300s)
- Pre-PR: 30 minutes (1800s)
- Pre-Audit: 24 hours (86400s)
- Pre-Mainnet: 48+ hours (172800s)

### Continuous Fuzzing (No time limit)
```bash
# Run until manually stopped (Ctrl+C)
cargo +nightly fuzz run fuzz_bonding_curve
```

## Reproducing Crashes

If fuzzing finds a crash, it will save the input to `fuzz/artifacts/`:

```bash
# Reproduce with the crash input
cargo fuzz run fuzz_bonding_curve fuzz/artifacts/fuzz_bonding_curve/crash-<hash>
```

## Integration with CI

Add to `.github/workflows/test.yml`:

```yaml
- name: Run fuzzing tests
  run: |
    cd contracts/sac-factory
    cargo fuzz run fuzz_bonding_curve -- -max_total_time=60
    cargo fuzz run fuzz_buy_function -- -max_total_time=60
    cargo fuzz run fuzz_sell_function -- -max_total_time=60
```

## Coverage Analysis

To see which code paths are covered:

```bash
cargo fuzz coverage fuzz_bonding_curve
```

## Best Practices

1. **Run before each release**: Fuzzing should be part of pre-mainnet checklist
2. **Long runs for security audits**: Run for 24+ hours before mainnet
3. **Save crash artifacts**: Never delete crash artifacts - they're regression tests
4. **Monitor corpus**: The corpus grows as fuzzer finds new code paths

## References

- [cargo-fuzz Book](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [Soroban Security Best Practices 2026](../../SOROBAN_BEST_PRACTICES_2026.md)
- [Veridise Soroban Security Checklist](https://github.com/Veridise/soroban-checklist)

## Security Note

🔴 **CRITICAL**: Do NOT skip fuzzing tests for mainnet deployments. Property-based testing has discovered critical bugs in production DeFi contracts that unit tests missed.

Last Updated: 2026-03-19
