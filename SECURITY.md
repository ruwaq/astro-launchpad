# Security Policy — AstroGate (Stellar Testnet)

AstroGate is a decentralized token launchpad and AMM studio built **exclusively for the Stellar Testnet**. No real funds or mainnet assets are used, and built-in demo accounts are disposable.

## Scope

- `contracts/token/`: SEP-41 fungible token built on OpenZeppelin Stellar (`Capped`, `TotalSupply`, `FungibleBurnable`, `Ownable`), with 90-day TTL extension (`extend_ttl`) across state-changing operations.
- `contracts/launchpad/` (v2): Atomic launchpad contract with persistent 90-day on-chain registry (`launch_fair`, `launch_token`, `get_launches`, `get_launch`) and bounded on-chain Burn-to-Chat (`burn_shout`, `get_shouts`). Deploys token, seeds Soroswap pool, burns 100% of initial LP tokens, and renounces token ownership in a single transaction.
- `frontend/`: Static SPA (Vite + React 19 + TypeScript) deployed on Cloudflare Workers (`https://astrogate-stellar.pepepop2000.workers.dev`); identity is the connected wallet and state is read directly from Soroban RPC and Horizon.
- External AMM integration with **Soroswap** (Factory and Router deployed on Stellar Testnet).

## Trust Model

- **The network is the single source of truth** for balances, supply, reserves, and contract events.
- There is no user backend, JWT auth, server database, or server-side secret in the user flow.
- The user's wallet signs all state-changing operations.
- Demo Mode stores disposable **testnet** secret keys in browser `localStorage`; they are accessible to anyone with access to that browser profile and must never be reused for real funds.
- Soroswap contracts and public Soroban RPC / Horizon endpoints are external dependencies outside this repository's control.

## Implemented Security Controls

- **Hard-Capped Token Supply (`Capped`)**: `contracts/token` sets an immutable supply cap equal to `initial_supply` during `__constructor`. Even if an owner has not renounced ownership, `mint` cannot exceed `cap()` (tokens must be burned before any re-mint up to the cap).
- **Ownership Renunciation & LP Burn**: Fair-launch tokens renounce `Ownable` ownership (`owner() == None`) and burn initial LP tokens to the Stellar burn address (`GAAAA...WHF`), preventing rug-pulls and post-launch inflation.
- **Pre-Seeded Pool Protection (`PairAlreadySeeded`)**: `contracts/launchpad` verifies that any pre-existing Soroswap pair has `(0, 0)` reserves before adding initial liquidity, preventing pool price hijacking or LP dilution attacks.
- **Anti-Frontrunning Salt Derivation**: `contracts/launchpad` hashes `(creator, salt)` with `sha256` before calling `deployer().with_current_contract(derived_salt)`, preventing third parties from front-running a creator's salt.
- **Strict CSP & HTTP Security Headers**: Configured identically across `frontend/public/_headers`, `frontend/vercel.json`, and `frontend/nginx.conf` (`X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `object-src 'none'`, explicit `connect-src` and `font-src` allowlists including Reown fonts), verified in CI via `npm run check:csp`.
- **Bounded On-Chain Metadata & Safe Rendering**: Launch metadata (`LaunchRecord.meta`) is capped on-chain at `512` UTF-8 bytes, encodes only compact HTTPS-validated logo links and sanitized URLs (`encodeOnChainMeta` / `decodeOnChainMeta`), and renders strictly as plain text via React without `dangerouslySetInnerHTML`. Burn-to-Chat shouts (`burn_shout`) are bounded to `1..=160` bytes with at most `15` shouts persisted per token.
- **Slippage & Balance Guards**: Swaps use live Soroswap router quotes (`router_get_amount_out`), enforce minimum output amounts (`amount_out_min`), and validate balances + gas reserves before prompting wallet signatures.
- **Non-Caching Service Worker**: `frontend/public/sw.js` only caches the static application shell and assets; it never caches Soroban RPC, Horizon, or wallet relay requests.

## Known Limitations

- **Unaudited Code**: Neither the smart contracts nor the frontend have undergone an external third-party security audit. Do not deploy to mainnet without a formal audit.
- **No Off-Chain Indexer**: Visible on-chain activity depends on the Soroban RPC event retention window; the testnet Soroswap pair contract does not emit `swap` events, so historical price charts rely on local browser snapshots (`IndexedDB` / `localStorage`).
- **On-Chain Metadata Limits**: `LaunchRecord.meta` is capped at `512` bytes UTF-8 (`https://` external image URLs only; raw binary images or `data:` URLs are rejected). Users may still enrich local views via `localStorage` (`astrogate.token.meta.<id>`).
- **Demo Mode Keys**: Testnet keys live in `localStorage` by design for one-click onboarding.
- **Credential Rotation**: A historical local test credential (`scripts/opencode-env/service.json`) in early git commit history was purged from the working tree and replaced by an uncredentialed template; the underlying service password must be rotated and never reused.

## Reporting a Vulnerability

Do not open a public issue with exploitable details. Open a private **GitHub Security Advisory** on the repository and include:

1. Affected commit or branch,
2. Impact and affected components (smart contract, frontend, wallet integration, demo mode),
3. Reproduction steps on Stellar Testnet,
4. Evidence (transaction hash, sanitized logs without secrets).

Never include secret seeds, API tokens, or personal data.
