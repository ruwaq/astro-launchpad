/**
 * SAC Factory Contract Service
 *
 * Native integration with the deployed SAC Factory smart contract.
 * Provides methods for launching real SAC tokens, buying, selling,
 * and querying token information.
 *
 * Contract ID: CC3OFGFRFYZ4XN5AWTQNSZBEA4AP62GKHYF6YUFSMM2B4A6VUQLU3ZPV
 * Network: Stellar Testnet
 * Updated: November 25, 2024 (ASTRO Integration)
 */

import {
  xdr,
  Address,
  nativeToScVal,
  Asset,
  Operation,
  TransactionBuilder,
  Horizon,
} from '@stellar/stellar-sdk';
import { BaseContractService } from './base-contract.service';
import { CONTRACT_IDS } from '../config';
import { toScVal, addressToScVal, fromScVal } from '../utils';
import { logger } from '../../logger';
import type { StellarAddress } from '../../stellar/types';
import {
  validateSymbol,
  validateName,
} from '../asset-utils';
import {
  adaptTokenInfo,
  validateBondingCurveInvariant,
  type RawTokenInfo,
} from '../adapters/contract-adapter';
import {
  calculateBuyOutput as calculateBuyOutputUtil,
  calculateSellOutput as calculateSellOutputUtil,
} from '../utils/bonding-curve.utils';

/**
 * Token Status Enum (must match contract)
 */
export enum TokenStatus {
  Bonding = 'Bonding',
  Graduated = 'Graduated',
}

/**
 * Bonding Curve State
 */
export interface BondingCurve {
  xlm_reserve: string;
  token_reserve: string;
  k: string;
}

/**
 * Token Information returned by the contract
 * Matches the TokenInfo struct from the contract
 */
export interface TokenInfo {
  id: number;
  creator: string;
  token_address: string;
  name: string;
  symbol: string;
  issuer: string; // Asset issuer public key (G...) for trustline creation
  image_url: string;
  description: string;
  created_at: number;
  status: TokenStatus;
  bonding_curve: BondingCurve;
  xlm_raised: string;
  market_cap: string;
  holders_count: number;
}

/**
 * Fee Configuration
 */
export interface FeeConfig {
  creation_fee: string;
  trading_fee_bps: string;
  treasury: string;
}

/**
 * Contract State
 */
export interface ContractState {
  is_active: boolean;
  paused_by?: string;
}

/**
 * ASTRO Protocol Configuration
 * Defines how XLM is allocated during token graduation
 */
export interface AstroConfig {
  token_address: string;
  amm_address: string;
  liquidity_bps: string;
  buyback_bps: string;
}

/**
 * ASTRO Allocation breakdown for graduation
 */
export interface AstroAllocation {
  xlm_for_main_pool: string;
  xlm_for_astro_liquidity: string;
  xlm_for_buyback: string;
}

/**
 * Parameters for launching a new token
 */
export interface LaunchTokenParams {
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  // Optional social links (stored in metadata JSON)
  website?: string;
  telegram?: string;
  twitter?: string;
  discord?: string;
}

// ============================================================================
// Precision Utilities
// ============================================================================

/**
 * CRITICAL: Convert decimal amount to BigInt stroops WITHOUT precision loss
 *
 * Problem: Math.floor(0.1234567 * 10_000_000) can give wrong results due to
 * floating-point arithmetic issues (e.g., 0.1 + 0.2 = 0.30000000000000004)
 *
 * Solution: String-based conversion that handles decimals precisely
 *
 * @param amount - Amount in XLM or tokens (e.g., 1.2345678)
 * @param decimals - Number of decimal places (default 7 for Stellar)
 * @returns BigInt representation in smallest unit (stroops)
 *
 * @example
 * toStroopsBigInt(1.2345678) // 12345678n
 * toStroopsBigInt(100) // 1000000000n
 * toStroopsBigInt("0.0000001") // 1n
 */
export function toStroopsBigInt(amount: number | string, decimals: number = 7): bigint {
  // Convert to string to avoid floating-point issues
  const amountStr = typeof amount === 'number' ? amount.toString() : amount;

  // Handle negative numbers
  const isNegative = amountStr.startsWith('-');
  const absAmountStr = isNegative ? amountStr.slice(1) : amountStr;

  // Split into integer and decimal parts
  const parts = absAmountStr.split('.');
  const integerPart = parts[0] || '0';
  let decimalPart = parts[1] || '';

  // Pad or truncate decimal part to exact decimals length
  if (decimalPart.length > decimals) {
    // Truncate (don't round - match Math.floor behavior)
    decimalPart = decimalPart.slice(0, decimals);
  } else {
    // Pad with zeros
    decimalPart = decimalPart.padEnd(decimals, '0');
  }

  // Combine and convert to BigInt
  const combined = integerPart + decimalPart;
  const result = BigInt(combined);

  return isNegative ? -result : result;
}

/**
 * SAC Factory Service
 */
