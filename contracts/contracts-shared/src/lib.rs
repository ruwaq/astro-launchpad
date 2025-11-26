//! # Contracts Shared Library
//!
//! Shared types, interfaces, math utilities, and events for the Astro ecosystem.
//!
//! ## Modules
//! - `types` - Common data structures and enums
//! - `math` - Safe arithmetic operations
//! - `interfaces` - Cross-contract call interfaces
//! - `events` - Standard event definitions
//!
//! ## Usage
//! ```rust
//! use contracts_shared::{TokenMetadata, safe_add, FeeConfig};
//! ```

#![no_std]

pub mod types;
pub mod math;
pub mod interfaces;
pub mod events;

// Re-export commonly used items
pub use types::*;
pub use math::*;
pub use interfaces::*;
pub use events::*;
