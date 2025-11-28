/**
 * Passkey Registration Verification API
 *
 * Verifies WebAuthn registration response using stateless HMAC-signed challenge tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRegistrationResponse,
  type VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import crypto from 'crypto';

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000';

// Same secret as options endpoint (MUST be set in production)
// SECURITY: In production, this MUST be set via environment variable
function getSecretKey(): string {
  const secret = process.env.PASSKEY_CHALLENGE_SECRET;

  if (secret) {
    return secret;
  }

  // In production, require the secret (checked at runtime, not build time)
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: PASSKEY_CHALLENGE_SECRET environment variable is required in production');
    throw new Error('Server configuration error');
  }

  // Development-only insecure fallback
  return 'dev-only-insecure-secret-' + (process.pid || 'build');
}

interface ChallengePayload {
  challenge: string;
  userId: string;
  expiresAt: number;
}

/**
 * Verify and extract challenge from signed token
 * Returns the challenge if valid, null if invalid/expired
 */
function verifyAndExtractChallenge(challengeToken: string): ChallengePayload | null {
  try {
    // Decode the token
    const decoded = JSON.parse(Buffer.from(challengeToken, 'base64url').toString());
    const { payload, signature } = decoded;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', getSecretKey())
      .update(payload)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )) {
      console.error('Invalid challenge token signature');
      return null;
    }

    // Parse and validate payload
    const parsedPayload: ChallengePayload = JSON.parse(payload);

    // Check expiration
    if (parsedPayload.expiresAt < Date.now()) {
      console.error('Challenge token expired');
      return null;
    }

    return parsedPayload;
  } catch (error) {
    console.error('Error parsing challenge token:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attestationResponse, challengeToken } = body;

    if (!attestationResponse) {
      return NextResponse.json(
        { error: 'Attestation response is required' },
        { status: 400 }
      );
    }

    if (!challengeToken) {
      return NextResponse.json(
        { error: 'Challenge token is required' },
        { status: 400 }
      );
    }

    // Verify and extract challenge from signed token
    const challengeData = verifyAndExtractChallenge(challengeToken);
    if (!challengeData) {
      return NextResponse.json(
        { error: 'Invalid or expired challenge token' },
        { status: 400 }
      );
    }

    const attResp: RegistrationResponseJSON = attestationResponse;

    // Verify the registration response
    const opts: VerifyRegistrationResponseOpts = {
      response: attResp,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    };

    const verification = await verifyRegistrationResponse(opts);

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    // Return verification info including public key
    return NextResponse.json({
      verified: true,
      registrationInfo: {
        credentialID: verification.registrationInfo?.credential?.id,
        credentialPublicKey: Buffer.from(
          verification.registrationInfo?.credential?.publicKey || []
        ).toString('base64url'),
        counter: verification.registrationInfo?.credential?.counter,
        credentialDeviceType: verification.registrationInfo?.credentialDeviceType,
        credentialBackedUp: verification.registrationInfo?.credentialBackedUp,
      },
    });
  } catch (error: any) {
    // SECURITY: Log detailed error server-side but return generic message to client
    console.error('Error verifying registration:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