export class SacFactoryService extends BaseContractService {
  constructor() {
    // Use environment variable or fallback to V7 Contract ID (Dec 3, 2024 - pump.fun style, 30k XLM graduation)
    const contractId = CONTRACT_IDS.tokenFactory || 'CBNQZ3NE5CUAZVDTI34FGMABOV26EOHGCVXU5F7KLRFSGMC33W7U225Z';

    if (!CONTRACT_IDS.tokenFactory) {
      logger.warn(
        'SAC Factory contract ID not configured in env vars. Using fallback: CBNQZ3NE5CUAZVDTI34FGMABOV26EOHGCVXU5F7KLRFSGMC33W7U225Z'
      );
    }

    super(contractId);
  }

  // ========== Read-Only Methods ==========

  /**
   * Get information about a specific token by its address
   *
   * @param tokenAddress - Token contract address
   * @returns Token information or null if not found
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      const result = await this.callReadOnly(
        'get_token_info',
        addressToScVal(tokenAddress)
      );

      if (!result) {
        logger.debug(`getTokenInfo(${tokenAddress}): No result from contract`);
        return null;
      }

      // Parse raw contract response
      const rawData = fromScVal(result) as RawTokenInfo;
      logger.debug(`getTokenInfo(${tokenAddress}): Received raw data:`, rawData as any);

      // Handle Option<TokenInfo> - contract returns Some(TokenInfo) or None
      if (!rawData || rawData === null) {
        logger.debug(`getTokenInfo(${tokenAddress}): Data is null or undefined`);
        return null;
      }

      // Validate required fields
      if (!rawData.token_address || !rawData.name || !rawData.symbol) {
        logger.warn('Token data missing required fields:', rawData as any);
        return null;
      }

      // Check if bonding_curve exists
      if (!rawData.bonding_curve) {
        logger.warn('Token bonding_curve is null/undefined:', rawData as any);
        return null;
      }

      // Use adapter to normalize contract response
      const tokenInfo = adaptTokenInfo(rawData);

      // Validate bonding curve invariant (k = x * y)
      const isValidCurve = validateBondingCurveInvariant(tokenInfo.bonding_curve);
      if (!isValidCurve) {
        logger.warn(`getTokenInfo(${tokenAddress}): Bonding curve invariant check failed`);
      }

      logger.debug(`getTokenInfo(${tokenAddress}): Successfully adapted token info`, {
        status: tokenInfo.status,
        token_reserve: tokenInfo.bonding_curve.token_reserve,
        xlm_reserve: tokenInfo.bonding_curve.xlm_reserve,
      });

      return tokenInfo;
    } catch (error) {
      logger.error('Error fetching token info:', error);
      return null;
    }
  }

  /**
   * Get current price for 1 token (in stroops)
   *
   * @param tokenAddress - Token contract address
   * @returns Price in stroops (XLM * 10^7)
   */
  async getPrice(tokenAddress: string): Promise<bigint> {
    try {
      const result = await this.callReadOnly(
        'get_price',
        addressToScVal(tokenAddress)
      );

      if (!result) return BigInt(0);

      return BigInt(fromScVal(result) as string | number | bigint);
    } catch (error) {
      logger.error('Error fetching price:', error);
      return BigInt(0);
    }
  }

  /**
   * Get graduation progress (0-10000 = 0%-100%)
   *
   * @param tokenAddress - Token contract address
   * @returns Progress in basis points (0-10000)
   */
  async getGraduationProgress(tokenAddress: string): Promise<number> {
    try {
      const result = await this.callReadOnly(
        'get_graduation_progress',
        addressToScVal(tokenAddress)
      );

      if (!result) return 0;

      return Number(fromScVal(result));
    } catch (error) {
      logger.error('Error fetching graduation progress:', error);
      return 0;
    }
  }

  /**
   * Get all tokens created by a specific address
   * ⚠️ Use with caution - may be large. Prefer getCreatorTokensPaginated.
   *
   * @param creatorAddress - Creator's Stellar address
   * @returns Array of token addresses
   */
  async getCreatorTokens(creatorAddress: string): Promise<string[]> {
    try {
      const result = await this.callReadOnly(
        'get_creator_tokens',
        addressToScVal(creatorAddress)
      );

      if (!result) return [];

      const addresses = fromScVal(result) as StellarAddress[];
      return addresses.map((addr) => addr.toString());
    } catch (error) {
      logger.error('Error fetching creator tokens:', error);
      return [];
    }
  }

  /**
   * Get creator's tokens with pagination (recommended)
   *
   * @param creatorAddress - Creator's Stellar address
   * @param offset - Starting index
   * @param limit - Max items to return (capped at 100)
   * @returns Paginated array of token addresses
   */
  async getCreatorTokensPaginated(
    creatorAddress: string,
    offset: number = 0,
    limit: number = 10
  ): Promise<string[]> {
    try {
      const result = await this.callReadOnly(
        'get_creator_tokens_paginated',
        addressToScVal(creatorAddress),
        xdr.ScVal.scvU32(offset),
        xdr.ScVal.scvU32(limit)
      );

      if (!result) return [];

      const addresses = fromScVal(result) as StellarAddress[];
      logger.debug(`getCreatorTokensPaginated(${creatorAddress}): Found ${addresses?.length || 0} tokens`, { addresses });
      return addresses.map((addr) => addr.toString());
    } catch (error) {
      logger.error('Error fetching creator tokens paginated:', error);
      return [];
    }
  }

