import {FactoryError} from './types.js';
import {Spec, AssembledTransaction, Client as ContractClient} from '@stellar/stellar-sdk/contract';
import type {Result, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address} from '@stellar/stellar-sdk';

export interface Client {
  /**
   * Returns the recipient of the fee.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized.
   */
  fee_to(options?: MethodOptions): Promise<AssembledTransaction<Result<string, FactoryError>>>;
  /**
   * Returns the address allowed to change the fee recipient.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized.
   */
  fee_to_setter(options?: MethodOptions): Promise<AssembledTransaction<Result<string, FactoryError>>>;
  /**
   * Checks if fees are enabled.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized.
   */
  fees_enabled(options?: MethodOptions): Promise<AssembledTransaction<Result<boolean, FactoryError>>>;
  /**
   * Returns the total number of pairs created through the factory so far.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized.
   */
  all_pairs_length(options?: MethodOptions): Promise<AssembledTransaction<Result<number, FactoryError>>>;
  /**
   * Returns the address of the pair for `token_a` and `token_b`, if it has been created.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   * * `token_a` - The address of the first token in the pair.
   * * `token_b` - The address of the second token in the pair.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized or if the pair does not exist
   */
  get_pair(args: { token_a: string | Address; token_b: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<string, FactoryError>>>;
  /**
   * Returns the address of the nth pair (0-indexed) created through the factory, or address(0) if not enough pairs have been created yet.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   * * `n` - The index of the pair to retrieve.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized or if index `n` does not exist.
   */
  all_pairs(args: { n: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<string, FactoryError>>>;
  /**
   * Checks if a pair exists for the given `token_a` and `token_b`.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   * * `token_a` - The address of the first token in the pair.
   * * `token_b` - The address of the second token in the pair.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized.
   */
  pair_exists(args: { token_a: string | Address; token_b: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<boolean, FactoryError>>>;
  /**
   * Sets the `fee_to_setter` address and initializes the factory.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   * * `setter` - The address to set as the current `fee_to_setter`.
   * * `pair_wasm_hash` - The Wasm hash of the pair.
   *
   * # Errors
   *
   * Returns an error if the Factory is already initialized.
   */
  initialize(args: { setter: string | Address; pair_wasm_hash: Uint8Array }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], FactoryError>>>;
  /**
   * Sets the `fee_to` address.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   * * `to` - The address to set as the `fee_to`.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized or if the caller is not the current `fee_to_setter`.
   */
  set_fee_to(args: { to: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], FactoryError>>>;
  /**
   * Sets the `fee_to_setter` address.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   * * `new_setter` - The address to set as the new `fee_to_setter`.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized or if the caller is not the existing `fee_to_setter`.
   */
  set_fee_to_setter(args: { new_setter: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], FactoryError>>>;
  /**
   * Sets whether fees are enabled or disabled.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   * * `is_enabled` - A boolean indicating whether fees are enabled or disabled.
   *
   * # Errors
   *
   * Returns an error if the Factory is not yet initialized or if the caller is not the current `fee_to_setter`.
   */
  set_fees_enabled(args: { is_enabled: boolean }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], FactoryError>>>;
  /**
   * Creates a pair for `token_a` and `token_b` if one doesn't exist already.
   *
   * # Arguments
   *
   * * `e` - An instance of the `Env` struct.
   * * `token_a` - The address of the first token in the pair.
   * * `token_b` - The address of the second token in the pair.
   *
   * # Errors
   *
   * Returns an error if the pair is not yet initialized, if `token_a` and `token_b` have identical addresses, or if the pair already exists between `token_a` and `token_b`.
   */
  create_pair(args: { token_a: string | Address; token_b: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<string, FactoryError>>>;
}

export class Client extends ContractClient {
  readonly options: ContractClientOptions;
  constructor(options: ContractClientOptions) {
    super(
      new Spec(["AAAAAQAAAAAAAAAAAAAAEEluaXRpYWxpemVkRXZlbnQAAAABAAAAAAAAAAZzZXR0ZXIAAAAAABM=", "AAAAAQAAAAAAAAAAAAAADE5ld1BhaXJFdmVudAAAAAQAAAAAAAAAEG5ld19wYWlyc19sZW5ndGgAAAAEAAAAAAAAAARwYWlyAAAAEwAAAAAAAAAHdG9rZW5fMAAAAAATAAAAAAAAAAd0b2tlbl8xAAAAABM=", "AAAAAQAAAAAAAAAAAAAAEEZlZVRvU2V0dGVkRXZlbnQAAAADAAAAAAAAAANuZXcAAAAAEwAAAAAAAAADb2xkAAAAABMAAAAAAAAABnNldHRlcgAAAAAAEw==", "AAAAAQAAAAAAAAAAAAAADk5ld1NldHRlckV2ZW50AAAAAAACAAAAAAAAAANuZXcAAAAAEwAAAAAAAAADb2xkAAAAABM=", "AAAAAQAAAAAAAAAAAAAAE05ld0ZlZXNFbmFibGVkRXZlbnQAAAAAAQAAAAAAAAAMZmVlc19lbmFibGVkAAAAAQ==", "AAAABAAAAAAAAAAAAAAACVBhaXJFcnJvcgAAAAAAAAEAAAA9U29yb3N3YXBGYWN0b3J5OiB0b2tlbl9hIGFuZCB0b2tlbl9iIGhhdmUgaWRlbnRpY2FsIGFkZHJlc3NlcwAAAAAAABlDcmVhdGVQYWlySWRlbnRpY2FsVG9rZW5zAAAAAAADhQ==", "AAAAAQAAAAAAAAAAAAAABFBhaXIAAAACAAAAAAAAAAEwAAAAAAAAEwAAAAAAAAABMQAAAAAAABM=", "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAABUZlZVRvAAAAAAAAAAAAAAAAAAALRmVlVG9TZXR0ZXIAAAAAAAAAAAAAAAAMUGFpcldhc21IYXNoAAAAAAAAAAAAAAALRmVlc0VuYWJsZWQAAAAAAAAAAAAAAAAKVG90YWxQYWlycwAAAAAAAQAAAAAAAAAVUGFpckFkZHJlc3Nlc05JbmRleGVkAAAAAAAAAQAAAAQAAAABAAAAAAAAABVQYWlyQWRkcmVzc2VzQnlUb2tlbnMAAAAAAAABAAAH0AAAAARQYWly", "AAAAAAAAAJtSZXR1cm5zIHRoZSByZWNpcGllbnQgb2YgdGhlIGZlZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFuIGluc3RhbmNlIG9mIHRoZSBgRW52YCBzdHJ1Y3QuCgojIEVycm9ycwoKUmV0dXJucyBhbiBlcnJvciBpZiB0aGUgRmFjdG9yeSBpcyBub3QgeWV0IGluaXRpYWxpemVkLgAAAAAGZmVlX3RvAAAAAAAAAAAAAQAAA+kAAAATAAAH0AAAAAxGYWN0b3J5RXJyb3I=", "AAAAAAAAALJSZXR1cm5zIHRoZSBhZGRyZXNzIGFsbG93ZWQgdG8gY2hhbmdlIHRoZSBmZWUgcmVjaXBpZW50LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQW4gaW5zdGFuY2Ugb2YgdGhlIGBFbnZgIHN0cnVjdC4KCiMgRXJyb3JzCgpSZXR1cm5zIGFuIGVycm9yIGlmIHRoZSBGYWN0b3J5IGlzIG5vdCB5ZXQgaW5pdGlhbGl6ZWQuAAAAAAANZmVlX3RvX3NldHRlcgAAAAAAAAAAAAABAAAD6QAAABMAAAfQAAAADEZhY3RvcnlFcnJvcg==", "AAAAAAAAAJVDaGVja3MgaWYgZmVlcyBhcmUgZW5hYmxlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFuIGluc3RhbmNlIG9mIHRoZSBgRW52YCBzdHJ1Y3QuCgojIEVycm9ycwoKUmV0dXJucyBhbiBlcnJvciBpZiB0aGUgRmFjdG9yeSBpcyBub3QgeWV0IGluaXRpYWxpemVkLgAAAAAAAAxmZWVzX2VuYWJsZWQAAAAAAAAAAQAAA+kAAAABAAAH0AAAAAxGYWN0b3J5RXJyb3I=", "AAAAAAAAAL9SZXR1cm5zIHRoZSB0b3RhbCBudW1iZXIgb2YgcGFpcnMgY3JlYXRlZCB0aHJvdWdoIHRoZSBmYWN0b3J5IHNvIGZhci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFuIGluc3RhbmNlIG9mIHRoZSBgRW52YCBzdHJ1Y3QuCgojIEVycm9ycwoKUmV0dXJucyBhbiBlcnJvciBpZiB0aGUgRmFjdG9yeSBpcyBub3QgeWV0IGluaXRpYWxpemVkLgAAAAAQYWxsX3BhaXJzX2xlbmd0aAAAAAAAAAABAAAD6QAAAAQAAAfQAAAADEZhY3RvcnlFcnJvcg==", "AAAAAAAAAWBSZXR1cm5zIHRoZSBhZGRyZXNzIG9mIHRoZSBwYWlyIGZvciBgdG9rZW5fYWAgYW5kIGB0b2tlbl9iYCwgaWYgaXQgaGFzIGJlZW4gY3JlYXRlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFuIGluc3RhbmNlIG9mIHRoZSBgRW52YCBzdHJ1Y3QuCiogYHRva2VuX2FgIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIGZpcnN0IHRva2VuIGluIHRoZSBwYWlyLgoqIGB0b2tlbl9iYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBzZWNvbmQgdG9rZW4gaW4gdGhlIHBhaXIuCgojIEVycm9ycwoKUmV0dXJucyBhbiBlcnJvciBpZiB0aGUgRmFjdG9yeSBpcyBub3QgeWV0IGluaXRpYWxpemVkIG9yIGlmIHRoZSBwYWlyIGRvZXMgbm90IGV4aXN0AAAACGdldF9wYWlyAAAAAgAAAAAAAAAHdG9rZW5fYQAAAAATAAAAAAAAAAd0b2tlbl9iAAAAABMAAAABAAAD6QAAABMAAAfQAAAADEZhY3RvcnlFcnJvcg==", "AAAAAAAAAUlSZXR1cm5zIHRoZSBhZGRyZXNzIG9mIHRoZSBudGggcGFpciAoMC1pbmRleGVkKSBjcmVhdGVkIHRocm91Z2ggdGhlIGZhY3RvcnksIG9yIGFkZHJlc3MoMCkgaWYgbm90IGVub3VnaCBwYWlycyBoYXZlIGJlZW4gY3JlYXRlZCB5ZXQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBbiBpbnN0YW5jZSBvZiB0aGUgYEVudmAgc3RydWN0LgoqIGBuYCAtIFRoZSBpbmRleCBvZiB0aGUgcGFpciB0byByZXRyaWV2ZS4KCiMgRXJyb3JzCgpSZXR1cm5zIGFuIGVycm9yIGlmIHRoZSBGYWN0b3J5IGlzIG5vdCB5ZXQgaW5pdGlhbGl6ZWQgb3IgaWYgaW5kZXggYG5gIGRvZXMgbm90IGV4aXN0LgAAAAAAAAlhbGxfcGFpcnMAAAAAAAABAAAAAAAAAAFuAAAAAAAABAAAAAEAAAPpAAAAEwAAB9AAAAAMRmFjdG9yeUVycm9y", "AAAAAAAAAS1DaGVja3MgaWYgYSBwYWlyIGV4aXN0cyBmb3IgdGhlIGdpdmVuIGB0b2tlbl9hYCBhbmQgYHRva2VuX2JgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQW4gaW5zdGFuY2Ugb2YgdGhlIGBFbnZgIHN0cnVjdC4KKiBgdG9rZW5fYWAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgZmlyc3QgdG9rZW4gaW4gdGhlIHBhaXIuCiogYHRva2VuX2JgIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIHNlY29uZCB0b2tlbiBpbiB0aGUgcGFpci4KCiMgRXJyb3JzCgpSZXR1cm5zIGFuIGVycm9yIGlmIHRoZSBGYWN0b3J5IGlzIG5vdCB5ZXQgaW5pdGlhbGl6ZWQuAAAAAAAAC3BhaXJfZXhpc3RzAAAAAAIAAAAAAAAAB3Rva2VuX2EAAAAAEwAAAAAAAAAHdG9rZW5fYgAAAAATAAAAAQAAA+kAAAABAAAH0AAAAAxGYWN0b3J5RXJyb3I=", "AAAAAAAAASdTZXRzIHRoZSBgZmVlX3RvX3NldHRlcmAgYWRkcmVzcyBhbmQgaW5pdGlhbGl6ZXMgdGhlIGZhY3RvcnkuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBbiBpbnN0YW5jZSBvZiB0aGUgYEVudmAgc3RydWN0LgoqIGBzZXR0ZXJgIC0gVGhlIGFkZHJlc3MgdG8gc2V0IGFzIHRoZSBjdXJyZW50IGBmZWVfdG9fc2V0dGVyYC4KKiBgcGFpcl93YXNtX2hhc2hgIC0gVGhlIFdhc20gaGFzaCBvZiB0aGUgcGFpci4KCiMgRXJyb3JzCgpSZXR1cm5zIGFuIGVycm9yIGlmIHRoZSBGYWN0b3J5IGlzIGFscmVhZHkgaW5pdGlhbGl6ZWQuAAAAAAppbml0aWFsaXplAAAAAAACAAAAAAAAAAZzZXR0ZXIAAAAAABMAAAAAAAAADnBhaXJfd2FzbV9oYXNoAAAAAAPuAAAAIAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADEZhY3RvcnlFcnJvcg==", "AAAAAAAAAPVTZXRzIHRoZSBgZmVlX3RvYCBhZGRyZXNzLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQW4gaW5zdGFuY2Ugb2YgdGhlIGBFbnZgIHN0cnVjdC4KKiBgdG9gIC0gVGhlIGFkZHJlc3MgdG8gc2V0IGFzIHRoZSBgZmVlX3RvYC4KCiMgRXJyb3JzCgpSZXR1cm5zIGFuIGVycm9yIGlmIHRoZSBGYWN0b3J5IGlzIG5vdCB5ZXQgaW5pdGlhbGl6ZWQgb3IgaWYgdGhlIGNhbGxlciBpcyBub3QgdGhlIGN1cnJlbnQgYGZlZV90b19zZXR0ZXJgLgAAAAAAAApzZXRfZmVlX3RvAAAAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADEZhY3RvcnlFcnJvcg==", "AAAAAAAAARBTZXRzIHRoZSBgZmVlX3RvX3NldHRlcmAgYWRkcmVzcy4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFuIGluc3RhbmNlIG9mIHRoZSBgRW52YCBzdHJ1Y3QuCiogYG5ld19zZXR0ZXJgIC0gVGhlIGFkZHJlc3MgdG8gc2V0IGFzIHRoZSBuZXcgYGZlZV90b19zZXR0ZXJgLgoKIyBFcnJvcnMKClJldHVybnMgYW4gZXJyb3IgaWYgdGhlIEZhY3RvcnkgaXMgbm90IHlldCBpbml0aWFsaXplZCBvciBpZiB0aGUgY2FsbGVyIGlzIG5vdCB0aGUgZXhpc3RpbmcgYGZlZV90b19zZXR0ZXJgLgAAABFzZXRfZmVlX3RvX3NldHRlcgAAAAAAAAEAAAAAAAAACm5ld19zZXR0ZXIAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAAxGYWN0b3J5RXJyb3I=", "AAAAAAAAASRTZXRzIHdoZXRoZXIgZmVlcyBhcmUgZW5hYmxlZCBvciBkaXNhYmxlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFuIGluc3RhbmNlIG9mIHRoZSBgRW52YCBzdHJ1Y3QuCiogYGlzX2VuYWJsZWRgIC0gQSBib29sZWFuIGluZGljYXRpbmcgd2hldGhlciBmZWVzIGFyZSBlbmFibGVkIG9yIGRpc2FibGVkLgoKIyBFcnJvcnMKClJldHVybnMgYW4gZXJyb3IgaWYgdGhlIEZhY3RvcnkgaXMgbm90IHlldCBpbml0aWFsaXplZCBvciBpZiB0aGUgY2FsbGVyIGlzIG5vdCB0aGUgY3VycmVudCBgZmVlX3RvX3NldHRlcmAuAAAAEHNldF9mZWVzX2VuYWJsZWQAAAABAAAAAAAAAAppc19lbmFibGVkAAAAAAABAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAMRmFjdG9yeUVycm9y", "AAAAAAAAAahDcmVhdGVzIGEgcGFpciBmb3IgYHRva2VuX2FgIGFuZCBgdG9rZW5fYmAgaWYgb25lIGRvZXNuJ3QgZXhpc3QgYWxyZWFkeS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFuIGluc3RhbmNlIG9mIHRoZSBgRW52YCBzdHJ1Y3QuCiogYHRva2VuX2FgIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIGZpcnN0IHRva2VuIGluIHRoZSBwYWlyLgoqIGB0b2tlbl9iYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBzZWNvbmQgdG9rZW4gaW4gdGhlIHBhaXIuCgojIEVycm9ycwoKUmV0dXJucyBhbiBlcnJvciBpZiB0aGUgcGFpciBpcyBub3QgeWV0IGluaXRpYWxpemVkLCBpZiBgdG9rZW5fYWAgYW5kIGB0b2tlbl9iYCBoYXZlIGlkZW50aWNhbCBhZGRyZXNzZXMsIG9yIGlmIHRoZSBwYWlyIGFscmVhZHkgZXhpc3RzIGJldHdlZW4gYHRva2VuX2FgIGFuZCBgdG9rZW5fYmAuAAAAC2NyZWF0ZV9wYWlyAAAAAAIAAAAAAAAAB3Rva2VuX2EAAAAAEwAAAAAAAAAHdG9rZW5fYgAAAAATAAAAAQAAA+kAAAATAAAH0AAAAAxGYWN0b3J5RXJyb3I=", "AAAABAAAAAAAAAAAAAAADEZhY3RvcnlFcnJvcgAAAAYAAAAkU29yb3N3YXBGYWN0b3J5OiBub3QgeWV0IGluaXRpYWxpemVkAAAADk5vdEluaXRpYWxpemVkAAAAAADJAAAAPVNvcm9zd2FwRmFjdG9yeTogdG9rZW5fYSBhbmQgdG9rZW5fYiBoYXZlIGlkZW50aWNhbCBhZGRyZXNzZXMAAAAAAAAZQ3JlYXRlUGFpcklkZW50aWNhbFRva2VucwAAAAAAAMoAAABAU29yb3N3YXBGYWN0b3J5OiBwYWlyIGFscmVhZHkgZXhpc3RzIGJldHdlZW4gdG9rZW5fYSBhbmQgdG9rZW5fYgAAABdDcmVhdGVQYWlyQWxyZWFkeUV4aXN0cwAAAADLAAAAJFNvcm9zd2FwRmFjdG9yeTogYWxyZWFkeSBpbml0aWFsaXplZAAAABxJbml0aWFsaXplQWxyZWFkeUluaXRpYWxpemVkAAAAzAAAACRTb3Jvc3dhcEZhY3Rvcnk6IHBhaXIgZG9lcyBub3QgZXhpc3QAAAAQUGFpckRvZXNOb3RFeGlzdAAAAM0AAAAlU29yb3N3YXBGYWN0b3J5OiBpbmRleCBkb2VzIG5vdCBleGlzdAAAAAAAABFJbmRleERvZXNOb3RFeGlzdAAAAAAAAM4="]),
      options
    );
    this.options = options;
  }

   static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  public readonly fromJson = {
    fee_to : this.txFromJson<Result<string, FactoryError>>,  fee_to_setter : this.txFromJson<Result<string, FactoryError>>,  fees_enabled : this.txFromJson<Result<boolean, FactoryError>>,  all_pairs_length : this.txFromJson<Result<number, FactoryError>>,  get_pair : this.txFromJson<Result<string, FactoryError>>,  all_pairs : this.txFromJson<Result<string, FactoryError>>,  pair_exists : this.txFromJson<Result<boolean, FactoryError>>,  initialize : this.txFromJson<Result<[], FactoryError>>,  set_fee_to : this.txFromJson<Result<[], FactoryError>>,  set_fee_to_setter : this.txFromJson<Result<[], FactoryError>>,  set_fees_enabled : this.txFromJson<Result<[], FactoryError>>,  create_pair : this.txFromJson<Result<string, FactoryError>>
  };

  /** @deprecated Use fromJson instead. */
  public readonly fromJSON = this.fromJson;

}