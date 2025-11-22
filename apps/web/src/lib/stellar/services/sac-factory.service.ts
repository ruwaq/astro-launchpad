/**
 * SAC Factory Contract Service
 *
 * Native integration with the deployed SAC Factory smart contract.
 * Provides methods for launching real SAC tokens, buying, selling,
 * and querying token information.
 *
 * Contract ID (Sprint 1): CDBBG4SY232EJ254PB3O3I42WOXRICFHBDJEY4R46JY42GZSESWKHO3F
 * Network: Stellar Testnet
 * Updated: November 21, 2024 (Sprint 1 Days 1-5)
 */

import { xdr, Address } from '@stellar/stellar-sdk';
import { BaseContractService } from './base-contract.service';
import { CONTRACT_IDS } from '../config';
import { toScVal, addressToScVal, fromScVal } from '../utils';
import {
  createAssetForLaunch,
  validateSymbol,
  validateName,
} from '../asset-utils';

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
 * Parameters for launching a new token
 */
export interface LaunchTokenParams {
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
}

/**
 * SAC Factory Service
 */
export class SacFactoryService extends BaseContractService {
  constructor() {
    const contractId = CONTRACT_IDS.tokenFactory;

    if (!contractId) {
      throw new Error(
        'SAC Factory contract ID not configured. ' +
        'Please set NEXT_PUBLIC_TESTNET_CONTRACT_ID in your .env.local file'
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
        console.log(`[DEBUG] getTokenInfo(${tokenAddress}): No result from contract`);
        return null;
      }

      const data = fromScVal(result);
      console.log(`[DEBUG] getTokenInfo(${tokenAddress}): Received data:`, data);

      // Handle Option<TokenInfo> - contract returns Some(TokenInfo) or None
      if (!data || data === null) {
        console.log(`[DEBUG] getTokenInfo(${tokenAddress}): Data is null or undefined`);
        return null;
      }

      // Validate required fields
      if (!data.token_address || !data.name || !data.symbol) {
        console.warn('Token data missing required fields:', data);
        return null;
      }

      // Check if bonding_curve exists and has required fields
      if (!data.bonding_curve) {
        console.warn('Token bonding_curve is null/undefined:', data);
        return null;
      }

      console.log(`[DEBUG] bonding_curve fields:`, {
        xlm_reserve: data.bonding_curve.xlm_reserve,
        xlm_reserve_type: typeof data.bonding_curve.xlm_reserve,
        token_reserve: data.bonding_curve.token_reserve,
        token_reserve_type: typeof data.bonding_curve.token_reserve,
        k: data.bonding_curve.k,
        k_type: typeof data.bonding_curve.k,
      });

      // Validate essential fields (xlm_reserve and k)
      if (typeof data.bonding_curve.xlm_reserve === 'undefined' ||
          typeof data.bonding_curve.k === 'undefined') {
        console.warn('Token bonding curve missing essential fields (xlm_reserve or k)');
        return null;
      }

      // WORKAROUND: Calculate token_reserve if missing
      // Formula: k = xlm_reserve * token_reserve → token_reserve = k / xlm_reserve
      if (typeof data.bonding_curve.token_reserve === 'undefined') {
        console.warn(`[WORKAROUND] token_reserve is undefined, calculating from k and xlm_reserve`);
        data.bonding_curve.token_reserve = data.bonding_curve.k / data.bonding_curve.xlm_reserve;
        console.log(`[WORKAROUND] Calculated token_reserve:`, data.bonding_curve.token_reserve);
      }

      return {
        id: data.id,
        creator: data.creator,
        token_address: data.token_address,
        name: data.name,
        symbol: data.symbol,
        image_url: data.image_url || '',
        description: data.description || '',
        created_at: data.created_at,
        status: data.status === 'Bonding' ? TokenStatus.Bonding : TokenStatus.Graduated,
        bonding_curve: {
          xlm_reserve: data.bonding_curve.xlm_reserve.toString(),
          token_reserve: data.bonding_curve.token_reserve.toString(),
          k: data.bonding_curve.k.toString(),
        },
        xlm_raised: data.xlm_raised?.toString() || '0',
        market_cap: data.market_cap?.toString() || '0',
        holders_count: data.holders_count || 0,
      };
    } catch (error) {
      console.error('Error fetching token info:', error);
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

      return BigInt(fromScVal(result));
    } catch (error) {
      console.error('Error fetching price:', error);
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
      console.error('Error fetching graduation progress:', error);
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

      const addresses = fromScVal(result);
      return addresses.map((addr: any) => addr.toString());
    } catch (error) {
      console.error('Error fetching creator tokens:', error);
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

      const addresses = fromScVal(result);
      console.log(`[DEBUG] getCreatorTokensPaginated(${creatorAddress}): Found ${addresses?.length || 0} tokens`, addresses);
      return addresses.map((addr: any) => addr.toString());
    } catch (error) {
      console.error('Error fetching creator tokens paginated:', error);
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
      console.error('Error fetching token count:', error);
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
          trading_fee_bps: '100', // 1% default
          treasury: '',
        };
      }

      const data = fromScVal(result);

