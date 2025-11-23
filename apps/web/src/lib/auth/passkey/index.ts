/**
 * Passkey Authentication Module
 *
 * Stellar-native WebAuthn authentication using secp256r1
 */

export { PasskeyClient } from './client';
export { LocalPasskeyStorage, clearAllPasskeyData } from './storage';

export type {
  PasskeyAccount,
  PasskeyRegistrationResult,
  PasskeyAuthenticationResult,
  IPasskeyStorage,
  PasskeyRegistrationOptions,
  PasskeyAuthenticationOptions,
} from './types';

export {
  extractPublicKeyFromCOSE,
  publicKeyToStellarAddress,
  createStellarKeypairFromPasskey,
  derSignatureToRaw,
  hashMessageForSigning,
} from './stellar-conversion';
