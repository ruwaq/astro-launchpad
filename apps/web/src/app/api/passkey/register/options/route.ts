/**
 * Passkey Registration Options API
 *
 * Generates WebAuthn registration options for creating new passkeys
 * Uses stateless HMAC-signed challenge tokens for serverless compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  type GenerateRegistrationOptionsOpts,
} from '@simplewebauthn/server';
import crypto from 'crypto';
import { getSecretKey } from '../secret.js';

// In production, store these in environment variables
const RP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Astro Shiba';
const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';

/**
 * Sign a challenge with expiration for stateless verification
 * Returns: base64url encoded JSON { challenge, userId, expiresAt, signature }
 */
function signChallenge(challenge: string, userId: string): string {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  const payload = JSON.stringify({ challenge, userId, expiresAt });

  // Create HMAC signature
  const signature = crypto
    .createHmac('sha256', getSecretKey())
    .update(payload)
    .digest('base64url');

  // Combine payload + signature
  const token = Buffer.from(JSON.stringify({
    payload,
    signature,
  })).toString('base64url');

  return token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Generate a unique user ID
    const userId = crypto.randomUUID();

    // Generate registration options
    const options: GenerateRegistrationOptionsOpts = {
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(userId) as any,
      userName: username,
      userDisplayName: username,
      // Stellar uses secp256r1 (ES256, alg -7)
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        residentKey: 'required',
        userVerification: 'required',
      },
      // Force secp256r1 (ES256) which Stellar Protocol 23+ supports
      supportedAlgorithmIDs: [-7], // ES256 only
      timeout: 60000,
    };

    const registrationOptions = await generateRegistrationOptions(options);

    // Create stateless signed challenge token
    const challengeToken = signChallenge(registrationOptions.challenge, userId);

    return NextResponse.json({
      ...registrationOptions,
      // Include the signed token for the client to send back
      challengeToken,
    });
  } catch (error: unknown) {
    console.error('Error generating registration options:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