      return {
        creation_fee: data.creation_fee.toString(),
        trading_fee_bps: data.trading_fee_bps.toString(),
        treasury: data.treasury,
      };
    } catch (error) {
      console.error('Error fetching fee config:', error);
      return {
        creation_fee: '100000',
        trading_fee_bps: '100',
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

      const data = fromScVal(result);

      return {
        is_active: data.is_active,
        paused_by: data.paused_by,
      };
    } catch (error) {
      console.error('Error fetching contract state:', error);
      return { is_active: true };
    }
  }

  // ========== Write Methods (Build Operations) ==========

  /**
   * Build operation to launch a new meme token
   *
   * This creates a REAL Stellar Asset Contract (SAC) token that is:
   * - Transferable
   * - Visible in wallets (Freighter, Lobstr, etc.)
   * - Compatible with all Stellar DEXs
   *
   * @param params - Token launch parameters
   * @param creatorAddress - Creator's Stellar address
   * @param tokenCount - Current token count from contract
   * @returns Transaction operation
   */
  buildLaunchTokenOperation(
    params: LaunchTokenParams,
    creatorAddress: string,
    tokenCount: number
  ): xdr.Operation {
    // Validate inputs
    if (!validateName(params.name)) {
      throw new Error('Name must be 1-32 characters');
    }

    if (!validateSymbol(params.symbol)) {
      throw new Error('Symbol must be 1-12 alphanumeric characters (uppercase)');
    }

    // Create unique asset XDR (client-side as per Stellar best practices)
    const assetCreation = createAssetForLaunch({
      symbol: params.symbol,
      creator: creatorAddress,
      tokenCount,
    });

    // Build contract call arguments
    const args: xdr.ScVal[] = [
      addressToScVal(creatorAddress),               // creator: Address
      toScVal(params.name),                         // name: String
      toScVal(params.symbol),                       // symbol: String
      toScVal(params.imageUrl),                     // image_url: String
      toScVal(params.description),                  // description: String
      assetCreation.serializedAssetScVal,           // serialized_asset: Bytes
    ];

    return this.buildOperation('launch_token', ...args);
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
      toScVal(xlmAmount.toString(), xdr.ScValType.scvI128()),
      toScVal(minTokens.toString(), xdr.ScValType.scvI128()),
      toScVal(deadline.toString(), xdr.ScValType.scvU64()) // NEW: deadline parameter
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
      toScVal(tokenAmount.toString(), xdr.ScValType.scvI128()),
      toScVal(minXlm.toString(), xdr.ScValType.scvI128()),
      toScVal(deadline.toString(), xdr.ScValType.scvU64()) // NEW: deadline parameter
    );
  }

  /**
   * Buy tokens - High-level method for trading interface
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
      // Convert XLM to stroops (1 XLM = 10,000,000 stroops)
      const xlmAmountStroops = BigInt(Math.floor(xlmAmount * 10_000_000));

      // Get token info to calculate min tokens
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        return { success: false, error: 'Token not found' };
      }

      // Calculate expected output
      const expectedTokens = this.calculateBuyOutput(tokenInfo, xlmAmountStroops);

      // Apply slippage tolerance
      const minTokens = (expectedTokens * BigInt(100 - slippagePercent)) / BigInt(100);

      // Set deadline (5 minutes from now)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      // Build and execute operation
      const operation = this.buildBuyOperation(
        buyerAddress,
        tokenAddress,
        xlmAmountStroops,
        minTokens,
        deadline
      );

      // Note: Actual transaction submission happens in the UI component
      // This method is currently a placeholder for the real implementation
      return { success: true };
    } catch (error: any) {
      console.error('Buy tokens error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sell tokens - High-level method for trading interface
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
      // Convert to smallest unit (7 decimals for SAC tokens)
      const tokenAmountSmallest = BigInt(Math.floor(tokenAmount * 10_000_000));

      // Get token info to calculate min XLM
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        return { success: false, error: 'Token not found' };
      }

      // Calculate expected output
      const expectedXlm = this.calculateSellOutput(tokenInfo, tokenAmountSmallest);

      // Apply slippage tolerance
      const minXlm = (expectedXlm * BigInt(100 - slippagePercent)) / BigInt(100);

      // Set deadline (5 minutes from now)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      // Build and execute operation
      const operation = this.buildSellOperation(
        sellerAddress,
        tokenAddress,
        tokenAmountSmallest,
        minXlm,
        deadline
      );

      // Note: Actual transaction submission happens in the UI component
      // This method is currently a placeholder for the real implementation
      return { success: true };
    } catch (error: any) {
      console.error('Sell tokens error:', error);
      return { success: false, error: error.message };
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
      const xlmReserve = BigInt(tokenInfo.bonding_curve.xlm_reserve);
      const tokenReserve = BigInt(tokenInfo.bonding_curve.token_reserve);
      const k = BigInt(tokenInfo.bonding_curve.k);

      const newXlmReserve = xlmReserve + xlmAmount;
      const newTokenReserve = k / newXlmReserve;
      const tokensOut = tokenReserve - newTokenReserve;

      return tokensOut;
    } catch (error) {
      console.error('Error calculating buy output:', error);
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
      const xlmReserve = BigInt(tokenInfo.bonding_curve.xlm_reserve);
      const tokenReserve = BigInt(tokenInfo.bonding_curve.token_reserve);
      const k = BigInt(tokenInfo.bonding_curve.k);

      const newTokenReserve = tokenReserve + tokenAmount;
      const newXlmReserve = k / newTokenReserve;
      const xlmOut = xlmReserve - newXlmReserve;

      return xlmOut;
    } catch (error) {
      console.error('Error calculating sell output:', error);
      return BigInt(0);
    }
  }

  /**
   * Apply trading fee (1% default)
   *
   * @param amount - Amount before fee
   * @param feeBps - Fee in basis points (100 = 1%)
   * @returns Amount after fee
   */
  applyTradingFee(amount: bigint, feeBps: bigint = BigInt(100)): bigint {
    const fee = (amount * feeBps) / BigInt(10000);
    return amount - fee;
  }
}

/**
 * Singleton instance of the SAC Factory Service
 */
export const sacFactoryService = new SacFactoryService();
