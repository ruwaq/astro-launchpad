/**
 * Stellar SDK Type Definitions
 * 
 * Provides strong typing for Stellar SDK interactions,
 * replacing 'any' types throughout the codebase.
 */

import { xdr, Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';

/**
 * Stellar Transaction Types
 */
export type StellarTransaction = Transaction | FeeBumpTransaction;

/**
 * ScVal Conversion Types
 */
export type ScValConvertible =
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | ScValConvertible[]
    | { [key: string]: ScValConvertible };

/**
 * Contract Call Result
 * Generic type for contract method return values
 */
export type ContractCallResult<T = unknown> = T | null;

/**
 * Address Types
 */
export interface StellarAddress {
    toString(): string;
}

/**
 * Soroban RPC Response Types
 */
export interface SimulationResult {
    success: boolean;
    result?: xdr.ScVal;
    error?: string;
}

/**
 * Transaction Builder Types
 */
export interface TransactionOptions {
    fee: string;
    networkPassphrase: string;
    timebounds?: {
        minTime: number;
        maxTime: number;
    };
}

/**
 * Contract Method Response
 */
export type ContractMethodResponse<T> = Promise<ContractCallResult<T>>;

/**
 * Token Data from GraphQL
 */
export interface TokenGraphQLData {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    creator: string;
    issuer?: string; // Asset issuer public key (G...) for trustline creation
    currentPrice: string;
    marketCap: string;
    volume24h: string;
    priceChange24h: string;
    holders: number;
    logoUrl?: string | null;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
    graduated?: boolean;
    xlmRaised?: string;
    xlmReserve?: string;
    circulatingSupply?: string;
}

/**
 * Pagination Edge Type
 */
export interface GraphQLEdge<T> {
    cursor: string;
    node: T;
}

/**
 * Pagination Connection Type
 */
export interface GraphQLConnection<T> {
    edges: GraphQLEdge<T>[];
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor?: string | null;
        endCursor?: string | null;
    };
    totalCount: number;
}

/**
 * Error Handler Types
 */
export interface StellarError {
    code: string;
    message: string;
    details?: unknown;
}

/**
 * Type Guards
 */
export function isStellarAddress(value: unknown): value is StellarAddress {
    return (
        typeof value === 'object' &&
        value !== null &&
        'toString' in value &&
        typeof (value as StellarAddress).toString === 'function'
    );
}

export function isScVal(value: unknown): value is xdr.ScVal {
    return value instanceof xdr.ScVal;
}