  /**
   * Get total number of tokens created
   *
   * @returns Total token count
   */
  async getTokenCount(): Promise<number> {
    try {
      const result = await this.callReadOnly('get_token_count');

      if (!result) return 0;

      return Number(fromScVal(result));
    } catch (error) {
      logger.error('Error fetching token count:', error);
      return 0;
    }
  }

  /**
   * Get fee configuration
   *
   * @returns Fee configuration
   */
  async getFeeConfig(): Promise<FeeConfig> {
    try {
      const result = await this.callReadOnly('get_fee_config');

      if (!result) {
        return {
          creation_fee: '100000', // 0.01 XLM default
          trading_fee_bps: '30', // 0.3% default (0.05% protocol + 0.25% LP)
          treasury: '',
        };
      }

      const data = fromScVal(result) as {
        creation_fee: bigint;
        trading_fee_bps: bigint;
        treasury: StellarAddress;
      };

      return {
        creation_fee: data.creation_fee.toString(),
        trading_fee_bps: data.trading_fee_bps.toString(),
        treasury: data.treasury.toString(),
      };
    } catch (error) {
      logger.error('Error fetching fee config:', error);
      return {
        creation_fee: '100000',
        trading_fee_bps: '30', // 0.3% default (0.05% protocol + 0.25% LP)
        treasury: '',
      };
    }
  }

  /**
   * Get contract state (active/paused)
   *
   * @returns Contract state
   */
  async getState(): Promise<ContractState> {
    try {
      const result = await this.callReadOnly('get_state');

      if (!result) return { is_active: true };

      const data = fromScVal(result) as {
        is_active: boolean;
        paused_by?: string;
      };

      return {
        is_active: data.is_active,
        paused_by: data.paused_by,
      };
    } catch (error) {
      logger.error('Error fetching contract state:', error);
      return { is_active: true };
    }
  }

  // ========== ASTRO Integration Methods ==========

  /**
   * Get ASTRO protocol configuration
   *
   * @returns ASTRO config or null if not configured
   */
  async getAstroConfig(): Promise<AstroConfig | null> {
    try {
      const result = await this.callReadOnly('get_astro_config');

      if (!result) return null;

      const data = fromScVal(result) as {
        token_address: string;
        amm_address: string;
        liquidity_bps: bigint;
        buyback_bps: bigint;
      } | null;

      if (!data) return null;

      return {
        token_address: data.token_address.toString(),
        amm_address: data.amm_address.toString(),
        liquidity_bps: data.liquidity_bps.toString(),
        buyback_bps: data.buyback_bps.toString(),
      };
    } catch (error) {
      logger.error('Error fetching ASTRO config:', error);
      return null;
    }
  }

  /**
   * Check if ASTRO integration is enabled
   *
   * @returns true if ASTRO is configured
   */
  async isAstroEnabled(): Promise<boolean> {
    try {
      const result = await this.callReadOnly('is_astro_enabled');

      if (!result) return false;

      return Boolean(fromScVal(result));
    } catch (error) {
      logger.error('Error checking ASTRO status:', error);
      return false;
    }
  }

  /**
   * Calculate ASTRO allocation for graduation
   * Client-side calculation matching contract logic
   *
   * @param totalXlm - Total XLM raised during bonding curve
   * @param liquidityBps - ASTRO liquidity basis points (default 1000 = 10%)
   * @param buybackBps - Buyback basis points (default 500 = 5%)
   * @returns Allocation breakdown
   */
  calculateAstroAllocation(
    totalXlm: bigint,
    liquidityBps: number = 1000,
    buybackBps: number = 500
  ): AstroAllocation {
    const totalAstroBps = BigInt(liquidityBps + buybackBps);
    const mainPoolBps = BigInt(10000) - totalAstroBps;

    const xlmForMain = (totalXlm * mainPoolBps) / BigInt(10000);
    const xlmForLiquidity = (totalXlm * BigInt(liquidityBps)) / BigInt(10000);
    const xlmForBuyback = (totalXlm * BigInt(buybackBps)) / BigInt(10000);

    return {
      xlm_for_main_pool: xlmForMain.toString(),
      xlm_for_astro_liquidity: xlmForLiquidity.toString(),
      xlm_for_buyback: xlmForBuyback.toString(),
    };
  }

  /**
   * Get allocation percentages for display
   *
   * @param liquidityBps - ASTRO liquidity basis points
   * @param buybackBps - Buyback basis points
   * @returns Object with percentage strings
   */
  getAstroAllocationPercentages(
    liquidityBps: number = 1000,
    buybackBps: number = 500
  ): { mainPool: string; astroLiquidity: string; buyback: string } {
    const totalAstroBps = liquidityBps + buybackBps;
    const mainPoolBps = 10000 - totalAstroBps;

    return {
      mainPool: `${(mainPoolBps / 100).toFixed(0)}%`,
      astroLiquidity: `${(liquidityBps / 100).toFixed(0)}%`,
      buyback: `${(buybackBps / 100).toFixed(0)}%`,
    };
  }

