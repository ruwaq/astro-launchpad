use soroban_sdk::{Address, Env, symbol_short};

/// Emit event when liquidity is added
pub fn liquidity_added(
    env: &Env,
    provider: &Address,
    amount_0: i128,
    amount_1: i128,
    liquidity: i128,
) {
    env.events().publish(
        (symbol_short!("liq_add"),),
        (provider, amount_0, amount_1, liquidity),
    );
}

/// Emit event when liquidity is removed
pub fn liquidity_removed(
    env: &Env,
    provider: &Address,
    amount_0: i128,
    amount_1: i128,
    liquidity: i128,
) {
    env.events().publish(
        (symbol_short!("liq_rm"),),
        (provider, amount_0, amount_1, liquidity),
    );
}

/// Emit event when a swap occurs
pub fn swap(
    env: &Env,
    sender: &Address,
    token_in: &Address,
    token_out: &Address,
    amount_in: i128,
    amount_out: i128,
) {
    env.events().publish(
        (symbol_short!("swap"),),
        (sender, token_in, token_out, amount_in, amount_out),
    );
}

/// Emit event when fee is updated
pub fn emit_fee_updated(env: &Env, fee_bps: u32) {
    env.events().publish(
        (symbol_short!("fee_upd"),),
        (fee_bps, env.ledger().timestamp()),
    );
}
