import {LaunchpadError} from './types.js';
import type {LaunchRecord, ShoutRecord, FairLaunchParams, LaunchResult, LaunchParams, ContractEvent} from './types.js';
import {Spec, AssembledTransaction, Client as ContractClient} from '@stellar/stellar-sdk/contract';
import type {Result, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address, xdr} from '@stellar/stellar-sdk';

export interface Client {
  /**
   * Real on-chain Burn-to-Chat: permanently burns holder tokens via SEP-41
   * and records the message in bounded persistent storage + emits `ShoutEvent`.
   */
  burn_shout(args: { sender: string | Address; token: string | Address; amount: bigint; message: string }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, LaunchpadError>>>;
  /**
   * Permissionlessly refreshes the launchpad instance TTL for 90 days.
   */
  extend_ttl(options?: MethodOptions): Promise<AssembledTransaction<void>>;
  /**
   * Looks up a launch record by token contract address.
   */
  get_launch(args: { token: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<LaunchRecord | null>>;
  /**
   * Returns recent on-chain Burn-to-Chat shouts for a token (oldest to newest, max 15).
   */
  get_shouts(args: { token: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Array<ShoutRecord>>>;
  /**
   * Read configuration methods
   */
  get_factory(options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  get_xlm_sac(options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  /**
   * Minimalist fair launch: enforces fixed 1B supply (7 decimals) and 99.5%
   * burned LP while storing optional compact metadata on-chain for discovery.
   */
  launch_fair(args: { params: FairLaunchParams }, options?: MethodOptions): Promise<AssembledTransaction<Result<LaunchResult, LaunchpadError>>>;
  /**
   * Returns newest-first launches from the persistent on-chain registry.
   */
  get_launches(args: { offset: number; limit: number }, options?: MethodOptions): Promise<AssembledTransaction<Array<LaunchRecord>>>;
  /**
   * Legacy-compatible single-transaction atomic fair launch with explicit supply/decimals.
   */
  launch_token(args: { params: LaunchParams }, options?: MethodOptions): Promise<AssembledTransaction<Result<LaunchResult, LaunchpadError>>>;
  get_burn_address(options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  /**
   * Returns total number of tokens launched and indexed through this launchpad.
   */
  get_launch_count(options?: MethodOptions): Promise<AssembledTransaction<number>>;
  /**
   * Permissionlessly refreshes TTL for a specific token's registry & shouts entries.
   */
  extend_launch_ttl(args: { token: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  get_token_wasm_hash(options?: MethodOptions): Promise<AssembledTransaction<Uint8Array | null>>;
}

export class Client extends ContractClient {
  readonly options: ContractClientOptions;
  constructor(options: ContractClientOptions) {
    super(
      new Spec(["AAAABQAAAAAAAAAAAAAAClNob3V0RXZlbnQAAAAAAAEAAAALc2hvdXRfZXZlbnQAAAAABQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAHbWVzc2FnZQAAAAAQAAAAAAAAAAAAAAAGbGVkZ2VyAAAAAAAEAAAAAAAAAAI=", "AAAAAQAAAAAAAAAAAAAAC1Nob3V0UmVjb3JkAAAAAAUAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAGbGVkZ2VyAAAAAAAEAAAAAAAAAAdtZXNzYWdlAAAAABAAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==", "AAAAAQAAAAAAAAAAAAAADExhdW5jaFBhcmFtcwAAAAgAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAIZGVjaW1hbHMAAAAEAAAAAAAAAA5pbml0aWFsX3N1cHBseQAAAAAACwAAAAAAAAAEbmFtZQAAABAAAAAAAAAABHNhbHQAAAPuAAAAIAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAAAAAA90b2tlbl9scF9hbW91bnQAAAAACwAAAAAAAAANeGxtX2xwX2Ftb3VudAAAAAAAAAs=", "AAAAAQAAAAAAAAAAAAAADExhdW5jaFJlY29yZAAAAA4AAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAIZGVjaW1hbHMAAAAEAAAAAAAAAAVpbmRleAAAAAAAAAQAAAAAAAAADmluaXRpYWxfc3VwcGx5AAAAAAALAAAAAAAAAAZsZWRnZXIAAAAAAAQAAAAAAAAACWxwX21pbnRlZAAAAAAAAAsAAAAAAAAABG1ldGEAAAAQAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAEcGFpcgAAABMAAAAAAAAABnN5bWJvbAAAAAAAEAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAA90b2tlbl9scF9hbW91bnQAAAAACwAAAAAAAAANeGxtX2xwX2Ftb3VudAAAAAAAAAs=", "AAAAAQAAAAAAAAAAAAAADExhdW5jaFJlc3VsdAAAAAMAAAAAAAAACWxwX21pbnRlZAAAAAAAAAsAAAAAAAAABHBhaXIAAAATAAAAAAAAAAV0b2tlbgAAAAAAABM=", "AAAAAAAAAJJSZWFsIG9uLWNoYWluIEJ1cm4tdG8tQ2hhdDogcGVybWFuZW50bHkgYnVybnMgaG9sZGVyIHRva2VucyB2aWEgU0VQLTQxCmFuZCByZWNvcmRzIHRoZSBtZXNzYWdlIGluIGJvdW5kZWQgcGVyc2lzdGVudCBzdG9yYWdlICsgZW1pdHMgYFNob3V0RXZlbnRgLgAAAAAACmJ1cm5fc2hvdXQAAAAAAAQAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAB21lc3NhZ2UAAAAAEAAAAAEAAAPpAAAAAgAAB9AAAAAOTGF1bmNocGFkRXJyb3IAAA==", "AAAAAAAAAEJQZXJtaXNzaW9ubGVzc2x5IHJlZnJlc2hlcyB0aGUgbGF1bmNocGFkIGluc3RhbmNlIFRUTCBmb3IgOTAgZGF5cy4AAAAAAApleHRlbmRfdHRsAAAAAAAAAAAAAA==", "AAAAAAAAADNMb29rcyB1cCBhIGxhdW5jaCByZWNvcmQgYnkgdG9rZW4gY29udHJhY3QgYWRkcmVzcy4AAAAACmdldF9sYXVuY2gAAAAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAPoAAAH0AAAAAxMYXVuY2hSZWNvcmQ=", "AAAAAAAAAFNSZXR1cm5zIHJlY2VudCBvbi1jaGFpbiBCdXJuLXRvLUNoYXQgc2hvdXRzIGZvciBhIHRva2VuIChvbGRlc3QgdG8gbmV3ZXN0LCBtYXggMTUpLgAAAAAKZ2V0X3Nob3V0cwAAAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAA+oAAAfQAAAAC1Nob3V0UmVjb3JkAA==", "AAAAAAAAABpSZWFkIGNvbmZpZ3VyYXRpb24gbWV0aG9kcwAAAAAAC2dldF9mYWN0b3J5AAAAAAAAAAABAAAD6AAAABM=", "AAAAAAAAAAAAAAALZ2V0X3hsbV9zYWMAAAAAAAAAAAEAAAPoAAAAEw==", "AAAAAAAAAJFNaW5pbWFsaXN0IGZhaXIgbGF1bmNoOiBlbmZvcmNlcyBmaXhlZCAxQiBzdXBwbHkgKDcgZGVjaW1hbHMpIGFuZCA5OS41JQpidXJuZWQgTFAgd2hpbGUgc3RvcmluZyBvcHRpb25hbCBjb21wYWN0IG1ldGFkYXRhIG9uLWNoYWluIGZvciBkaXNjb3ZlcnkuAAAAAAAAC2xhdW5jaF9mYWlyAAAAAAEAAAAAAAAABnBhcmFtcwAAAAAH0AAAABBGYWlyTGF1bmNoUGFyYW1zAAAAAQAAA+kAAAfQAAAADExhdW5jaFJlc3VsdAAAB9AAAAAOTGF1bmNocGFkRXJyb3IAAA==", "AAAABAAAAAAAAAAAAAAADkxhdW5jaHBhZEVycm9yAAAAAAAEAAAANUluc3RhbmNlIGNvbmZpZ3VyYXRpb24gbWlzc2luZyBmcm9tIGNvbnRyYWN0IHN0b3JhZ2UuAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAABAAAANUludmFsaWQgc3VwcGx5LCBMUCBzZWVkIGFtb3VudCwgb3IgYnVybiBzaG91dCBhbW91bnQuAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAACAAAAclRoZSB0b2tlbi9YTE0gcGFpciBhbHJlYWR5IGV4aXN0ZWQgd2l0aCBub24temVybyByZXNlcnZlczogbGlxdWlkaXR5IHdpbGwKbm90IGJlIGFkZGVkIG9uIHRvcCBvZiBhbiBleHRlcm5hbCBwYWlyLgAAAAAAEVBhaXJBbHJlYWR5U2VlZGVkAAAAAAAAAwAAAEpUb2tlbiBtZXRhZGF0YSwgc2hvdXQgbWVzc2FnZSwgb3Igb2ZmLWNoYWluIEpTT04gbWV0YWRhdGEgdmlvbGF0ZXMgYm91bmRzLgAAAAAAD0ludmFsaWRNZXRhZGF0YQAAAAAE", "AAAAAAAAAERSZXR1cm5zIG5ld2VzdC1maXJzdCBsYXVuY2hlcyBmcm9tIHRoZSBwZXJzaXN0ZW50IG9uLWNoYWluIHJlZ2lzdHJ5LgAAAAxnZXRfbGF1bmNoZXMAAAACAAAAAAAAAAZvZmZzZXQAAAAAAAQAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPqAAAH0AAAAAxMYXVuY2hSZWNvcmQ=", "AAAAAAAAAFZMZWdhY3ktY29tcGF0aWJsZSBzaW5nbGUtdHJhbnNhY3Rpb24gYXRvbWljIGZhaXIgbGF1bmNoIHdpdGggZXhwbGljaXQgc3VwcGx5L2RlY2ltYWxzLgAAAAAADGxhdW5jaF90b2tlbgAAAAEAAAAAAAAABnBhcmFtcwAAAAAH0AAAAAxMYXVuY2hQYXJhbXMAAAABAAAD6QAAB9AAAAAMTGF1bmNoUmVzdWx0AAAH0AAAAA5MYXVuY2hwYWRFcnJvcgAA", "AAAAAAAAAFdJbml0aWFsaXplcyB0aGUgbGF1bmNocGFkIGNvbmZpZ3VyYXRpb24gd2l0aCBuZXR3b3JrIGNvbnRyYWN0IGFkZHJlc3NlcyBhbmQgdG9rZW4gV0FTTS4AAAAADV9fY29uc3RydWN0b3IAAAAAAAAEAAAAAAAAAAdmYWN0b3J5AAAAABMAAAAAAAAAB3hsbV9zYWMAAAAAEwAAAAAAAAAPdG9rZW5fd2FzbV9oYXNoAAAAA+4AAAAgAAAAAAAAAAxidXJuX2FkZHJlc3MAAAATAAAAAA==", "AAAAAQAAAJhNaW5pbWFsaXN0IGZhaXItbGF1bmNoIHBhcmFtZXRlcnM6IHN1cHBseSAoMUIpLCBkZWNpbWFscyAoNyksIGFuZCA5OS41JSBMUAphbGxvY2F0aW9uIGFyZSBlbmZvcmNlZCBvbi1jaGFpbiwgcmVkdWNpbmcgdXNlciBpbnB1dCB0byBpZGVudGl0eSArIHNlZWQgWExNLgAAAAAAAAAQRmFpckxhdW5jaFBhcmFtcwAAAAYAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAEbWV0YQAAABAAAAAAAAAABG5hbWUAAAAQAAAAAAAAAARzYWx0AAAD7gAAACAAAAAAAAAABnN5bWJvbAAAAAAAEAAAAAAAAAANeGxtX2xwX2Ftb3VudAAAAAAAAAs=", "AAAAAAAAAAAAAAAQZ2V0X2J1cm5fYWRkcmVzcwAAAAAAAAABAAAD6AAAABM=", "AAAAAAAAAEtSZXR1cm5zIHRvdGFsIG51bWJlciBvZiB0b2tlbnMgbGF1bmNoZWQgYW5kIGluZGV4ZWQgdGhyb3VnaCB0aGlzIGxhdW5jaHBhZC4AAAAAEGdldF9sYXVuY2hfY291bnQAAAAAAAAAAQAAAAQ=", "AAAABQAAAAAAAAAAAAAAElRva2VuTGF1bmNoZWRFdmVudAAAAAAAAQAAABR0b2tlbl9sYXVuY2hlZF9ldmVudAAAAAcAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAAAAAABHBhaXIAAAATAAAAAAAAAAAAAAAOaW5pdGlhbF9zdXBwbHkAAAAAAAsAAAAAAAAAAAAAAA90b2tlbl9scF9hbW91bnQAAAAACwAAAAAAAAAAAAAADXhsbV9scF9hbW91bnQAAAAAAAALAAAAAAAAAAAAAAAJbHBfbWludGVkAAAAAAAACwAAAAAAAAAC", "AAAAAAAAAFBQZXJtaXNzaW9ubGVzc2x5IHJlZnJlc2hlcyBUVEwgZm9yIGEgc3BlY2lmaWMgdG9rZW4ncyByZWdpc3RyeSAmIHNob3V0cyBlbnRyaWVzLgAAABFleHRlbmRfbGF1bmNoX3R0bAAAAAAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAA=", "AAAAAAAAAAAAAAATZ2V0X3Rva2VuX3dhc21faGFzaAAAAAAAAAAAAQAAA+gAAAPuAAAAIA=="]),
      options
    );
    this.options = options;
  }

   static deploy<T = Client>(args: { factory: string | Address; xlm_sac: string | Address; token_wasm_hash: Uint8Array; burn_address: string | Address }, options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(args, options);
  }
  public readonly fromJson = {
    burn_shout : this.txFromJson<Result<null, LaunchpadError>>,  extend_ttl : this.txFromJson<void>,  get_launch : this.txFromJson<LaunchRecord | null>,  get_shouts : this.txFromJson<Array<ShoutRecord>>,  get_factory : this.txFromJson<string | null>,  get_xlm_sac : this.txFromJson<string | null>,  launch_fair : this.txFromJson<Result<LaunchResult, LaunchpadError>>,  get_launches : this.txFromJson<Array<LaunchRecord>>,  launch_token : this.txFromJson<Result<LaunchResult, LaunchpadError>>,  get_burn_address : this.txFromJson<string | null>,  get_launch_count : this.txFromJson<number>,  extend_launch_ttl : this.txFromJson<void>,  get_token_wasm_hash : this.txFromJson<Uint8Array | null>
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
   * Build a topics filter row for the "ShoutEvent" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  shoutEventEventFilter(topicValues?: { token?: string | Address }): string[] {
    return this.spec.eventTopicFilter("ShoutEvent", topicValues);
  }
  /**
   * Build a topics filter row for the "TokenLaunchedEvent" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  tokenLaunchedEventEventFilter(topicValues?: { creator?: string | Address }): string[] {
    return this.spec.eventTopicFilter("TokenLaunchedEvent", topicValues);
  }
}