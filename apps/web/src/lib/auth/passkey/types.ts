/**
 * Passkey Authentication Types
 *
 * Stellar-native WebAuthn implementation using secp256r1
 * This enables users to create Stellar accounts and sign transactions
 * using biometric authentication (FaceID, TouchID, Windows Hello, etc.)
 */

import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

/**
 * Passkey registration options
 */
export interface PasskeyRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    alg: number; // -7 for ES256 (secp256r1)
    type: 'public-key';
  }>;
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct';
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey?: boolean;
    residentKey?: 'discouraged' | 'preferred' | 'required';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
}

/**
 * Passkey authentication (login) options
 */
export interface PasskeyAuthenticationOptions {
  challenge: string;
  rpId?: string;
  timeout?: number;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: Array<'usb' | 'nfc' | 'ble' | 'internal'>;
  }>;
}

/**
 * Stored passkey credential info
 */
export interface StoredPasskeyCredential {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransport[];
  createdAt: number;
  lastUsedAt: number;
}

/**
 * Passkey account - links passkey to Stellar account
 */
export interface PasskeyAccount {
  id: string;
  credentialId: string;
  stellarAddress: string;
  publicKey: string; // secp256r1 public key (hex)
  displayName: string;
  createdAt: number;
  lastUsedAt: number;
  metadata?: {
    deviceName?: string;
    userAgent?: string;
  };
}

/**
 * Passkey registration result
 */
export interface PasskeyRegistrationResult {
  success: boolean;
  credentialId?: string;
  stellarAddress?: string;
  publicKey?: string;
  error?: string;
}

/**
 * Passkey authentication result
 */
export interface PasskeyAuthenticationResult {
  success: boolean;
  stellarAddress?: string;
  credentialId?: string;
  signature?: Uint8Array;
  error?: string;
}

/**
 * Challenge for WebAuthn
 */
export interface Challenge {
  challenge: string;
  expiresAt: number;
}

/**
 * Passkey storage interface
 */
export interface IPasskeyStorage {
  // Store credential info
  storeCredential(credentialId: string, credential: StoredPasskeyCredential): Promise<void>;

  // Get credential by ID
  getCredential(credentialId: string): Promise<StoredPasskeyCredential | null>;

  // Store account info
  storeAccount(account: PasskeyAccount): Promise<void>;

  // Get account by Stellar address
  getAccountByAddress(stellarAddress: string): Promise<PasskeyAccount | null>;

  // Get account by credential ID
  getAccountByCredentialId(credentialId: string): Promise<PasskeyAccount | null>;

  // List all accounts
  listAccounts(): Promise<PasskeyAccount[]>;

  // Remove account
  removeAccount(stellarAddress: string): Promise<void>;

  // Update last used timestamp
  updateLastUsed(credentialId: string): Promise<void>;
}
