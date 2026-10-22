/**
 * Configuración de red. Todo apunta a testnet público: sin servicios locales.
 */
export const NETWORK_NAME = 'testnet'
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
export const RPC_URL = 'https://soroban-testnet.stellar.org'
export const HORIZON_URL = 'https://horizon-testnet.stellar.org'

/** Soroswap ya desplegado en testnet (no reinventar el AMM). */
export const SOROSWAP_FACTORY = 'CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY'
export const SOROSWAP_ROUTER = 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
export const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

/** Token de ejemplo desplegado en testnet (contrato `astro-token`). */
export const ASTRO_TOKEN_ID = 'CAI637WCEILQF3ZYOV6BRUCX532XQIVOOJ4CRWFPWHQRJHOH5OKHSXRE'

/**
 * sha256 del wasm del contrato. Ya está subido a la red, así que el launchpad
 * puede crear nuevas instancias (tokens) sin volver a subir el binario.
 */
export const ASTRO_WASM_HASH =
  '438d12a79855dd42c353d12bb42e6b57ed513eed47b7008094683ba33f971286'