  // ========== Write Methods (Build Operations) ==========

  /**
   * Build operation to launch a new token using V2 (pure Soroban tokens)
   *
   * V2 creates pure Soroban tokens that are:
   * - Fully managed by the factory (admin)
   * - No SAC issuer restrictions
   * - Simple, streamlined deployment
   *
   * @param params - Token launch parameters
   * @param creatorAddress - Creator's Stellar address
   * @returns Operation (no issuer keypair needed - factory is admin)
   */
  buildLaunchTokenV2Operation(
    params: LaunchTokenParams,
    creatorAddress: string
  ): xdr.Operation {
    // Validate inputs
    if (!validateName(params.name)) {
      throw new Error('Name must be 1-32 characters');
    }

    if (!validateSymbol(params.symbol)) {
      throw new Error('Symbol must be 1-12 alphanumeric characters (uppercase)');
    }

    // Build description with embedded metadata JSON for social links
    // Format: "Description text\n\n---METADATA---\n{json}"
    // This allows social links to be stored on-chain without contract changes
    let finalDescription = params.description;

    const socialLinks: Record<string, string> = {};
    if (params.website) socialLinks.website = params.website;
    if (params.telegram) socialLinks.telegram = params.telegram;
    if (params.twitter) socialLinks.twitter = params.twitter;
    if (params.discord) socialLinks.discord = params.discord;

    if (Object.keys(socialLinks).length > 0) {
      const metadata = JSON.stringify({ social: socialLinks });
      finalDescription = `${params.description}\n\n---METADATA---\n${metadata}`;
    }

    // Build contract call arguments for launch_token_v2
    // Signature: launch_token_v2(creator, name, symbol, image_url, description)
    const args: xdr.ScVal[] = [
      addressToScVal(creatorAddress),               // creator: Address
      toScVal(params.name),                         // name: String
      toScVal(params.symbol),                       // symbol: String
      toScVal(params.imageUrl),                     // image_url: String
      toScVal(finalDescription),                    // description: String (with embedded metadata)
    ];

    return this.buildOperation('launch_token_v2', ...args);
  }

  /**
   * Build operation to buy tokens from bonding curve
   *
   * @param buyerAddress - Buyer's Stellar address
   * @param tokenAddress - Token contract address
   * @param xlmAmount - Amount of XLM to spend (in stroops)
   * @param minTokens - Minimum tokens to receive (slippage protection)
   * @param deadline - Transaction deadline timestamp (MEV protection)
   * @returns Transaction operation
   *
   * **BREAKING CHANGE (Sprint 1 Day 1):**
   * Now requires `deadline` parameter for MEV protection.
   * Example: `Date.now() + 300` (5 minutes from now)
   */
  buildBuyOperation(
    buyerAddress: string,
    tokenAddress: string,
    xlmAmount: bigint,
    minTokens: bigint,
    deadline: bigint
  ): xdr.Operation {
    return this.buildOperation(
      'buy',
      addressToScVal(buyerAddress),
      addressToScVal(tokenAddress),
      nativeToScVal(xlmAmount, { type: 'i128' }),
      nativeToScVal(minTokens, { type: 'i128' }),
      nativeToScVal(deadline, { type: 'u64' })
    );
  }

  /**
   * Build operation to sell tokens back to bonding curve
   *
   * @param sellerAddress - Seller's Stellar address
   * @param tokenAddress - Token contract address
   * @param tokenAmount - Amount of tokens to sell
   * @param minXlm - Minimum XLM to receive (slippage protection)
   * @param deadline - Transaction deadline timestamp (MEV protection)
   * @returns Transaction operation
   *
   * **BREAKING CHANGE (Sprint 1 Day 1):**
   * Now requires `deadline` parameter for MEV protection.
   * Example: `Date.now() + 300` (5 minutes from now)
   */
  buildSellOperation(
    sellerAddress: string,
    tokenAddress: string,
    tokenAmount: bigint,
    minXlm: bigint,
    deadline: bigint
  ): xdr.Operation {
    return this.buildOperation(
      'sell',
      addressToScVal(sellerAddress),
      addressToScVal(tokenAddress),
      nativeToScVal(tokenAmount, { type: 'i128' }),
      nativeToScVal(minXlm, { type: 'i128' }),
      nativeToScVal(deadline, { type: 'u64' })
    );
  }

