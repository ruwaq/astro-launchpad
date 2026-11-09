import {LaunchpadError} from './types.js';
import type {LaunchParams, LaunchResult, ContractEvent} from './types.js';
import {Spec, AssembledTransaction, Client as ContractClient} from '@stellar/stellar-sdk/contract';
import type {Result, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address, xdr} from '@stellar/stellar-sdk';

export interface Client {
  /**
   * Read configuration methods
   */
  get_factory(options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  get_xlm_sac(options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  /**
   * Single-transaction atomic fair launch:
   * 1. Pulls XLM from creator.
   * 2. Deploys token contract and mints initial supply to launchpad.
   * 3. Sends remaining creator share (`initial_supply - token_lp_amount`).
   * 4. ALWAYS renounces token ownership (minting locked forever).
   * 5. Creates pair on Soroswap (or reuses an EMPTY existing pair).
   * 6. Deposits liquidity directly into pair.
   * 7. ALWAYS mints 100% of LP tokens to the burn address.
   */
  launch_token(args: { params: LaunchParams }, options?: MethodOptions): Promise<AssembledTransaction<Result<LaunchResult, LaunchpadError>>>;
  get_burn_address(options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  get_token_wasm_hash(options?: MethodOptions): Promise<AssembledTransaction<Uint8Array | null>>;
}

export class Client extends ContractClient {
  readonly options: ContractClientOptions;
  constructor(options: ContractClientOptions) {
    super(
      new Spec(["AAAAAQAAAAAAAAAAAAAADExhdW5jaFBhcmFtcwAAAAgAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAIZGVjaW1hbHMAAAAEAAAAAAAAAA5pbml0aWFsX3N1cHBseQAAAAAACwAAAAAAAAAEbmFtZQAAABAAAAAAAAAABHNhbHQAAAPuAAAAIAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAAAAAA90b2tlbl9scF9hbW91bnQAAAAACwAAAAAAAAANeGxtX2xwX2Ftb3VudAAAAAAAAAs=", "AAAAAQAAAAAAAAAAAAAADExhdW5jaFJlc3VsdAAAAAMAAAAAAAAACWxwX21pbnRlZAAAAAAAAAsAAAAAAAAABHBhaXIAAAATAAAAAAAAAAV0b2tlbgAAAAAAABM=", "AAAABAAAAAAAAAAAAAAADkxhdW5jaHBhZEVycm9yAAAAAAADAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAQAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAIAAAC0RWwgcGFyIHRva2VuL1hMTSB5YSBleGlzdMOtYSB5IHRpZW5lIHJlc2VydmFzOiBubyBzZSB2YSBhIGHDsWFkaXIKbGlxdWlkZXogZW5jaW1hIGRlIHVuIHBhciBhamVubyAoZWwgTFAgYWN1w7FhZG8gc2Vyw61hIGNvbGF0ZXJhbCBkZQp1bmEgcG9zaWNpw7NuIHF1ZSBlc3RlIGxhdW5jaHBhZCBubyBjb250cm9sYSkuAAAAEVBhaXJBbHJlYWR5U2VlZGVkAAAAAAAAAw==", "AAAABQAAAAAAAAAAAAAAElRva2VuTGF1bmNoZWRFdmVudAAAAAAAAQAAABR0b2tlbl9sYXVuY2hlZF9ldmVudAAAAAcAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAAAAAABHBhaXIAAAATAAAAAAAAAAAAAAAOaW5pdGlhbF9zdXBwbHkAAAAAAAsAAAAAAAAAAAAAAA90b2tlbl9scF9hbW91bnQAAAAACwAAAAAAAAAAAAAADXhsbV9scF9hbW91bnQAAAAAAAALAAAAAAAAAAAAAAAJbHBfbWludGVkAAAAAAAACwAAAAAAAAAC", "AAAAAAAAABpSZWFkIGNvbmZpZ3VyYXRpb24gbWV0aG9kcwAAAAAAC2dldF9mYWN0b3J5AAAAAAAAAAABAAAD6AAAABM=", "AAAAAAAAAAAAAAALZ2V0X3hsbV9zYWMAAAAAAAAAAAEAAAPoAAAAEw==", "AAAAAAAAAahTaW5nbGUtdHJhbnNhY3Rpb24gYXRvbWljIGZhaXIgbGF1bmNoOgoxLiBQdWxscyBYTE0gZnJvbSBjcmVhdG9yLgoyLiBEZXBsb3lzIHRva2VuIGNvbnRyYWN0IGFuZCBtaW50cyBpbml0aWFsIHN1cHBseSB0byBsYXVuY2hwYWQuCjMuIFNlbmRzIHJlbWFpbmluZyBjcmVhdG9yIHNoYXJlIChgaW5pdGlhbF9zdXBwbHkgLSB0b2tlbl9scF9hbW91bnRgKS4KNC4gQUxXQVlTIHJlbm91bmNlcyB0b2tlbiBvd25lcnNoaXAgKG1pbnRpbmcgbG9ja2VkIGZvcmV2ZXIpLgo1LiBDcmVhdGVzIHBhaXIgb24gU29yb3N3YXAgKG9yIHJldXNlcyBhbiBFTVBUWSBleGlzdGluZyBwYWlyKS4KNi4gRGVwb3NpdHMgbGlxdWlkaXR5IGRpcmVjdGx5IGludG8gcGFpci4KNy4gQUxXQVlTIG1pbnRzIDEwMCUgb2YgTFAgdG9rZW5zIHRvIHRoZSBidXJuIGFkZHJlc3MuAAAADGxhdW5jaF90b2tlbgAAAAEAAAAAAAAABnBhcmFtcwAAAAAH0AAAAAxMYXVuY2hQYXJhbXMAAAABAAAD6QAAB9AAAAAMTGF1bmNoUmVzdWx0AAAH0AAAAA5MYXVuY2hwYWRFcnJvcgAA", "AAAAAAAAAFdJbml0aWFsaXplcyB0aGUgbGF1bmNocGFkIGNvbmZpZ3VyYXRpb24gd2l0aCBuZXR3b3JrIGNvbnRyYWN0IGFkZHJlc3NlcyBhbmQgdG9rZW4gV0FTTS4AAAAADV9fY29uc3RydWN0b3IAAAAAAAAEAAAAAAAAAAdmYWN0b3J5AAAAABMAAAAAAAAAB3hsbV9zYWMAAAAAEwAAAAAAAAAPdG9rZW5fd2FzbV9oYXNoAAAAA+4AAAAgAAAAAAAAAAxidXJuX2FkZHJlc3MAAAATAAAAAA==", "AAAAAAAAAAAAAAAQZ2V0X2J1cm5fYWRkcmVzcwAAAAAAAAABAAAD6AAAABM=", "AAAAAAAAAAAAAAATZ2V0X3Rva2VuX3dhc21faGFzaAAAAAAAAAAAAQAAA+gAAAPuAAAAIA=="]),
      options
    );
    this.options = options;
  }

   static deploy<T = Client>(args: { factory: string | Address; xlm_sac: string | Address; token_wasm_hash: Uint8Array; burn_address: string | Address }, options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(args, options);
  }
  public readonly fromJson = {
    get_factory : this.txFromJson<string | null>,  get_xlm_sac : this.txFromJson<string | null>,  launch_token : this.txFromJson<Result<LaunchResult, LaunchpadError>>,  get_burn_address : this.txFromJson<string | null>,  get_token_wasm_hash : this.txFromJson<Uint8Array | null>
  };

  /** @deprecated Use fromJson instead. */
  public readonly fromJSON = this.fromJson;

  /**
   * Parse a raw contract event (topics + data) into a typed {@link ContractEvent}.
   */
  parseEvent(topics: xdr.ScVal[] | string[], data: xdr.ScVal | string): ContractEvent | undefined {
    return this.spec.parseEvent(topics, data) as ContractEvent | undefined;
  }
  /**
   * Build a topics filter row for the "TokenLaunchedEvent" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  tokenLaunchedEventEventFilter(topicValues?: { creator?: string | Address }): string[] {
    return this.spec.eventTopicFilter("TokenLaunchedEvent", topicValues);
  }
}