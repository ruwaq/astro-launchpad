/**
 * Centralized Contract Configuration
 *
 * IMPORTANT: Update contract addresses HERE ONLY when deploying new versions.
 * All apps/packages in the monorepo import from this single source of truth.
 *
 * Last Updated: April 16, 2026
 * Current Version: V6
 */

// =============================================================================
// CONTRACT ADDRESSES - SINGLE SOURCE OF TRUTH
// =============================================================================

/**
 * SAC Factory Contract (Token Launchpad)
 *
 * History:
 * - V3: CDBYOO5H6WEMT4D2DGMQ6KJPKOZZMEDJ5UT77MAHCGD5WVHSJABMHZ3Y
 * - V5: CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK
 * - V6: CDPWQPKGIQTKDGQZHLGF5GU2V5TVCTK7TGINYTMTYNSLAQPVZM7OPW7T
 * - V7: CBNQZ3NE5CUAZVDTI34FGMABOV26EOHGCVXU5F7KLRFSGMC33W7U225Z
 * - V8: CBKLLY6Q25OEAXSFU7TDTECC5NATFO6RZV3ZDVOI6K5XB7KZI4RBZZFO
 * - V9: CBB6RCXAUCV6ES7KEK6QINAB3X2NYKW2NKWWBTXBJ2HAP54E7Y6NUJHP (current - V6 tokenomics: 34.5k graduation, 0.15%/0.15% fees)
 */
export const TOKEN_FACTORY_CONTRACT_ID = 'CBB6RCXAUCV6ES7KEK6QINAB3X2NYKW2NKWWBTXBJ2HAP54E7Y6NUJHP';

/**
 * Astro Token Address (Platform Token)
 */
export const ASTRO_TOKEN_ADDRESS = 'CBCX43B5YHWW5PGGRDFWRE3TCFMLOI3WU4WYOVNAUFFEGCKZFPLVJ5DP';

/**
 * AstroSwap DEX Factory Contract
 */
export const DEX_FACTORY_CONTRACT_ID = 'CCIWIAARHLGLOXFZZJZVA42JWJRB3UCB25S6K6462SM27L5YNODDS2TW';

/**
 * AstroSwap DEX Router Contract
 */
export const DEX_ROUTER_CONTRACT_ID = 'CDDAPQKLLP2WMH2LJELHM4E5NTZ7KEVEFV5GFE7EIPTUVD4K4YUUZQQV';

/**
 * DEX Pair WASM Hash (for creating new pairs)
 * Updated: April 15, 2026 - Security Grade A, gas optimizations, router event tracking
 */
export const DEX_PAIR_WASM_HASH = '251b80d004a806aa1eeb63c80b1582d5942df2702d707beb85c12067e1a0a941';

/**
 * Oracle Contract (DIA Price Oracle)
 */
export const ORACLE_CONTRACT_ID = 'CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4';

/**
 * XLM SAC (Stellar Asset Contract) Address
 */
export const XLM_SAC_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// =============================================================================
// AGGREGATED EXPORTS
// =============================================================================

/**
 * All contract IDs in a single object for convenience
 */
export const CONTRACT_IDS = {
  tokenFactory: TOKEN_FACTORY_CONTRACT_ID,
  astroToken: ASTRO_TOKEN_ADDRESS,
  dexFactory: DEX_FACTORY_CONTRACT_ID,
  dexRouter: DEX_ROUTER_CONTRACT_ID,
  dexPairWasmHash: DEX_PAIR_WASM_HASH,
  oracle: ORACLE_CONTRACT_ID,
  xlmSac: XLM_SAC_ADDRESS,
} as const;

/**
 * Get a contract ID with environment variable override support
 * Useful for testing with different contracts
 */
export function getContractId(
  key: keyof typeof CONTRACT_IDS,
  envOverride?: string
): string {
  if (envOverride) {
    return envOverride;
  }
  return CONTRACT_IDS[key];
}

/**
 * Validate that a string is a valid Stellar contract ID
 */
export function isValidContractId(id: string): boolean {
  return /^C[A-Z0-9]{55}$/.test(id);
}

/**
 * Validate all contract IDs
 */
export function validateContractIds(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(CONTRACT_IDS)) {
    if (key === 'dexPairWasmHash') {
      // WASM hash is hex, not a contract ID
      if (!/^[a-f0-9]{64}$/.test(value)) {
        errors.push(`Invalid WASM hash for ${key}: ${value}`);
      }
    } else {
      if (!isValidContractId(value)) {
        errors.push(`Invalid contract ID for ${key}: ${value}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