  /**
   * Prepare a buy transaction for signing
   * Returns the transaction XDR that needs to be signed by the user's wallet
   *
   * @param tokenAddress - Token contract address
   * @param xlmAmount - Amount of XLM to spend (in XLM, not stroops)
   * @param buyerAddress - Buyer's Stellar address
   * @param slippagePercent - Slippage tolerance (default 1%)
   * @returns Prepared transaction XDR ready for signing
   */
  async prepareBuyTransaction(
    tokenAddress: string,
    xlmAmount: number,
    buyerAddress: string,
    slippagePercent: number = 1
  ): Promise<{ txXDR: string; expectedTokens: bigint }> {
    // Convert XLM to stroops using precision-safe conversion
    const xlmAmountStroops = toStroopsBigInt(xlmAmount);

    // Get token info to calculate min tokens
    const tokenInfo = await this.getTokenInfo(tokenAddress);
    if (!tokenInfo) {
      throw new Error('Token not found');
    }

    // Calculate expected output
    const expectedTokens = this.calculateBuyOutput(tokenInfo, xlmAmountStroops);

    // Apply slippage tolerance using basis points for precision (100 bps = 1%)
    // This prevents precision loss for fractional slippage like 1.5%
    const slippageBps = BigInt(Math.floor(slippagePercent * 100));
    const minTokens = (expectedTokens * (BigInt(10000) - slippageBps)) / BigInt(10000);

    // Set deadline (5 minutes from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    // Build operation
    const operation = this.buildBuyOperation(
      buyerAddress,
      tokenAddress,
      xlmAmountStroops,
      minTokens,
      deadline
    );

    // Prepare transaction for signing
    const prepared = await this.prepareTransaction(buyerAddress, operation);

    return {
      txXDR: prepared.txXDR,
      expectedTokens,
    };
  }

