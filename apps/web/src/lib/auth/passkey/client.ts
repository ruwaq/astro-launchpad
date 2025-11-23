/**
 * Passkey Authentication Client
 *
 * Main client for managing passkey-based authentication with Stellar
 *
 * Features:
 * - Register new passkeys (create Stellar account)
 * - Authenticate with existing passkeys
 * - Sign Stellar transactions using passkeys
 * - Store/retrieve passkey accounts
 */

'use client';

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

import {
  extractPublicKeyFromCOSE,
  publicKeyToStellarAddress,
  derSignatureToRaw,
  hashMessageForSigning,
} from './stellar-conversion';

import type {
  PasskeyAccount,
  PasskeyRegistrationResult,
  PasskeyAuthenticationResult,
  IPasskeyStorage,
} from './types';

import { LocalPasskeyStorage } from './storage';

/**
 * Passkey Client Configuration
 */
export interface PasskeyClientConfig {
  rpName: string;
  rpId: string;
  apiBaseUrl?: string;
  storage?: IPasskeyStorage;
}

/**
 * Main Passkey Client
 */
export class PasskeyClient {
  private rpName: string;
  private rpId: string;
  private apiBaseUrl: string;
  private storage: IPasskeyStorage;

  constructor(config: PasskeyClientConfig) {
    this.rpName = config.rpName;
    this.rpId = config.rpId;
    this.apiBaseUrl = config.apiBaseUrl || '/api/passkey';
    this.storage = config.storage || new LocalPasskeyStorage();
  }

  /**
   * Check if browser supports WebAuthn
   */
  isSupported(): boolean {
    return browserSupportsWebAuthn();
  }

  /**
   * Register a new passkey (create Stellar account)
   *
   * @param username - Display name for the account
   * @param options - Optional registration options
   */
  async register(
    username: string,
    options?: {
      authenticatorAttachment?: 'platform' | 'cross-platform';
      requireResidentKey?: boolean;
    }
  ): Promise<PasskeyRegistrationResult> {
    try {
      if (!this.isSupported()) {
        return {
          success: false,
          error: 'WebAuthn not supported in this browser',
        };
      }

      // 1. Get registration options from server
      const optionsResponse = await fetch(`${this.apiBaseUrl}/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options');
      }

      const registrationOptions: PublicKeyCredentialCreationOptionsJSON =
        await optionsResponse.json();

      // Apply custom options
      if (options?.authenticatorAttachment) {
        registrationOptions.authenticatorSelection = {
          ...registrationOptions.authenticatorSelection,
          authenticatorAttachment: options.authenticatorAttachment,
        };
      }

      if (options?.requireResidentKey !== undefined) {
        registrationOptions.authenticatorSelection = {
          ...registrationOptions.authenticatorSelection,
          requireResidentKey: options.requireResidentKey,
          residentKey: options.requireResidentKey ? 'required' : 'discouraged',
        };
      }

      // 2. Start WebAuthn registration
      const attResp: RegistrationResponseJSON = await startRegistration({ optionsJSON: registrationOptions });

      // 3. Verify registration with server
      const verifyResponse = await fetch(`${this.apiBaseUrl}/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          attestationResponse: attResp,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify registration');
      }

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.verified) {
        throw new Error('Registration verification failed');
      }

      // 4. Extract public key and convert to Stellar address
      const credentialPublicKey = base64UrlToUint8Array(
        verifyResult.registrationInfo.credentialPublicKey
      );

      const publicKey = extractPublicKeyFromCOSE(credentialPublicKey);
      const stellarAddress = publicKeyToStellarAddress(publicKey);

      // 5. Store account info
      const account: PasskeyAccount = {
        id: crypto.randomUUID(),
        credentialId: attResp.id,
        stellarAddress,
        publicKey: uint8ArrayToHex(publicKey),
        displayName: username,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        metadata: {
          userAgent: navigator.userAgent,
        },
      };

      await this.storage.storeAccount(account);

      return {
        success: true,
        credentialId: attResp.id,
        stellarAddress,
        publicKey: account.publicKey,
      };
    } catch (error: any) {
      console.error('Passkey registration error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed',
      };
    }
  }

  /**
   * Authenticate with existing passkey
   *
   * @param credentialId - Optional: specific credential to use
   */
  async authenticate(
    credentialId?: string
  ): Promise<PasskeyAuthenticationResult> {
    try {
      if (!this.isSupported()) {
        return {
          success: false,
          error: 'WebAuthn not supported in this browser',
        };
      }

      // 1. Get authentication options from server
      const optionsResponse = await fetch(`${this.apiBaseUrl}/authenticate/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get authentication options');
      }

      const authOptions: PublicKeyCredentialRequestOptionsJSON =
        await optionsResponse.json();

      // 2. Start WebAuthn authentication
      const authResp: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: authOptions });

      // 3. Verify authentication with server
      const verifyResponse = await fetch(`${this.apiBaseUrl}/authenticate/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authenticationResponse: authResp,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify authentication');
      }

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.verified) {
        throw new Error('Authentication verification failed');
      }

      // 4. Get account from storage
      const account = await this.storage.getAccountByCredentialId(authResp.id);

      if (!account) {
        throw new Error('Account not found');
      }

      // 5. Update last used timestamp
      await this.storage.updateLastUsed(authResp.id);

      return {
        success: true,
        stellarAddress: account.stellarAddress,
        credentialId: authResp.id,
      };
    } catch (error: any) {
      console.error('Passkey authentication error:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed',
      };
    }
  }

  /**
   * Sign a Stellar transaction using passkey
   *
   * @param stellarAddress - Stellar address of the passkey account
   * @param transactionHash - Hash of the transaction to sign
   */
  async signTransaction(
    stellarAddress: string,
    transactionHash: Uint8Array
  ): Promise<Uint8Array> {
    // Get account
    const account = await this.storage.getAccountByAddress(stellarAddress);

    if (!account) {
      throw new Error('Account not found');
    }

    // Create assertion (signature) using WebAuthn
    const challenge = await hashMessageForSigning(transactionHash);

    const authOptions: PublicKeyCredentialRequestOptionsJSON = {
      challenge: uint8ArrayToBase64Url(challenge),
      rpId: this.rpId,
      allowCredentials: [
        {
          id: account.credentialId,
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const authResp = await startAuthentication({ optionsJSON: authOptions });

    // Extract signature from response
    const signatureBuffer = base64UrlToUint8Array(authResp.response.signature);

    // Convert DER signature to raw format
    const rawSignature = derSignatureToRaw(signatureBuffer);

    return rawSignature;
  }

  /**
   * List all passkey accounts
   */
  async listAccounts(): Promise<PasskeyAccount[]> {
    return this.storage.listAccounts();
  }

  /**
   * Get account by Stellar address
   */
  async getAccount(stellarAddress: string): Promise<PasskeyAccount | null> {
    return this.storage.getAccountByAddress(stellarAddress);
  }

  /**
   * Remove passkey account
   */
  async removeAccount(stellarAddress: string): Promise<void> {
    return this.storage.removeAccount(stellarAddress);
  }
}

// ========== Utility Functions ==========

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64Url(array: Uint8Array): string {
  const binary = String.fromCharCode(...array);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function uint8ArrayToHex(array: Uint8Array): string {
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
