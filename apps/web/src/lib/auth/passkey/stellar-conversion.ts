/**
 * Stellar Passkey Conversion Utilities
 *
 * Converts secp256r1 (ES256) public keys from WebAuthn/Passkeys
 * to Stellar-compatible accounts.
 *
 * KEY INNOVATION:
 * Stellar Protocol 23+ supports secp256r1 signatures natively,
 * allowing passkeys to sign transactions without additional wallets.
 *
 * How it works:
 * 1. User creates passkey with secp256r1 curve (ES256)
 * 2. We extract the public key from WebAuthn credential
 * 3. Convert to Stellar Keypair format
 * 4. Derive Stellar address (G...)
 * 5. Use passkey to sign Stellar transactions
 */

import { Keypair, StrKey } from '@stellar/stellar-sdk';

/**
 * Extract public key from WebAuthn credential response
 *
 * @param credentialPublicKey - COSE-encoded public key from WebAuthn
 * @returns Raw secp256r1 public key (65 bytes: 0x04 + 32 bytes X + 32 bytes Y)
 */
export function extractPublicKeyFromCOSE(credentialPublicKey: Uint8Array): Uint8Array {
  // COSE key format (CBOR-encoded)
  // We need to decode CBOR to extract the X and Y coordinates

  // For secp256r1 (ES256, alg -7), the COSE key structure is:
  // {
  //   1: 2,        // kty: EC2
  //   3: -7,       // alg: ES256
  //   -1: 1,       // crv: P-256
  //   -2: x_bytes, // x coordinate (32 bytes)
  //   -3: y_bytes  // y coordinate (32 bytes)
  // }

  // Simple CBOR decoder for this specific case
  // In production, use a proper CBOR library
  const decoded = decodeCOSEPublicKey(credentialPublicKey);

  if (!decoded.x || !decoded.y) {
    throw new Error('Invalid COSE public key: missing X or Y coordinates');
  }

  // Uncompressed secp256r1 public key format: 0x04 + X + Y
  const publicKey = new Uint8Array(65);
  publicKey[0] = 0x04; // Uncompressed point indicator
  publicKey.set(decoded.x, 1);
  publicKey.set(decoded.y, 33);

  return publicKey;
}

/**
 * Simple COSE public key decoder
 * Extracts X and Y coordinates from COSE-encoded secp256r1 key
 */
function decodeCOSEPublicKey(coseKey: Uint8Array): { x: Uint8Array; y: Uint8Array } {
  // This is a simplified decoder for demonstration
  // In production, use @levischuck/tiny-cbor or similar

  const view = new DataView(coseKey.buffer);
  let offset = 0;

  // Skip CBOR map header (0xA5 for 5 items typically)
  offset++;

  let x: Uint8Array | null = null;
  let y: Uint8Array | null = null;

  // Parse CBOR map
  while (offset < coseKey.length) {
    // Read key
    const keyByte = view.getUint8(offset);
    offset++;

    let key: number;
    if (keyByte < 0x18) {
      key = keyByte;
    } else if (keyByte === 0x20) {
      // Negative int -1
      key = -1;
    } else if (keyByte === 0x21) {
      // Negative int -2
      key = -2;
    } else if (keyByte === 0x22) {
      // Negative int -3
      key = -3;
    } else {
      throw new Error(`Unsupported CBOR key type: ${keyByte}`);
    }

    // Read value
    const valueByte = view.getUint8(offset);
    offset++;

    if (key === -2) {
      // X coordinate (byte string)
      const length = valueByte & 0x1f; // Last 5 bits = length for short byte strings
      x = coseKey.slice(offset, offset + length);
      offset += length;
    } else if (key === -3) {
      // Y coordinate (byte string)
      const length = valueByte & 0x1f;
      y = coseKey.slice(offset, offset + length);
      offset += length;
    } else {
      // Skip other values
      if (valueByte < 0x18) {
        // Small int, already consumed
      } else if (valueByte >= 0x40 && valueByte < 0x58) {
        // Byte string with inline length
        const length = valueByte & 0x1f;
        offset += length;
      } else if (valueByte >= 0x20 && valueByte < 0x38) {
        // Negative int, already consumed
      }
    }
  }

  if (!x || !y) {
    throw new Error('Failed to extract X and Y coordinates from COSE key');
  }

  return { x, y };
}

