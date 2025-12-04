/**
 * Centralized Contract Configuration
 *
 * IMPORTANT: Update contract addresses HERE ONLY when deploying new versions.
 * All apps/packages in the monorepo import from this single source of truth.
 *
 * Last Updated: November 27, 2024
 * Current Version: V5
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
 * - V7: CBNQZ3NE5CUAZVDTI34FGMABOV26EOHGCVXU5F7KLRFSGMC33W7U225Z (current - pump.fun style, no anti-whale, 30k XLM graduation)
 */
export const TOKEN_FACTORY_CONTRACT_ID = 'CBNQZ3NE5CUAZVDTI34FGMABOV26EOHGCVXU5F7KLRFSGMC33W7U225Z';

/**
 * Astro Token Address (Platform Token)
 */
export const ASTRO_TOKEN_ADDRESS = 'CBCX43B5YHWW5PGGRDFWRE3TCFMLOI3WU4WYOVNAUFFEGCKZFPLVJ5DP';

/**
 * AstroSwap DEX Factory Contract
 */
export const DEX_FACTORY_CONTRACT_ID = 'CDC22YEAGFSW7AO5I2FQAAJ7PMHMN5Q76ER6BT7XALZ4UQCFEKA2G2WT';

/**
 * AstroSwap DEX Router Contract
 */
export const DEX_ROUTER_CONTRACT_ID = 'CCBNY4JPDHS45KXK34HI4VSYE7P2YKOZEHFVXQ4UZMYHVHOAS7DLPWUM';

/**
 * DEX Pair WASM Hash (for creating new pairs)
 * Updated: Dec 3, 2024 - Local AMM pair with 4-param initialize
 */
export const DEX_PAIR_WASM_HASH = '831bb38e1dc8331d58a9a169b6576d8acb52c54121c52fb5b9f732f3f5414abe';

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
