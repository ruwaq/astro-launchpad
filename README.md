# Astro Launchpad (Minimal MVP)

Launchpad + AMM sobre Stellar/Soroban: crea tu token, añádele liquidez contra
XLM y swapea, todo on-chain en testnet. Sin backend de usuarios: la identidad es
la wallet y los datos se leen de la red.

Ver `PLAN.md` para arquitectura y roadmap, `STATUS.md` para el estado actual.

## Qué hay

- `contracts/token/` — contrato de token fungible SEP-41 (OpenZeppelin Stellar),
  compilado a wasm y **ya desplegado en testnet**. El launchpad crea instancias
  nuevas de ese mismo wasm (cada token es su propio contrato).
- `frontend/` — Vite + React 19 + TypeScript. Lee de Soroban RPC público, firma
  con la wallet (`@creit.tech/stellar-wallets-kit`) y usa Soroswap como AMM.

## Dev rápido

```bash
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Comandos

```bash
# Frontend
npm run build          # tsc + vite build
npm run lint           # oxlint
npm run smoke:render   # render del árbol de componentes (sin navegador)
npm run bindings       # regenera los bindings TS desde los contratos on-chain

# Verificaciones on-chain (necesitan STELLAR_SECRET de una cuenta de testnet)
npm run verify:launchpad   # despliega un token nuevo y lo lee
npm run verify:soroswap    # par, liquidez, cotización y swap
npm run verify:frontend    # el mismo código que la UI, de punta a punta

# Contrato
cargo test -p astro-token
cd contracts/token && stellar contract build
```

## Testnet

- RPC: https://soroban-testnet.stellar.org
- Token del launchpad: `CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE`
- wasm hash (ya subido a la red): `438d12a79855dd42c353d12bb42e6b57ed513eed47b7008094683ba33f971286`
- Soroswap factory: `CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY`
- Soroswap router: `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD`
- XLM SAC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

Direcciones y trampas de Soroswap: `AGENTS.md`.

## Servicios locales

Opcionales y no requeridos: el flujo de usuario no depende de ellos.
