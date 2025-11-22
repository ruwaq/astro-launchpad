/**
 * Stellar DEX Service
 *
 * Handles swaps for external tokens using Stellar's native DEX and path payments
 * This enables swapping ANY token on Stellar network, not just bonding curve tokens
 */

import {
  Asset,
  Operation,
  Horizon,
  Memo,
  BASE_FEE,
  Networks,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { getNetworkConfig } from '@/lib/config/network';

export interface PathPaymentResult {
  source_asset_type: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  source_amount: string;
  destination_asset_type: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  destination_amount: string;
  path: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
}

class StellarDEXService {
  private _server: Horizon.Server | null = null;
  private _networkPassphrase: string | null = null;

  private getServer(): Horizon.Server {
    if (!this._server) {
      const config = getNetworkConfig();
      this._server = new Horizon.Server(config.horizonUrl);
      this._networkPassphrase = config.passphrase;
    }
    return this._server;
  }

  private getPassphrase(): string {
    if (!this._networkPassphrase) {
      const config = getNetworkConfig();
      this._networkPassphrase = config.passphrase;
    }
    return this._networkPassphrase;
  }

  /**
   * Create Asset object from token info
   */
  private createAsset(
    code: string,
    issuer?: string
  ): Asset {
    if (code === 'XLM' || code === 'native') {
      return Asset.native();
    }
    if (!issuer) {
      throw new Error(`Issuer required for asset ${code}`);
    }
    return new Asset(code, issuer);
  }

  /**
   * Find path payment options between two assets
   */
  async findPathPayment(
    sourceAssetCode: string,
    sourceAssetIssuer: string | undefined,
    destAssetCode: string,
    destAssetIssuer: string | undefined,
    destAmount: string
  ): Promise<PathPaymentResult[]> {
    try {
      const sourceAsset = this.createAsset(sourceAssetCode, sourceAssetIssuer);
      const destAsset = this.createAsset(destAssetCode, destAssetIssuer);

      // Find strict send paths (we know source amount)
      const paths = await this.getServer()
        .strictReceivePaths(
          sourceAsset,
          destAsset,
          destAmount
        )
        .call();

      return paths.records;
    } catch (error) {
      console.error('Error finding path payment:', error);
      throw new Error('Failed to find payment path');
    }
  }

  /**
   * Find best path for swapping exact source amount
   */
  async findStrictSendPath(
    sourceAssetCode: string,
    sourceAssetIssuer: string | undefined,
    sourceAmount: string,
    destAssetCode: string,
    destAssetIssuer: string | undefined
  ): Promise<PathPaymentResult[]> {
    try {
      const sourceAsset = this.createAsset(sourceAssetCode, sourceAssetIssuer);
      const destAsset = this.createAsset(destAssetCode, destAssetIssuer);

      const paths = await this.getServer()
        .strictSendPaths(
          sourceAsset,
          sourceAmount,
          [destAsset]
        )
        .call();

      return paths.records;
    } catch (error) {
      console.error('Error finding strict send path:', error);
      throw new Error('Failed to find swap path');
    }
  }

  /**
   * Calculate expected output for a given input amount
   */
  async calculateSwapOutput(
    sourceAssetCode: string,
    sourceAssetIssuer: string | undefined,
    sourceAmount: string,
    destAssetCode: string,
    destAssetIssuer: string | undefined
  ): Promise<{
    estimatedOutput: string;
    path: PathPaymentResult | null;
  }> {
    try {
      const paths = await this.findStrictSendPath(
        sourceAssetCode,
        sourceAssetIssuer,
        sourceAmount,
        destAssetCode,
        destAssetIssuer
      );

      if (paths.length === 0) {
        return {
          estimatedOutput: '0',
          path: null,
        };
      }

      // Get best path (first one is usually best)
      const bestPath = paths[0];

      return {
        estimatedOutput: bestPath.destination_amount,
        path: bestPath,
      };
    } catch (error) {
      console.error('Error calculating swap output:', error);
      return {
        estimatedOutput: '0',
        path: null,
      };
    }
  }

  /**
   * Build path payment strict send operation
   */
  buildPathPaymentOperation(
    sourceAssetCode: string,
    sourceAssetIssuer: string | undefined,
    sourceAmount: string,
    destination: string,
    destAssetCode: string,
    destAssetIssuer: string | undefined,
    destMinAmount: string,
    path?: PathPaymentResult
  ): Operation {
    const sourceAsset = this.createAsset(sourceAssetCode, sourceAssetIssuer);
    const destAsset = this.createAsset(destAssetCode, destAssetIssuer);

    // Build intermediate path assets
    const pathAssets: Asset[] = [];
    if (path && path.path) {
      for (const asset of path.path) {
        if (asset.asset_type === 'native') {
          pathAssets.push(Asset.native());
        } else if (asset.asset_code && asset.asset_issuer) {
          pathAssets.push(new Asset(asset.asset_code, asset.asset_issuer));
        }
      }
    }

    return Operation.pathPaymentStrictSend({
      sendAsset: sourceAsset,
      sendAmount: sourceAmount,
      destination: destination,
      destAsset: destAsset,
      destMin: destMinAmount,
      path: pathAssets,
    });
  }

  /**
   * Check if account has trustline for an asset
   */
  async checkTrustline(
    accountId: string,
    assetCode: string,
    assetIssuer: string
  ): Promise<boolean> {
    try {
      const account = await this.getServer().loadAccount(accountId);

      return account.balances.some((balance: any) => {
        if (balance.asset_type === 'native') {
          return assetCode === 'XLM';
        }
        return (
          balance.asset_code === assetCode &&
          balance.asset_issuer === assetIssuer
        );
      });
    } catch (error) {
      console.error('Error checking trustline:', error);
      return false;
    }
  }

  /**
   * Build create trustline operation
   */
  buildCreateTrustlineOperation(
    assetCode: string,
    assetIssuer: string,
    limit?: string
  ): Operation {
    const asset = new Asset(assetCode, assetIssuer);

    return Operation.changeTrust({
      asset: asset,
      limit: limit,
    });
  }

  /**
   * Get current orderbook for a trading pair
   */
  async getOrderbook(
    sellingAssetCode: string,
    sellingAssetIssuer: string | undefined,
    buyingAssetCode: string,
    buyingAssetIssuer: string | undefined,
    limit: number = 10
  ) {
    try {
      const sellingAsset = this.createAsset(sellingAssetCode, sellingAssetIssuer);
      const buyingAsset = this.createAsset(buyingAssetCode, buyingAssetIssuer);

      const orderbook = await this.getServer()
        .orderbook(sellingAsset, buyingAsset)
        .limit(limit)
        .call();

      return orderbook;
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      throw new Error('Failed to fetch orderbook');
    }
  }

  /**
   * Get best price from orderbook
   */
  async getBestPrice(
    sourceAssetCode: string,
    sourceAssetIssuer: string | undefined,
    destAssetCode: string,
    destAssetIssuer: string | undefined
  ): Promise<string | null> {
    try {
      const orderbook = await this.getOrderbook(
        sourceAssetCode,
        sourceAssetIssuer,
        destAssetCode,
        destAssetIssuer,
        1
      );

      if (orderbook.asks.length > 0) {
        return orderbook.asks[0].price;
      }

      return null;
    } catch (error) {
      console.error('Error getting best price:', error);
      return null;
    }
  }
}

export const stellarDEXService = new StellarDEXService();
