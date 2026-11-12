//! Tests del token: solo su OZ (`stellar-tokens` 0.8) y `soroban-sdk` testutils.

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token, Address, Env, IntoVal, String,
};

use crate::contract::{Token, TokenClient};

const NAME: &str = "Astro Test Token";
const SYMBOL: &str = "ASTRO";
const DECIMALS: u32 = 7;
const MAX_DECIMALS: u32 = 18;

fn create_client<'a>(e: &'a Env, owner: &Address) -> TokenClient<'a> {
    let address = e.register(
        Token,
        (
            String::from_str(e, NAME),
            String::from_str(e, SYMBOL),
            DECIMALS,
            owner.clone(),
            1_000_i128, // initial_supply
        ),
    );
    TokenClient::new(e, &address)
}

#[test]
fn metadata_and_initial_supply() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);

    assert_eq!(client.decimals(), DECIMALS);
    assert_eq!(client.name(), String::from_str(&e, NAME));
    assert_eq!(client.symbol(), String::from_str(&e, SYMBOL));
    // El mint del constructor va al owner y queda trackeado.
    assert_eq!(client.balance(&owner), 1_000);
    assert_eq!(client.total_supply(), 1_000);
}

#[test]
fn owner_can_mint() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);

    e.mock_all_auths();

    // Con supply == cap no queda margen de mint: el owner NO puede inflar.
    assert_eq!(client.cap(), 1_000);
    client.mint(&user, &0);
    assert_eq!(client.total_supply(), 1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #106)")]
fn mint_beyond_cap_fails_even_for_owner() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);

    e.mock_all_auths();

    // Mint de EA16: el supply ya es igual al cap fijado en el constructor.
    client.mint(&user, &1);
}

#[test]
fn mint_after_burn_respects_cap() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);

    e.mock_all_auths();

    // Quemar libera espacio del cap: se puede re-mintear pero NUNCA
    // superar el supply inicial fijado en el constructor.
    client.burn(&owner, &200);
    client.mint(&user, &200);
    assert_eq!(client.total_supply(), 1_000);
    assert_eq!(client.cap(), 1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #106)")]
fn mint_after_burn_beyond_cap_fails() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);

    e.mock_all_auths();

    client.burn(&owner, &200); // total_supply = 800
    client.mint(&user, &200); // rellena hasta el cap
    client.mint(&user, &1); // ya NO hay margen → ExceededCap
}

#[test]
#[should_panic(expected = "decimals exceeds the maximum allowed")]
fn constructor_rejects_excessive_decimals() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let symbol = String::from_str(&e, SYMBOL);
    let name = String::from_str(&e, NAME);
    let _ = e.register(Token, (name, symbol, MAX_DECIMALS + 1, owner, 1_000_i128));
}

#[test]
#[should_panic(expected = "name must be 1..32 bytes")]
fn constructor_rejects_long_name() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let long_name = String::from_str(&e, "aname_sized_longer_than_thirtytwo_bytes_BYE");
    // 44 bytes > 32.
    let _ = e.register(
        Token,
        (
            long_name,
            String::from_str(&e, SYMBOL),
            7_u32,
            owner,
            1_000_i128,
        ),
    );
}

#[test]
#[should_panic(expected = "name must be 1..32 bytes")]
fn constructor_rejects_empty_name() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let _ = e.register(
        Token,
        (
            String::from_str(&e, ""),
            String::from_str(&e, SYMBOL),
            7_u32,
            owner,
            1_000_i128,
        ),
    );
}

#[test]
#[should_panic(expected = "symbol must be 1..32 bytes")]
fn constructor_rejects_empty_symbol() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let _ = e.register(
        Token,
        (
            String::from_str(&e, NAME),
            String::from_str(&e, ""),
            7_u32,
            owner,
            1_000_i128,
        ),
    );
}

#[test]
#[should_panic(expected = "initial supply must be positive")]
fn constructor_rejects_zero_initial_supply() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let _ = e.register(
        Token,
        (
            String::from_str(&e, NAME),
            String::from_str(&e, SYMBOL),
            7_u32,
            owner,
            0_i128,
        ),
    );
}