  /**
   * Submit a signed buy transaction
   *
   * @param signedTxXDR - The signed transaction XDR
   * @returns Transaction result
   */
  async submitBuyTransaction(signedTxXDR: string): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const { hash } = await this.submitSignedTransaction(signedTxXDR);
      return {
        success: true,
        hash,
      };
    } catch (error: unknown) {
      logger.error('Submit buy transaction error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Prepare a buy transaction with automatic trustline creation
   *
   * This is the KEY method for seamless UX:
   * - Checks if buyer has trustline for the token
   * - If not, returns a trustline transaction to sign first
   * - Returns the buy transaction
   *
   * The frontend should:
   * 1. Call this method
   * 2. If needsTrustline is true, have user sign and submit trustlineTxXDR first
   * 3. Then have user sign and submit buyTxXDR
   *
   * @param tokenAddress - Token contract address
   * @param xlmAmount - Amount of XLM to spend (in XLM, not stroops)
   * @param buyerAddress - Buyer's Stellar address
   * @param slippagePercent - Slippage tolerance (default 1%)
   * @returns Prepared transactions (trustline if needed + buy)
   */
  async prepareBuyWithTrustline(
    tokenAddress: string,
    xlmAmount: number,
    buyerAddress: string,
    slippagePercent: number = 1
  ): Promise<{
    needsTrustline: boolean;
    trustlineTxXDR?: string;
    buyTxXDR: string;
    expectedTokens: bigint;
    tokenInfo: TokenInfo;
  }> {
    // Get token info (includes issuer for trustline)
    const tokenInfo = await this.getTokenInfo(tokenAddress);
    if (!tokenInfo) {
      throw new Error('Token not found');
    }

    // Check if buyer has trustline
    let needsTrustline = false;
    let trustlineTxXDR: string | undefined;

    try {
      const config = (await import('../config')).getNetworkConfig();
      const horizonServer = new Horizon.Server(config.horizonUrl);
      const account = await horizonServer.loadAccount(buyerAddress);

      // Check for existing trustline
      const hasTrustline = account.balances.some((balance: Horizon.HorizonApi.BalanceLine) => {
        if (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') {
          const assetBalance = balance as Horizon.HorizonApi.BalanceLineAsset;
          return (
            assetBalance.asset_code === tokenInfo.symbol &&
            assetBalance.asset_issuer === tokenInfo.issuer
          );
        }
        return false;
      });

      if (!hasTrustline) {
        needsTrustline = true;

        // Build trustline transaction
        const asset = new Asset(tokenInfo.symbol, tokenInfo.issuer);
        const trustlineTx = new TransactionBuilder(account, {
          fee: '100000', // 0.01 XLM
          networkPassphrase: config.networkPassphrase,
        })
          .addOperation(Operation.changeTrust({ asset }))
          .setTimeout(300)
          .build();

        trustlineTxXDR = trustlineTx.toXDR();

        logger.info('Trustline needed for buy', {
          buyer: buyerAddress,
          symbol: tokenInfo.symbol,
          issuer: tokenInfo.issuer,
        });
      }
    } catch (error) {
      logger.error('Error checking trustline:', error);
      // If we can't check, assume we need trustline and try to build it
      needsTrustline = true;

      // Try to build trustline transaction even in error case
      try {
        const config = (await import('../config')).getNetworkConfig();
        const horizonServer = new Horizon.Server(config.horizonUrl);
        const account = await horizonServer.loadAccount(buyerAddress);

        const asset = new Asset(tokenInfo.symbol, tokenInfo.issuer);
        const trustlineTx = new TransactionBuilder(account, {
          fee: '100000',
          networkPassphrase: config.networkPassphrase,
        })
          .addOperation(Operation.changeTrust({ asset }))
          .setTimeout(300)
          .build();

        trustlineTxXDR = trustlineTx.toXDR();
      } catch (buildError) {
        logger.error('Error building fallback trustline:', buildError);
      }
    }

    // If trustline is needed, don't try to prepare buy transaction yet
    // It will fail simulation because the trustline doesn't exist
    // The caller should create the trustline first, then call prepareBuyTransaction
    if (needsTrustline) {
      // Calculate expected tokens for display purposes
      const xlmAmountStroops = toStroopsBigInt(xlmAmount);
      const expectedTokens = this.calculateBuyOutput(tokenInfo, xlmAmountStroops);

      if (!trustlineTxXDR) {
        throw new Error('Unable to create trustline transaction. Please try again.');
      }

      return {
        needsTrustline: true,
        trustlineTxXDR,
        buyTxXDR: '', // Empty - caller must prepare after trustline is created
        expectedTokens,
        tokenInfo,
      };
    }

    // Prepare the buy transaction (only if trustline already exists)
    const { txXDR: buyTxXDR, expectedTokens } = await this.prepareBuyTransaction(
      tokenAddress,
      xlmAmount,
      buyerAddress,
      slippagePercent
    );

    return {
      needsTrustline: false,
      trustlineTxXDR,
      buyTxXDR,
      expectedTokens,
      tokenInfo,
    };
  }

  /**
   * Submit a trustline transaction
   *
   * @param signedTxXDR - The signed trustline transaction XDR
   * @returns Transaction result
   */
  async submitTrustlineTransaction(
    signedTxXDR: string
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const config = (await import('../config')).getNetworkConfig();
      const horizonServer = new Horizon.Server(config.horizonUrl);

      const transaction = TransactionBuilder.fromXDR(signedTxXDR, config.networkPassphrase);
      const result = await horizonServer.submitTransaction(
        transaction as Parameters<typeof horizonServer.submitTransaction>[0]
      );

      logger.info('Trustline transaction submitted', { hash: result.hash });
      return { success: true, hash: result.hash };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { extras?: { result_codes?: unknown } } }; message?: string };
      logger.error('Trustline submission error:', error);
      return {
        success: false,
        error: err.response?.data?.extras?.result_codes
          ? JSON.stringify(err.response.data.extras.result_codes)
          : err.message || 'Unknown error'
      };
    }
  }

  /**
   * Buy tokens - High-level method for trading interface
   * DEPRECATED: Use prepareBuyTransaction + signTransaction + submitBuyTransaction instead
   *
   * @param tokenAddress - Token contract address
   * @param xlmAmount - Amount of XLM to spend (in XLM, not stroops)
   * @param buyerAddress - Buyer's Stellar address
   * @param slippagePercent - Slippage tolerance (default 1%)
   * @returns Transaction result
   */
  async buyTokens(
    tokenAddress: string,
    xlmAmount: number,
    buyerAddress: string,
    slippagePercent: number = 1
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert XLM to stroops using precision-safe conversion
      const xlmAmountStroops = toStroopsBigInt(xlmAmount);

      // Get token info to calculate min tokens
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        return { success: false, error: 'Token not found' };
      }

      // Calculate expected output
      const expectedTokens = this.calculateBuyOutput(tokenInfo, xlmAmountStroops);

      // Apply slippage tolerance
      const minTokens = (expectedTokens * BigInt(100 - slippagePercent)) / BigInt(100);

      // Set deadline (5 minutes from now) - Date.now()/1000 is an integer so Math.floor is safe
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      // Build and execute operation
      const operation = this.buildBuyOperation(
        buyerAddress,
        tokenAddress,
        xlmAmountStroops,
        minTokens,
        deadline
      );

      // Note: This method cannot sign - use prepareBuyTransaction flow instead
      logger.warn('buyTokens() called but cannot sign without wallet. Use prepareBuyTransaction + submitBuyTransaction flow.');
      return { success: false, error: 'Use prepareBuyTransaction flow for real transactions' };
    } catch (error: unknown) {
      logger.error('Buy tokens error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Prepare a sell transaction for signing
   * Returns the transaction XDR that needs to be signed by the user's wallet
   *
   * @param tokenAddress - Token contract address
   * @param tokenAmount - Amount of tokens to sell (in tokens, not smallest unit)
   * @param sellerAddress - Seller's Stellar address
   * @param slippagePercent - Slippage tolerance (default 1%)
   * @returns Prepared transaction XDR ready for signing
   */
  async prepareSellTransaction(
    tokenAddress: string,
    tokenAmount: number,
    sellerAddress: string,
    slippagePercent: number = 1
  ): Promise<{ txXDR: string; expectedXlm: bigint }> {
    // Convert to smallest unit using precision-safe conversion (7 decimals for SAC tokens)
    const tokenAmountSmallest = toStroopsBigInt(tokenAmount);

    // Get token info to calculate min XLM
    const tokenInfo = await this.getTokenInfo(tokenAddress);
    if (!tokenInfo) {
      throw new Error('Token not found');
    }

    // Calculate expected output
    const expectedXlm = this.calculateSellOutput(tokenInfo, tokenAmountSmallest);

    // Apply slippage tolerance
    // Apply slippage tolerance using basis points for precision (100 bps = 1%)
    const slippageBps = BigInt(Math.floor(slippagePercent * 100));
    const minXlm = (expectedXlm * (BigInt(10000) - slippageBps)) / BigInt(10000);

    // Set deadline (5 minutes from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    // Build operation
    const operation = this.buildSellOperation(
      sellerAddress,
      tokenAddress,
      tokenAmountSmallest,
      minXlm,
      deadline
    );

    // Prepare transaction for signing
    const prepared = await this.prepareTransaction(sellerAddress, operation);

    return {
      txXDR: prepared.txXDR,
      expectedXlm,
    };
  }

  /**
   * Submit a signed sell transaction
   *
   * @param signedTxXDR - The signed transaction XDR
   * @returns Transaction result
   */
  async submitSellTransaction(signedTxXDR: string): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const { hash } = await this.submitSignedTransaction(signedTxXDR);
      return {
        success: true,
        hash,
      };
    } catch (error: unknown) {
      logger.error('Submit sell transaction error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sell tokens - High-level method for trading interface
   * DEPRECATED: Use prepareSellTransaction + signTransaction + submitSellTransaction instead
   *
   * @param tokenAddress - Token contract address
   * @param tokenAmount - Amount of tokens to sell (in tokens, not smallest unit)
   * @param sellerAddress - Seller's Stellar address
   * @param slippagePercent - Slippage tolerance (default 1%)
   * @returns Transaction result
   */
  async sellTokens(
    tokenAddress: string,
    tokenAmount: number,
    sellerAddress: string,
    slippagePercent: number = 1
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert to smallest unit using precision-safe conversion (7 decimals for SAC tokens)
      const tokenAmountSmallest = toStroopsBigInt(tokenAmount);

      // Get token info to calculate min XLM
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        return { success: false, error: 'Token not found' };
      }

      // Calculate expected output
      const expectedXlm = this.calculateSellOutput(tokenInfo, tokenAmountSmallest);

      // Apply slippage tolerance
      // Apply slippage tolerance using basis points for precision (100 bps = 1%)
    const slippageBps = BigInt(Math.floor(slippagePercent * 100));
    const minXlm = (expectedXlm * (BigInt(10000) - slippageBps)) / BigInt(10000);

      // Set deadline (5 minutes from now) - Date.now()/1000 is an integer so Math.floor is safe
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      // Build and execute operation
      const operation = this.buildSellOperation(
        sellerAddress,
        tokenAddress,
        tokenAmountSmallest,
        minXlm,
        deadline
      );

      // Note: This method cannot sign - use prepareSellTransaction flow instead
      logger.warn('sellTokens() called but cannot sign without wallet. Use prepareSellTransaction + submitSellTransaction flow.');
      return { success: false, error: 'Use prepareSellTransaction flow for real transactions' };
    } catch (error: unknown) {
      logger.error('Sell tokens error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  // ========== Helper Methods ==========

  /**
   * Calculate buy output (for display purposes)
   *
   * Uses bonding curve formula: tokens_out = token_reserve - (k / (xlm_reserve + xlm_in))
   *
   * @param tokenInfo - Token information with bonding curve state
   * @param xlmAmount - Amount of XLM to spend
   * @returns Estimated tokens to receive (before fees)
   */
  calculateBuyOutput(tokenInfo: TokenInfo, xlmAmount: bigint): bigint {
    try {
      const result = calculateBuyOutputUtil(tokenInfo.bonding_curve, xlmAmount);
      return result.amountOut;
    } catch (error) {
      logger.error('Error calculating buy output:', error);
      return BigInt(0);
    }
  }

  /**
   * Calculate sell output (for display purposes)
   *
   * Uses bonding curve formula: xlm_out = xlm_reserve - (k / (token_reserve + tokens_in))
   *
   * @param tokenInfo - Token information with bonding curve state
   * @param tokenAmount - Amount of tokens to sell
   * @returns Estimated XLM to receive
   */
  calculateSellOutput(tokenInfo: TokenInfo, tokenAmount: bigint): bigint {
    try {
      const result = calculateSellOutputUtil(tokenInfo.bonding_curve, tokenAmount);
      return result.amountOut;
    } catch (error) {
      logger.error('Error calculating sell output:', error);
      return BigInt(0);
    }
  }

  /**
   * Apply trading fee (0.3% default = 0.05% protocol + 0.25% LP)
   *
   * @param amount - Amount before fee
   * @param feeBps - Fee in basis points (30 = 0.3%)
   * @returns Amount after fee
   */
  applyTradingFee(amount: bigint, feeBps: bigint = BigInt(30)): bigint {
    const fee = (amount * feeBps) / BigInt(10000);
    return amount - fee;
  }

  // ========== Anti-Whale Debug Methods ==========

  /**
   * Get wallet's tracked holdings from the anti-whale module
   *
   * This returns the INTERNAL tracking used by the contract for anti-whale validation,
   * which may differ from the actual token balance if there's desynchronization.
   *
   * @param walletAddress - Wallet address to check
   * @returns Tracked holdings in token units (with 7 decimals)
   */
  async getWalletTrackedHoldings(walletAddress: string): Promise<bigint> {
    try {
      const result = await this.callReadOnly(
        'get_wallet_holdings',
        addressToScVal(walletAddress)
      );

      if (!result) return BigInt(0);

      return BigInt(fromScVal(result) as string | number | bigint);
    } catch (error) {
      logger.error('Error fetching wallet tracked holdings:', error);
      return BigInt(0);
    }
  }

  /**
   * Get anti-whale configuration
   *
   * @returns Anti-whale config
   */
  async getAntiWhaleConfig(): Promise<{
    absolute_max_holdings_bps: number;
    cooldown_seconds: number;
    enabled: boolean;
  }> {
    try {
      const result = await this.callReadOnly('get_anti_whale_config');

      if (!result) {
        return {
          absolute_max_holdings_bps: 5000, // 50% default
          cooldown_seconds: 10,
          enabled: true,
        };
      }

      const data = fromScVal(result) as {
        absolute_max_holdings_bps: bigint;
        cooldown_seconds: bigint;
        enabled: boolean;
      };

      return {
        absolute_max_holdings_bps: Number(data.absolute_max_holdings_bps),
        cooldown_seconds: Number(data.cooldown_seconds),
        enabled: data.enabled,
      };
    } catch (error) {
      logger.error('Error fetching anti-whale config:', error);
      return {
        absolute_max_holdings_bps: 5000,
        cooldown_seconds: 10,
        enabled: true,
      };
    }
  }

  /**
   * Check if anti-whale protection is enabled
   *
   * @returns true if enabled
   */
  async isAntiWhaleEnabled(): Promise<boolean> {
    try {
      const result = await this.callReadOnly('is_anti_whale_enabled');

      if (!result) return true; // Assume enabled if we can't check

      return Boolean(fromScVal(result));
    } catch (error) {
      logger.error('Error checking anti-whale status:', error);
      return true;
    }
  }

  /**
   * Build operation to reset wallet holdings tracking (Owner only)
   *
   * This is useful for fixing desynchronization between internal tracking
   * and actual token balances.
   *
   * @param adminAddress - Owner address
   * @param walletAddress - Wallet to reset
   * @param actualBalance - The actual token balance (in stroops with 7 decimals)
   * @returns Transaction operation
   */
  buildResetWalletHoldingsOperation(
    adminAddress: string,
    walletAddress: string,
    actualBalance: bigint
  ): xdr.Operation {
    return this.buildOperation(
      'reset_wallet_holdings',
      addressToScVal(adminAddress),
      addressToScVal(walletAddress),
      nativeToScVal(actualBalance, { type: 'i128' })
    );
  }

  /**
   * Build operation to clear wallet holdings tracking completely (Owner only)
   *
   * Sets tracked holdings to 0 and clears the last buy timestamp.
   *
   * @param adminAddress - Owner address
   * @param walletAddress - Wallet to clear
   * @returns Transaction operation
   */
  buildClearWalletHoldingsOperation(
    adminAddress: string,
    walletAddress: string
  ): xdr.Operation {
    return this.buildOperation(
      'clear_wallet_holdings',
      addressToScVal(adminAddress),
      addressToScVal(walletAddress)
    );
  }

  /**
   * Prepare a reset wallet holdings transaction for signing
   *
   * @param adminAddress - Owner address
   * @param walletAddress - Wallet to reset
   * @param actualBalance - The actual token balance (in tokens, not stroops)
   * @returns Prepared transaction XDR ready for signing
   */
  async prepareResetWalletHoldingsTransaction(
    adminAddress: string,
    walletAddress: string,
    actualBalance: number
  ): Promise<{ txXDR: string }> {
    // Convert to stroops using precision-safe conversion (7 decimals)
    const actualBalanceStroops = toStroopsBigInt(actualBalance);

    const operation = this.buildResetWalletHoldingsOperation(
      adminAddress,
      walletAddress,
      actualBalanceStroops
    );

    const prepared = await this.prepareTransaction(adminAddress, operation);

    return { txXDR: prepared.txXDR };
  }

  /**
   * Prepare a clear wallet holdings transaction for signing
   *
   * @param adminAddress - Owner address
   * @param walletAddress - Wallet to clear
   * @returns Prepared transaction XDR ready for signing
   */
  async prepareClearWalletHoldingsTransaction(
    adminAddress: string,
    walletAddress: string
  ): Promise<{ txXDR: string }> {
    const operation = this.buildClearWalletHoldingsOperation(
      adminAddress,
      walletAddress
    );

    const prepared = await this.prepareTransaction(adminAddress, operation);

    return { txXDR: prepared.txXDR };
  }
}

/**
 * Singleton instance of the SAC Factory Service
 */
export const sacFactoryService = new SacFactoryService();
