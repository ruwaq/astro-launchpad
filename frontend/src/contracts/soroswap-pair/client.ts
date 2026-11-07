import {SoroswapPairError} from './types.js';
import {Spec, AssembledTransaction, Client as ContractClient} from '@stellar/stellar-sdk/contract';
import type {Result, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address} from '@stellar/stellar-sdk';

export interface Client {
  total_supply(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  allowance(args: { from: string | Address; spender: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  approve(args: { from: string | Address; spender: string | Address; amount: bigint; expiration_ledger: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  balance(args: { id: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  transfer(args: { from: string | Address; to: string | Address; amount: bigint }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  transfer_from(args: { spender: string | Address; from: string | Address; to: string | Address; amount: bigint }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  burn(args: { from: string | Address; amount: bigint }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  burn_from(args: { spender: string | Address; from: string | Address; amount: bigint }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  decimals(options?: MethodOptions): Promise<AssembledTransaction<number>>;
  name(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  symbol(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  /**
   * Initializes a new Soroswap pair by setting token addresses, factory, and initial reserves.
   *
   * # Arguments
   * * `e` - The runtime environment.
   * * `factory` - The address of the Soroswap factory contract.
   * * `token_0` - The address of the first token in the pair.
   * * `token_1` - The address of the second token in the pair.
   */
  initialize(args: { factory: string | Address; token_0: string | Address; token_1: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], SoroswapPairError>>>;
  /**
   * Returns the address of the first token in the Soroswap pair.
   */
  token_0(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  /**
   * Returns the address of the second token in the Soroswap pair.
   */
  token_1(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  /**
   * Returns the address of the Soroswap factory contract.
   */
  factory(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  /**
   * Deposits tokens into the Soroswap pair and mints LP tokens in return.
   *
   * # Arguments
   * * `e` - The runtime environment.
   * * `to` - The address where the minted LP tokens will be sent.
   *
   * # Returns
   * The amount of minted LP tokens.
   * Possible errors:
   * - `SoroswapPairError::NotInitialized`: The Soroswap pair has not been initialized.
   * - `SoroswapPairError::DepositInsufficientAmountToken0`: Insufficient amount of token 0 sent.
   * - `SoroswapPairError::DepositInsufficientAmountToken1`: Insufficient amount of token 1 sent.
   * - `SoroswapPairError::DepositInsufficientFirstLiquidity`: Insufficient first liquidity minted.
   * - `SoroswapPairError::DepositInsufficientLiquidityMinted`: Insufficient liquidity minted.
   * - `SoroswapPairError::UpdateOverflow`: Overflow occurred during update.
   */
  deposit(args: { to: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<bigint, SoroswapPairError>>>;
  /**
   * Executes a token swap within the Soroswap pair.
   *
   * # Arguments
   * * `e` - The runtime environment.
   * * `amount_0_out` - The desired amount of the first token to receive.
   * * `amount_1_out` - The desired amount of the second token to receive.
   * * `to` - The address where the swapped tokens will be sent.
   * Returns an error if the swap cannot be executed. Possible errors include:
   * - `SoroswapPairError::NotInitialized`
   * - `SoroswapPairError::SwapInsufficientOutputAmount`
   * - `SoroswapPairError::SwapNegativesOutNotSupported`
   * - `SoroswapPairError::SwapInsufficientLiquidity`
   * - `SoroswapPairError::SwapInvalidTo`
   * - `SoroswapPairError::SwapInsufficientInputAmount`
   * - `SoroswapPairError::SwapNegativesInNotSupported`
   * - `SoroswapPairError::SwapKConstantNotMet`: If the K constant condition is not met after the swap.
   */
  swap(args: { amount_0_out: bigint; amount_1_out: bigint; to: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], SoroswapPairError>>>;
  /**
   * Withdraws liquidity from the Soroswap pair, burning LP tokens and returning the corresponding tokens to the user.
   *
   * # Arguments
   * * `e` - The runtime environment.
   * * `to` - The address where the withdrawn tokens will be sent.
   *
   * # Returns
   * A tuple containing the amounts of token 0 and token 1 withdrawn from the pair.
   */
  withdraw(args: { to: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<[bigint, bigint], SoroswapPairError>>>;
  /**
   * Skims excess tokens from reserves and sends them to the specified address.
   *
   * # Arguments
   * * `e` - The runtime environment.
   * * `to` - The address where the excess tokens will be sent.
   */
  skim(args: { to: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Forces reserves to match current balances.
   *
   * # Arguments
   * * `e` - The runtime environment.
   */
  sync(options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Returns the current reserves and the last block timestamp.
   *
   * # Arguments
   * * `e` - The runtime environment.
   *
   * # Returns
   * A tuple containing the reserves of token 0 and token 1.
   */
  get_reserves(options?: MethodOptions): Promise<AssembledTransaction<[bigint, bigint]>>;
  /**
   * Returns the value of the last product of reserves (`K`) stored in the contract.
   *
   * # Arguments
   * * `e` - The runtime environment.
   *
   * # Returns
   * The value of the last product of reserves (`K`).
   */
  k_last(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
}

export class Client extends ContractClient {
  readonly options: ContractClientOptions;
  constructor(options: ContractClientOptions) {
    super(
      new Spec(["AAAAAAAAAAAAAAAMdG90YWxfc3VwcGx5AAAAAAAAAAEAAAAL", "AAAAAAAAAAAAAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAL", "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABAAAAAA=", "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAABAAAAAAAAAAJpZAAAAAAAEwAAAAEAAAAL", "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=", "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA", "AAAAAAAAAAAAAAAEYnVybgAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA", "AAAAAAAAAAAAAAAJYnVybl9mcm9tAAAAAAAAAwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==", "AAAAAAAAAAAAAAAIZGVjaW1hbHMAAAAAAAAAAQAAAAQ=", "AAAAAAAAAAAAAAAEbmFtZQAAAAAAAAABAAAAEA==", "AAAAAAAAAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=", "AAAAAQAAAAAAAAAAAAAAEEFsbG93YW5jZURhdGFLZXkAAAACAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAAT", "AAAAAQAAAAAAAAAAAAAADkFsbG93YW5jZVZhbHVlAAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABA==", "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAEAAAAAAAAACUFsbG93YW5jZQAAAAAAAAEAAAfQAAAAEEFsbG93YW5jZURhdGFLZXkAAAABAAAAAAAAAAdCYWxhbmNlAAAAAAEAAAATAAAAAAAAAAAAAAALVG90YWxTdXBwbHkA", "AAAAAQAAAAAAAAAAAAAADERlcG9zaXRFdmVudAAAAAYAAAAAAAAACGFtb3VudF8wAAAACwAAAAAAAAAIYW1vdW50XzEAAAALAAAAAAAAAAlsaXF1aWRpdHkAAAAAAAALAAAAAAAAAA1uZXdfcmVzZXJ2ZV8wAAAAAAAACwAAAAAAAAANbmV3X3Jlc2VydmVfMQAAAAAAAAsAAAAAAAAAAnRvAAAAAAAT", "AAAAAQAAAAAAAAAAAAAACVN3YXBFdmVudAAAAAAAAAUAAAAAAAAAC2Ftb3VudF8wX2luAAAAAAsAAAAAAAAADGFtb3VudF8wX291dAAAAAsAAAAAAAAAC2Ftb3VudF8xX2luAAAAAAsAAAAAAAAADGFtb3VudF8xX291dAAAAAsAAAAAAAAAAnRvAAAAAAAT", "AAAAAQAAAAAAAAAAAAAADVdpdGhkcmF3RXZlbnQAAAAAAAAGAAAAAAAAAAhhbW91bnRfMAAAAAsAAAAAAAAACGFtb3VudF8xAAAACwAAAAAAAAAJbGlxdWlkaXR5AAAAAAAACwAAAAAAAAANbmV3X3Jlc2VydmVfMAAAAAAAAAsAAAAAAAAADW5ld19yZXNlcnZlXzEAAAAAAAALAAAAAAAAAAJ0bwAAAAAAEw==", "AAAAAQAAAAAAAAAAAAAACVN5bmNFdmVudAAAAAAAAAIAAAAAAAAADW5ld19yZXNlcnZlXzAAAAAAAAALAAAAAAAAAA1uZXdfcmVzZXJ2ZV8xAAAAAAAACw==", "AAAAAQAAAAAAAAAAAAAACVNraW1FdmVudAAAAAAAAAIAAAAAAAAACXNraW1tZWRfMAAAAAAAAAsAAAAAAAAACXNraW1tZWRfMQAAAAAAAAs=", "AAAABAAAAAAAAAAAAAAAEVNvcm9zd2FwUGFpckVycm9yAAAAAAAAEgAAACFTb3Jvc3dhcFBhaXI6IGFscmVhZHkgaW5pdGlhbGl6ZWQAAAAAAAAcSW5pdGlhbGl6ZUFscmVhZHlJbml0aWFsaXplZAAAAGUAAAAhU29yb3N3YXBQYWlyOiBub3QgeWV0IGluaXRpYWxpemVkAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAABmAAAAQlNvcm9zd2FwUGFpcjogdG9rZW5fMCBtdXN0IGJlIGxlc3MgdGhhbiB0b2tlbl8xIHdoaWxlIGluaXRpYWxpemluZwAAAAAAG0luaXRpYWxpemVUb2tlbk9yZGVySW52YWxpZAAAAABnAAAARVNvcm9zd2FwUGFpcjogaW5zdWZmaWNpZW50IGFtb3VudCBvZiB0b2tlbiAwIHNlbnQgd2hpbGUgZG9pbmcgZGVwb3NpdAAAAAAAAB9EZXBvc2l0SW5zdWZmaWNpZW50QW1vdW50VG9rZW4wAAAAAGgAAABFU29yb3N3YXBQYWlyOiBpbnN1ZmZpY2llbnQgYW1vdW50IG9mIHRva2VuIDEgc2VudCB3aGlsZSBkb2luZyBkZXBvc2l0AAAAAAAAH0RlcG9zaXRJbnN1ZmZpY2llbnRBbW91bnRUb2tlbjEAAAAAaQAAAEVTb3Jvc3dhcFBhaXI6IGluc3VmZmljaWVudCBmaXJzdCBsaXF1aWRpdHkgbWludGVkIHdoaWxlIGRvaW5nIGRlcG9zaXQAAAAAAAAhRGVwb3NpdEluc3VmZmljaWVudEZpcnN0TGlxdWlkaXR5AAAAAAAAagAAAD9Tb3Jvc3dhcFBhaXI6IGluc3VmZmljaWVudCBsaXF1aWRpdHkgbWludGVkIHdoaWxlIGRvaW5nIGRlcG9zaXQAAAAAIkRlcG9zaXRJbnN1ZmZpY2llbnRMaXF1aWRpdHlNaW50ZWQAAAAAAGsAAABDU29yb3N3YXBQYWlyOiBpbnN1ZmZpY2llbnQgb3V0cHV0IGFtb3VudCB3aGlsZSBkb2luZyBkZXBvc0RlcG9zaXRpdAAAAAAcU3dhcEluc3VmZmljaWVudE91dHB1dEFtb3VudAAAAGwAAABDU29yb3N3YXBQYWlyOiBuZWdhdGl2ZXMgYW1vdW50cyBvdXQgZG9udCBzdXBwb3J0ZWQgd2hpbGUgZG9pbmcgc3dhcAAAAAAcU3dhcE5lZ2F0aXZlc091dE5vdFN1cHBvcnRlZAAAAG0AAAAzU29yb3N3YXBQYWlyOiBpbnN1ZmZpY2llbnQgbGlxdWlkaXR5IHRvIGRvIHRoZSBzd2FwAAAAABlTd2FwSW5zdWZmaWNpZW50TGlxdWlkaXR5AAAAAAAAbgAAACdTb3Jvc3dhcFBhaXI6IGludmFsaWQgdG8gdG8gZG8gdGhlIHN3YXAAAAAADVN3YXBJbnZhbGlkVG8AAAAAAABvAAAAOFNvcm9zd2FwUGFpcjogaW5zdWZmaWNpZW50IGlucHV0IGFtb3VudCB3aGlsZSBkb2luZyBzd2FwAAAAG1N3YXBJbnN1ZmZpY2llbnRJbnB1dEFtb3VudAAAAABwAAAAQlNvcm9zd2FwUGFpcjogbmVnYXRpdmVzIGFtb3VudHMgaW4gZG9udCBzdXBwb3J0ZWQgd2hpbGUgZG9pbmcgc3dhcAAAAAAAG1N3YXBOZWdhdGl2ZXNJbk5vdFN1cHBvcnRlZAAAAABxAAAANFNvcm9zd2FwUGFpcjogSyBjb25zdGFudCBpcyBub3QgbWV0IHdoaWxlIGRvaW5nIHN3YXAAAAATU3dhcEtDb25zdGFudE5vdE1ldAAAAAByAAAARFNvcm9zd2FwUGFpcjogbGlxdWlkaXR5IHdhcyBub3QgaW5pdGlhbGl6ZWQgeWV0IHdoaWxlIGRvaW5nIHdpdGhkcmF3AAAAH1dpdGhkcmF3TGlxdWlkaXR5Tm90SW5pdGlhbGl6ZWQAAAAAcwAAADtTb3Jvc3dhcFBhaXI6IGluc3VmZmljaWVudCBzZW50IHNoYXJlcyB3aGlsZSBkb2luZyB3aXRoZHJhdwAAAAAeV2l0aGRyYXdJbnN1ZmZpY2llbnRTZW50U2hhcmVzAAAAAAB0AAAAQFNvcm9zd2FwUGFpcjogaW5zdWZmaWNpZW50IGxpcXVpZGl0eSBidXJuZWQgd2hpbGUgZG9pbmcgd2l0aGRyYXcAAAAjV2l0aGRyYXdJbnN1ZmZpY2llbnRMaXF1aWRpdHlCdXJuZWQAAAAAdQAAACVTb3Jvc3dhcFBhaXI6IE9WRVJGTE9XIHdoaWxlIHVwZGF0aW5nAAAAAAAADlVwZGF0ZU92ZXJmbG93AAAAAAB2", "AAAAAAAAATlJbml0aWFsaXplcyBhIG5ldyBTb3Jvc3dhcCBwYWlyIGJ5IHNldHRpbmcgdG9rZW4gYWRkcmVzc2VzLCBmYWN0b3J5LCBhbmQgaW5pdGlhbCByZXNlcnZlcy4KCiMgQXJndW1lbnRzCiogYGVgIC0gVGhlIHJ1bnRpbWUgZW52aXJvbm1lbnQuCiogYGZhY3RvcnlgIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIFNvcm9zd2FwIGZhY3RvcnkgY29udHJhY3QuCiogYHRva2VuXzBgIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIGZpcnN0IHRva2VuIGluIHRoZSBwYWlyLgoqIGB0b2tlbl8xYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBzZWNvbmQgdG9rZW4gaW4gdGhlIHBhaXIuAAAAAAAACmluaXRpYWxpemUAAAAAAAMAAAAAAAAAB2ZhY3RvcnkAAAAAEwAAAAAAAAAHdG9rZW5fMAAAAAATAAAAAAAAAAd0b2tlbl8xAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAABFTb3Jvc3dhcFBhaXJFcnJvcgAAAA==", "AAAAAAAAADxSZXR1cm5zIHRoZSBhZGRyZXNzIG9mIHRoZSBmaXJzdCB0b2tlbiBpbiB0aGUgU29yb3N3YXAgcGFpci4AAAAHdG9rZW5fMAAAAAAAAAAAAQAAABM=", "AAAAAAAAAD1SZXR1cm5zIHRoZSBhZGRyZXNzIG9mIHRoZSBzZWNvbmQgdG9rZW4gaW4gdGhlIFNvcm9zd2FwIHBhaXIuAAAAAAAAB3Rva2VuXzEAAAAAAAAAAAEAAAAT", "AAAAAAAAADVSZXR1cm5zIHRoZSBhZGRyZXNzIG9mIHRoZSBTb3Jvc3dhcCBmYWN0b3J5IGNvbnRyYWN0LgAAAAAAAAdmYWN0b3J5AAAAAAAAAAABAAAAEw==", "AAAAAAAAAvtEZXBvc2l0cyB0b2tlbnMgaW50byB0aGUgU29yb3N3YXAgcGFpciBhbmQgbWludHMgTFAgdG9rZW5zIGluIHJldHVybi4KCiMgQXJndW1lbnRzCiogYGVgIC0gVGhlIHJ1bnRpbWUgZW52aXJvbm1lbnQuCiogYHRvYCAtIFRoZSBhZGRyZXNzIHdoZXJlIHRoZSBtaW50ZWQgTFAgdG9rZW5zIHdpbGwgYmUgc2VudC4KCiMgUmV0dXJucwpUaGUgYW1vdW50IG9mIG1pbnRlZCBMUCB0b2tlbnMuClBvc3NpYmxlIGVycm9yczoKLSBgU29yb3N3YXBQYWlyRXJyb3I6Ok5vdEluaXRpYWxpemVkYDogVGhlIFNvcm9zd2FwIHBhaXIgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkLgotIGBTb3Jvc3dhcFBhaXJFcnJvcjo6RGVwb3NpdEluc3VmZmljaWVudEFtb3VudFRva2VuMGA6IEluc3VmZmljaWVudCBhbW91bnQgb2YgdG9rZW4gMCBzZW50LgotIGBTb3Jvc3dhcFBhaXJFcnJvcjo6RGVwb3NpdEluc3VmZmljaWVudEFtb3VudFRva2VuMWA6IEluc3VmZmljaWVudCBhbW91bnQgb2YgdG9rZW4gMSBzZW50LgotIGBTb3Jvc3dhcFBhaXJFcnJvcjo6RGVwb3NpdEluc3VmZmljaWVudEZpcnN0TGlxdWlkaXR5YDogSW5zdWZmaWNpZW50IGZpcnN0IGxpcXVpZGl0eSBtaW50ZWQuCi0gYFNvcm9zd2FwUGFpckVycm9yOjpEZXBvc2l0SW5zdWZmaWNpZW50TGlxdWlkaXR5TWludGVkYDogSW5zdWZmaWNpZW50IGxpcXVpZGl0eSBtaW50ZWQuCi0gYFNvcm9zd2FwUGFpckVycm9yOjpVcGRhdGVPdmVyZmxvd2A6IE92ZXJmbG93IG9jY3VycmVkIGR1cmluZyB1cGRhdGUuAAAAAAdkZXBvc2l0AAAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAA+kAAAALAAAH0AAAABFTb3Jvc3dhcFBhaXJFcnJvcgAAAA==", "AAAAAAAAAxtFeGVjdXRlcyBhIHRva2VuIHN3YXAgd2l0aGluIHRoZSBTb3Jvc3dhcCBwYWlyLgoKIyBBcmd1bWVudHMKKiBgZWAgLSBUaGUgcnVudGltZSBlbnZpcm9ubWVudC4KKiBgYW1vdW50XzBfb3V0YCAtIFRoZSBkZXNpcmVkIGFtb3VudCBvZiB0aGUgZmlyc3QgdG9rZW4gdG8gcmVjZWl2ZS4KKiBgYW1vdW50XzFfb3V0YCAtIFRoZSBkZXNpcmVkIGFtb3VudCBvZiB0aGUgc2Vjb25kIHRva2VuIHRvIHJlY2VpdmUuCiogYHRvYCAtIFRoZSBhZGRyZXNzIHdoZXJlIHRoZSBzd2FwcGVkIHRva2VucyB3aWxsIGJlIHNlbnQuClJldHVybnMgYW4gZXJyb3IgaWYgdGhlIHN3YXAgY2Fubm90IGJlIGV4ZWN1dGVkLiBQb3NzaWJsZSBlcnJvcnMgaW5jbHVkZToKLSBgU29yb3N3YXBQYWlyRXJyb3I6Ok5vdEluaXRpYWxpemVkYAotIGBTb3Jvc3dhcFBhaXJFcnJvcjo6U3dhcEluc3VmZmljaWVudE91dHB1dEFtb3VudGAKLSBgU29yb3N3YXBQYWlyRXJyb3I6OlN3YXBOZWdhdGl2ZXNPdXROb3RTdXBwb3J0ZWRgCi0gYFNvcm9zd2FwUGFpckVycm9yOjpTd2FwSW5zdWZmaWNpZW50TGlxdWlkaXR5YAotIGBTb3Jvc3dhcFBhaXJFcnJvcjo6U3dhcEludmFsaWRUb2AKLSBgU29yb3N3YXBQYWlyRXJyb3I6OlN3YXBJbnN1ZmZpY2llbnRJbnB1dEFtb3VudGAKLSBgU29yb3N3YXBQYWlyRXJyb3I6OlN3YXBOZWdhdGl2ZXNJbk5vdFN1cHBvcnRlZGAKLSBgU29yb3N3YXBQYWlyRXJyb3I6OlN3YXBLQ29uc3RhbnROb3RNZXRgOiBJZiB0aGUgSyBjb25zdGFudCBjb25kaXRpb24gaXMgbm90IG1ldCBhZnRlciB0aGUgc3dhcC4AAAAABHN3YXAAAAADAAAAAAAAAAxhbW91bnRfMF9vdXQAAAALAAAAAAAAAAxhbW91bnRfMV9vdXQAAAALAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAAEVNvcm9zd2FwUGFpckVycm9yAAAA", "AAAAAAAAATdXaXRoZHJhd3MgbGlxdWlkaXR5IGZyb20gdGhlIFNvcm9zd2FwIHBhaXIsIGJ1cm5pbmcgTFAgdG9rZW5zIGFuZCByZXR1cm5pbmcgdGhlIGNvcnJlc3BvbmRpbmcgdG9rZW5zIHRvIHRoZSB1c2VyLgoKIyBBcmd1bWVudHMKKiBgZWAgLSBUaGUgcnVudGltZSBlbnZpcm9ubWVudC4KKiBgdG9gIC0gVGhlIGFkZHJlc3Mgd2hlcmUgdGhlIHdpdGhkcmF3biB0b2tlbnMgd2lsbCBiZSBzZW50LgoKIyBSZXR1cm5zCkEgdHVwbGUgY29udGFpbmluZyB0aGUgYW1vdW50cyBvZiB0b2tlbiAwIGFuZCB0b2tlbiAxIHdpdGhkcmF3biBmcm9tIHRoZSBwYWlyLgAAAAAId2l0aGRyYXcAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAPpAAAD7QAAAAIAAAALAAAACwAAB9AAAAARU29yb3N3YXBQYWlyRXJyb3IAAAA=", "AAAAAAAAALNTa2ltcyBleGNlc3MgdG9rZW5zIGZyb20gcmVzZXJ2ZXMgYW5kIHNlbmRzIHRoZW0gdG8gdGhlIHNwZWNpZmllZCBhZGRyZXNzLgoKIyBBcmd1bWVudHMKKiBgZWAgLSBUaGUgcnVudGltZSBlbnZpcm9ubWVudC4KKiBgdG9gIC0gVGhlIGFkZHJlc3Mgd2hlcmUgdGhlIGV4Y2VzcyB0b2tlbnMgd2lsbCBiZSBzZW50LgAAAAAEc2tpbQAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAA==", "AAAAAAAAAFhGb3JjZXMgcmVzZXJ2ZXMgdG8gbWF0Y2ggY3VycmVudCBiYWxhbmNlcy4KCiMgQXJndW1lbnRzCiogYGVgIC0gVGhlIHJ1bnRpbWUgZW52aXJvbm1lbnQuAAAABHN5bmMAAAAAAAAAAA==", "AAAAAAAAAKtSZXR1cm5zIHRoZSBjdXJyZW50IHJlc2VydmVzIGFuZCB0aGUgbGFzdCBibG9jayB0aW1lc3RhbXAuCgojIEFyZ3VtZW50cwoqIGBlYCAtIFRoZSBydW50aW1lIGVudmlyb25tZW50LgoKIyBSZXR1cm5zCkEgdHVwbGUgY29udGFpbmluZyB0aGUgcmVzZXJ2ZXMgb2YgdG9rZW4gMCBhbmQgdG9rZW4gMS4AAAAADGdldF9yZXNlcnZlcwAAAAAAAAABAAAD7QAAAAIAAAALAAAACw==", "AAAAAAAAALlSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgbGFzdCBwcm9kdWN0IG9mIHJlc2VydmVzIChgS2ApIHN0b3JlZCBpbiB0aGUgY29udHJhY3QuCgojIEFyZ3VtZW50cwoqIGBlYCAtIFRoZSBydW50aW1lIGVudmlyb25tZW50LgoKIyBSZXR1cm5zClRoZSB2YWx1ZSBvZiB0aGUgbGFzdCBwcm9kdWN0IG9mIHJlc2VydmVzIChgS2ApLgAAAAAAAAZrX2xhc3QAAAAAAAAAAAABAAAACw==", "AAAAAQAAAAAAAAAAAAAADVRva2VuTWV0YWRhdGEAAAAAAAADAAAAAAAAAAdkZWNpbWFsAAAAAAQAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAZzeW1ib2wAAAAAABA=", "AAAABAAAAAAAAAAAAAAADEZhY3RvcnlFcnJvcgAAAAYAAAAkU29yb3N3YXBGYWN0b3J5OiBub3QgeWV0IGluaXRpYWxpemVkAAAADk5vdEluaXRpYWxpemVkAAAAAADJAAAAPVNvcm9zd2FwRmFjdG9yeTogdG9rZW5fYSBhbmQgdG9rZW5fYiBoYXZlIGlkZW50aWNhbCBhZGRyZXNzZXMAAAAAAAAZQ3JlYXRlUGFpcklkZW50aWNhbFRva2VucwAAAAAAAMoAAABAU29yb3N3YXBGYWN0b3J5OiBwYWlyIGFscmVhZHkgZXhpc3RzIGJldHdlZW4gdG9rZW5fYSBhbmQgdG9rZW5fYgAAABdDcmVhdGVQYWlyQWxyZWFkeUV4aXN0cwAAAADLAAAAJFNvcm9zd2FwRmFjdG9yeTogYWxyZWFkeSBpbml0aWFsaXplZAAAABxJbml0aWFsaXplQWxyZWFkeUluaXRpYWxpemVkAAAAzAAAACRTb3Jvc3dhcEZhY3Rvcnk6IHBhaXIgZG9lcyBub3QgZXhpc3QAAAAQUGFpckRvZXNOb3RFeGlzdAAAAM0AAAAlU29yb3N3YXBGYWN0b3J5OiBpbmRleCBkb2VzIG5vdCBleGlzdAAAAAAAABFJbmRleERvZXNOb3RFeGlzdAAAAAAAAM4="]),
      options
    );
    this.options = options;
  }

   static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  public readonly fromJson = {
    total_supply : this.txFromJson<bigint>,  allowance : this.txFromJson<bigint>,  approve : this.txFromJson<void>,  balance : this.txFromJson<bigint>,  transfer : this.txFromJson<void>,  transfer_from : this.txFromJson<void>,  burn : this.txFromJson<void>,  burn_from : this.txFromJson<void>,  decimals : this.txFromJson<number>,  name : this.txFromJson<string>,  symbol : this.txFromJson<string>,  initialize : this.txFromJson<Result<[], SoroswapPairError>>,  token_0 : this.txFromJson<string>,  token_1 : this.txFromJson<string>,  factory : this.txFromJson<string>,  deposit : this.txFromJson<Result<bigint, SoroswapPairError>>,  swap : this.txFromJson<Result<[], SoroswapPairError>>,  withdraw : this.txFromJson<Result<[bigint, bigint], SoroswapPairError>>,  skim : this.txFromJson<void>,  sync : this.txFromJson<void>,  get_reserves : this.txFromJson<[bigint, bigint]>,  k_last : this.txFromJson<bigint>
  };

  /** @deprecated Use fromJson instead. */
  public readonly fromJSON = this.fromJson;

}