#[test]
fn transfer_works() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);

    e.mock_all_auths();

    client.transfer(&owner, &user, &400);

    assert_eq!(client.balance(&owner), 600);
    assert_eq!(client.balance(&user), 400);
    // Supply no cambia.
    assert_eq!(client.total_supply(), 1_000);
}

#[test]
fn burn_reduces_balance_and_supply() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);

    e.mock_all_auths();

    client.burn(&owner, &200);

    assert_eq!(client.balance(&owner), 800);
    assert_eq!(client.total_supply(), 800);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn non_owner_cannot_mint() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let non_owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);

    // Solo se mockea la autorización de `non_owner`: el `require_auth` de
    // `#[only_owner]` pide auth del owner real y no coincide, por lo que falla.
    e.mock_auths(&[MockAuth {
        address: &non_owner,
        invoke: &MockAuthInvoke {
            contract: &client.address,
            fn_name: "mint",
            args: (user.clone(), 100_i128).into_val(&e),
            sub_invokes: &[],
        },
    }]);

    client.mint(&user, &100);
}

#[test]
#[should_panic(expected = "initial supply must be positive")]
fn constructor_rejects_negative_initial_supply() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let _ = e.register(
        Token,
        (
            String::from_str(&e, NAME),
            String::from_str(&e, SYMBOL),
            7_u32,
            owner,
            -1_i128,
        ),
    );
}

#[test]
fn renounce_ownership_locks_mint_permanently() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);

    e.mock_all_auths();

    // Renuncia exitosa
    assert_eq!(client.get_owner(), Some(owner));
    client.renounce_ownership();
    assert_eq!(client.get_owner(), None);

    // Quemar para dejar espacio en el cap
    client.burn(&user, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #2100)")]
fn mint_fails_after_renounce_ownership() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);

    e.mock_all_auths();

    // Quema 100 para liberar margen bajo el cap
    client.burn(&owner, &100);

    // Renuncia
    client.renounce_ownership();

    // Intentar mint falla con OwnableError::OwnerNotSet (#100)
    client.mint(&user, &100);
}

#[test]
fn transfer_and_accept_ownership_workflow() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let new_owner = Address::generate(&e);

    e.mock_all_auths();

    // Inicia transferencia de 2 pasos
    client.transfer_ownership(&new_owner, &(e.ledger().sequence() + 100));
    assert_eq!(client.get_owner(), Some(owner));

    // Acepta transferencia
    client.accept_ownership();
    assert_eq!(client.get_owner(), Some(new_owner));
}

#[test]
fn extend_ttl_works() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);

    client.extend_ttl();
}

#[test]
fn sep41_interface_via_token_client() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);
    let user = Address::generate(&e);
    let spender = Address::generate(&e);

    e.mock_all_auths();

    // Interfaz SEP-41 estándar: el cliente genérico `token::Client` funciona.
    let sc = token::Client::new(&e, &client.address);
    assert_eq!(sc.balance(&owner), 1_000);
    assert_eq!(sc.decimals(), DECIMALS);
    assert_eq!(sc.name(), String::from_str(&e, NAME));
    assert_eq!(sc.symbol(), String::from_str(&e, SYMBOL));

    // transfer vía SEP-41
    sc.transfer(&owner, &user, &300);
    assert_eq!(sc.balance(&owner), 700);
    assert_eq!(sc.balance(&user), 300);

    // approve + allowance vía SEP-41
    sc.approve(&owner, &spender, &200, &(e.ledger().sequence() + 100));
    assert_eq!(sc.allowance(&owner, &spender), 200);

    // transfer_from vía SEP-41
    sc.transfer_from(&spender, &owner, &user, &100);
    assert_eq!(sc.balance(&owner), 600);
    assert_eq!(sc.balance(&user), 400);
    assert_eq!(sc.allowance(&owner, &spender), 100);

    // burn vía SEP-41
    sc.burn(&user, &100);
    assert_eq!(sc.balance(&user), 300);

    // burn_from vía SEP-41
    sc.burn_from(&spender, &owner, &50);
    assert_eq!(sc.balance(&owner), 550);
    assert_eq!(sc.allowance(&owner, &spender), 50);
}
