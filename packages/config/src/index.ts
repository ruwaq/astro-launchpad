/**
 * @astroshibapop/config
 *
 * Centralized configuration package for the Astro ecosystem.
 *
 * Usage:
 * ```typescript
 * // Import everything
 * import { CONTRACT_IDS, getNetworkConfig } from '@astroshibapop/config';
 *
 * // Import specific modules
 * import { TOKEN_FACTORY_CONTRACT_ID } from '@astroshibapop/config/contracts';
 * import { RPC_URL, NETWORK_PASSPHRASE } from '@astroshibapop/config/network';
 * ```
 *
 * When updating contract addresses:
 * 1. Update ONLY packages/config/src/contracts.ts
 * 2. Run `pnpm install` to ensure all packages see the update
 * 3. All apps will automatically use the new addresses
 */

// Re-export all contract configuration
export * from './contracts';

// Re-export all network configuration
export * from './network';

// Version info
export const CONFIG_VERSION = '0.1.0';
export const LAST_UPDATED = '2024-11-27';