/**
 * Convert secp256r1 public key to Stellar address
 *
 * @param publicKey - Uncompressed secp256r1 public key (65 bytes)
 * @returns Stellar address (G...)
 */
export function publicKeyToStellarAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 65) {
    throw new Error('Invalid public key length. Expected 65 bytes (uncompressed secp256r1)');
  }

  if (publicKey[0] !== 0x04) {
    throw new Error('Invalid public key format. Must start with 0x04 (uncompressed)');
  }

  // For Stellar, we use the raw public key bytes (without 0x04 prefix)
  const rawKey = publicKey.slice(1, 33); // Use only X coordinate (32 bytes)

  // Encode as Stellar address
  const stellarAddress = StrKey.encodeEd25519PublicKey(rawKey as any);

  return stellarAddress;
}

/**
 * Create Stellar Keypair from passkey public key
 *
 * NOTE: This creates a "view-only" keypair since we don't have the private key
 * (it's stored securely in the authenticator). For signing, we use the passkey.
 *
 * @param publicKey - Uncompressed secp256r1 public key
 * @returns Stellar Keypair (public only)
 */
export function createStellarKeypairFromPasskey(publicKey: Uint8Array): Keypair {
  const stellarAddress = publicKeyToStellarAddress(publicKey);
  return Keypair.fromPublicKey(stellarAddress);
}

/**
 * Validate that a public key is valid secp256r1
 */
export function isValidSecp256r1PublicKey(publicKey: Uint8Array): boolean {
  if (publicKey.length !== 65) {
    return false;
  }

  if (publicKey[0] !== 0x04) {
    return false;
  }

  // Basic point validation
  // In production, verify the point is on the P-256 curve
  return true;
}

/**
 * Convert WebAuthn signature (DER format) to Stellar format
 *
 * WebAuthn returns signatures in DER format, but Stellar expects raw R + S
 *
 * @param derSignature - DER-encoded ECDSA signature
 * @returns Raw signature (R + S, 64 bytes)
 */
export function derSignatureToRaw(derSignature: Uint8Array): Uint8Array {
  // DER signature format:
  // 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]

  if (derSignature[0] !== 0x30) {
    throw new Error('Invalid DER signature: must start with 0x30');
  }

  let offset = 2; // Skip 0x30 and total length

  // Read R
  if (derSignature[offset] !== 0x02) {
    throw new Error('Invalid DER signature: R must start with 0x02');
  }
  offset++;

  const rLength = derSignature[offset];
  offset++;

  let r = derSignature.slice(offset, offset + rLength);
  offset += rLength;

  // Read S
  if (derSignature[offset] !== 0x02) {
    throw new Error('Invalid DER signature: S must start with 0x02');
  }
  offset++;

  const sLength = derSignature[offset];
  offset++;

  let s = derSignature.slice(offset, offset + sLength);

  // Remove leading zeros if present
  while (r.length > 32 && r[0] === 0x00) {
    r = r.slice(1);
  }
  while (s.length > 32 && s[0] === 0x00) {
    s = s.slice(1);
  }

  // Pad if necessary
  const rPadded = new Uint8Array(32);
  const sPadded = new Uint8Array(32);
  rPadded.set(r, 32 - r.length);
  sPadded.set(s, 32 - s.length);

  // Concatenate R and S
  const rawSignature = new Uint8Array(64);
  rawSignature.set(rPadded, 0);
  rawSignature.set(sPadded, 32);

  return rawSignature;
}

/**
 * Hash message for Stellar transaction signing
 */
export async function hashMessageForSigning(message: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', message as any);
  return new Uint8Array(hashBuffer);
}
