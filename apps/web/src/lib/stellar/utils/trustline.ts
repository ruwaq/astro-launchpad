/**
 * Trustline Utilities for Stellar Asset Contracts (SAC)
 *
 * Before receiving SAC tokens, accounts need an authorized trustline.
 * This module provides utilities to check and create trustlines.
 */

import {
  Asset,
  Horizon,
  Operation,
  TransactionBuilder,
  BASE_FEE
} from '@stellar/stellar-sdk';
import { getNetworkConfig } from '@/lib/config/network';

export interface TrustlineStatus {
  exists: boolean;
  authorized: boolean;
  balance: string;
  limit: string;
}

/**
 * Check if an account has a trustline for a specific asset
 */
export async function checkTrustline(
  accountAddress: string,
  assetCode: string,
  assetIssuer: string
): Promise<TrustlineStatus> {
  const config = getNetworkConfig();
  const horizonServer = new Horizon.Server(config.horizonUrl);

  try {
    const account = await horizonServer.loadAccount(accountAddress);

    // Find the trustline for this asset
    const trustline = account.balances.find((balance: Horizon.HorizonApi.BalanceLine) => {
      if (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') {
        const assetBalance = balance as Horizon.HorizonApi.BalanceLineAsset;
        return assetBalance.asset_code === assetCode && assetBalance.asset_issuer === assetIssuer;
      }
      return false;
    }) as Horizon.HorizonApi.BalanceLineAsset | undefined;

    if (trustline) {
      return {
        exists: true,
        authorized: trustline.is_authorized ?? true,
        balance: trustline.balance,
        limit: trustline.limit,
      };
    }

    return {
      exists: false,
      authorized: false,
      balance: '0',
      limit: '0',
    };
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    // Account doesn't exist
    if (err.response?.status === 404) {
      throw new Error('Account not found. Please fund your account first.');
    }
    throw error;
  }
}

/**
 * Build a transaction to create a trustline for an asset
 */
export async function buildTrustlineTransaction(
  accountAddress: string,
  assetCode: string,
  assetIssuer: string,
  limit?: string
): Promise<string> {
  const config = getNetworkConfig();
  const horizonServer = new Horizon.Server(config.horizonUrl);

  const account = await horizonServer.loadAccount(accountAddress);
  const asset = new Asset(assetCode, assetIssuer);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset,
        limit: limit || undefined, // undefined = max limit
      })
    )
    .setTimeout(30)
    .build();

  return transaction.toXDR();
}

/**
 * Submit a signed trustline transaction
 */
export async function submitTrustlineTransaction(
  signedXDR: string
): Promise<{ success: boolean; hash?: string; error?: string }> {
  const config = getNetworkConfig();
  const horizonServer = new Horizon.Server(config.horizonUrl);

  try {
    const transaction = TransactionBuilder.fromXDR(signedXDR, config.passphrase);
    const result = await horizonServer.submitTransaction(
      transaction as Parameters<typeof horizonServer.submitTransaction>[0]
    );
    return { success: true, hash: result.hash };
  } catch (error: unknown) {
    const err = error as { response?: { data?: { extras?: { result_codes?: unknown } } }; message?: string };
    console.error('Trustline submission error:', error);
    return {
      success: false,
      error: err.response?.data?.extras?.result_codes
        ? JSON.stringify(err.response.data.extras.result_codes)
        : err.message || 'Unknown error'
    };
  }
}

/**
 * Ensure a trustline exists for an asset, creating one if necessary
 * Returns true if trustline exists or was created successfully
 */
export async function ensureTrustlineExists(
  accountAddress: string,
  assetCode: string,
  assetIssuer: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<{ success: boolean; created: boolean; error?: string }> {
  // Check if trustline already exists
  const status = await checkTrustline(accountAddress, assetCode, assetIssuer);

  if (status.exists && status.authorized) {
    return { success: true, created: false };
  }

  // Build trustline transaction
  const txXDR = await buildTrustlineTransaction(accountAddress, assetCode, assetIssuer);

  // Sign the transaction
  const signedXDR = await signTransaction(txXDR);

  // Submit the transaction
  const result = await submitTrustlineTransaction(signedXDR);

  if (result.success) {
    return { success: true, created: true };
  }

  return { success: false, created: false, error: result.error };
}
