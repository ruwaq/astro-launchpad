//! Tests del token: solo su OZ (`stellar-tokens` 0.8) y `soroban-sdk` testutils.

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token, Address, Env, IntoVal, String,
};

use crate::contract::{Token, TokenClient};

const NAME: &str = "Astro Test Token";
const SYMBOL: &str = "ASTRO";
const DECIMALS: u32 = 18;

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

    client.mint(&user, &500);

    assert_eq!(client.balance(&user), 500);
    assert_eq!(client.total_supply(), 1_500);
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
fn sep41_interface_via_token_client() {
    let e = Env::default();
    let owner = Address::generate(&e);
    let client = create_client(&e, &owner);

    // Interfaz SEP-41 estándar: el cliente genérico `token::Client` funciona.
    let sc = token::Client::new(&e, &client.address);
    assert_eq!(sc.balance(&owner), 1_000);
}
