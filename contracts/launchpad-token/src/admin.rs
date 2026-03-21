use soroban_sdk::{Address, Env};

use crate::errors::Error;
use crate::storage_types::DataKey;

pub fn read_administrator(e: &Env) -> Result<Address, Error> {
    let key = DataKey::Admin;
    e.storage()
        .instance()
        .get(&key)
        .ok_or(Error::NotInitialized)
}

pub fn has_administrator(e: &Env) -> bool {
    let key = DataKey::Admin;
    e.storage().instance().has(&key)
}

pub fn write_administrator(e: &Env, id: &Address) {
    let key = DataKey::Admin;
    e.storage().instance().set(&key, id);
}
