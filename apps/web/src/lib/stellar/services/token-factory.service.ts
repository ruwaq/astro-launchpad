/**
 * Token Factory Contract Service
 *
 * Provides methods to interact with the Token Factory smart contract.
 * Handles token creation, buying, selling, and querying token information.
 */

import { xdr } from '@stellar/stellar-sdk';
import { BaseContractService } from './base-contract.service';
import { CONTRACT_IDS } from '../config';
import { toScVal, addressToScVal, fromScVal } from '../utils';

/**
 * Token information returned by the contract
 */
export interface TokenInfo {
  id: string;
  name: string;
  symbol: string;
  creator: string;
  imageUrl: string;
  description: string;
  totalSupply: bigint;
  currentPrice: bigint;
  marketCap: bigint;
  createdAt: number;
}

/**
 * Parameters for creating a new token
 */
export interface CreateTokenParams {
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  initialBuy?: bigint;
}

/**
 * Token Factory Service
 */
export class TokenFactoryService extends BaseContractService {
  constructor() {
    const contractId = CONTRACT_IDS.tokenFactory;

    if (!contractId) {
      throw new Error(
        'Token Factory contract ID not configured. ' +
        'Please set NEXT_PUBLIC_TESTNET_CONTRACT_ID in your .env.local file'
      );
    }

    super(contractId);
  }

  /**
   * Get information about a specific token
   */
  async getTokenInfo(tokenId: string): Promise<TokenInfo | null> {
    try {
      const result = await this.callReadOnly(
        'get_token_info',
        toScVal(tokenId)
      );

      if (!result) return null;

      const nativeResult = fromScVal(result);

      return {
        id: nativeResult.id,
        name: nativeResult.name,
        symbol: nativeResult.symbol,
        creator: nativeResult.creator,
        imageUrl: nativeResult.image_url,
        description: nativeResult.description,
        totalSupply: BigInt(nativeResult.total_supply),
        currentPrice: BigInt(nativeResult.current_price),
        marketCap: BigInt(nativeResult.market_cap),
        createdAt: nativeResult.created_at,
      };
    } catch (error) {
      console.error('Error fetching token info:', error);
      return null;
    }
  }

  /**
   * Get all tokens created through the factory
   */
  async getAllTokens(): Promise<TokenInfo[]> {
    try {
      const result = await this.callReadOnly('get_all_tokens');

      if (!result) return [];

      const nativeResult = fromScVal(result);

      return nativeResult.map((token: any) => ({
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        creator: token.creator,
        imageUrl: token.image_url,
        description: token.description,
        totalSupply: BigInt(token.total_supply),
        currentPrice: BigInt(token.current_price),
        marketCap: BigInt(token.market_cap),
        createdAt: token.created_at,
      }));
    } catch (error) {
      console.error('Error fetching all tokens:', error);
      return [];
    }
  }

  /**
   * Calculate buy price for a specific amount of tokens
   */
  async calculateBuyPrice(
    tokenId: string,
    amount: bigint
  ): Promise<bigint> {
    try {
      const result = await this.callReadOnly(
        'calculate_buy_price',
        toScVal(tokenId),
        toScVal(amount, xdr.ScValType.scvI128())
      );

      if (!result) return BigInt(0);

      return BigInt(fromScVal(result));
    } catch (error) {
      console.error('Error calculating buy price:', error);
      return BigInt(0);
    }
  }

  /**
   * Calculate sell price for a specific amount of tokens
   */
  async calculateSellPrice(
    tokenId: string,
    amount: bigint
  ): Promise<bigint> {
    try {
      const result = await this.callReadOnly(
        'calculate_sell_price',
        toScVal(tokenId),
        toScVal(amount, xdr.ScValType.scvI128())
      );

      if (!result) return BigInt(0);

      return BigInt(fromScVal(result));
    } catch (error) {
      console.error('Error calculating sell price:', error);
      return BigInt(0);
    }
  }

  /**
   * Build operation to create a new token
   */
  buildCreateTokenOperation(params: CreateTokenParams): xdr.Operation {
    const args: xdr.ScVal[] = [
      toScVal(params.name),
      toScVal(params.symbol),
      toScVal(params.imageUrl),
      toScVal(params.description),
    ];

    if (params.initialBuy !== undefined) {
      args.push(toScVal(params.initialBuy, xdr.ScValType.scvI128()));
    }

    return this.buildOperation('create_token', ...args);
  }

  /**
   * Build operation to buy tokens
   */
  buildBuyTokensOperation(
    tokenId: string,
    amount: bigint,
    maxPrice: bigint
  ): xdr.Operation {
    return this.buildOperation(
      'buy_tokens',
      toScVal(tokenId),
      toScVal(amount, xdr.ScValType.scvI128()),
      toScVal(maxPrice, xdr.ScValType.scvI128())
    );
  }

  /**
   * Build operation to sell tokens
   */
  buildSellTokensOperation(
    tokenId: string,
    amount: bigint,
    minPrice: bigint
  ): xdr.Operation {
    return this.buildOperation(
      'sell_tokens',
      toScVal(tokenId),
      toScVal(amount, xdr.ScValType.scvI128()),
      toScVal(minPrice, xdr.ScValType.scvI128())
    );
  }

  /**
   * Get tokens created by a specific address
   */
  async getTokensByCreator(creatorAddress: string): Promise<TokenInfo[]> {
    try {
      const result = await this.callReadOnly(
        'get_tokens_by_creator',
        addressToScVal(creatorAddress)
      );

      if (!result) return [];

      const nativeResult = fromScVal(result);

      return nativeResult.map((token: any) => ({
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        creator: token.creator,
        imageUrl: token.image_url,
        description: token.description,
        totalSupply: BigInt(token.total_supply),
        currentPrice: BigInt(token.current_price),
        marketCap: BigInt(token.market_cap),
        createdAt: token.created_at,
      }));
    } catch (error) {
      console.error('Error fetching tokens by creator:', error);
      return [];
    }
  }

  /**
   * Get user's token balance
   */
  async getTokenBalance(
    tokenId: string,
    userAddress: string
  ): Promise<bigint> {
    try {
      const result = await this.callReadOnly(
        'get_balance',
        toScVal(tokenId),
        addressToScVal(userAddress)
      );

      if (!result) return BigInt(0);

      return BigInt(fromScVal(result));
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return BigInt(0);
    }
  }
}

/**
 * Singleton instance of the Token Factory Service
 */
export const tokenFactoryService = new TokenFactoryService();
