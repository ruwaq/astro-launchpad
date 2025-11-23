/**
 * Passkey Registration Verification API
 *
 * Verifies WebAuthn registration response
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRegistrationResponse,
  type VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000';

// Shared challenge store (same as options endpoint)
// In production, use Redis or database
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, attestationResponse } = body;

    if (!attestationResponse) {
      return NextResponse.json(
        { error: 'Attestation response is required' },
        { status: 400 }
      );
    }

    const attResp: RegistrationResponseJSON = attestationResponse;

    // Find challenge (in production, look up by session/user ID)
    let expectedChallenge: string | undefined;
    for (const [id, data] of challengeStore.entries()) {
      if (data.expiresAt > Date.now()) {
        expectedChallenge = data.challenge;
        challengeStore.delete(id); // Use once
        break;
      }
    }

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'Challenge not found or expired' },
        { status: 400 }
      );
    }

    // Verify the registration response
    const opts: VerifyRegistrationResponseOpts = {
      response: attResp,
      expectedChallenge,
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
        credentialID: verification.registrationInfo?.credentialID,
        credentialPublicKey: Buffer.from(
          verification.registrationInfo?.credentialPublicKey || []
        ).toString('base64url'),
        counter: verification.registrationInfo?.counter,
        credentialDeviceType: verification.registrationInfo?.credentialDeviceType,
        credentialBackedUp: verification.registrationInfo?.credentialBackedUp,
      },
    });
  } catch (error: any) {
    console.error('Error verifying registration:', error);
    return NextResponse.json(
      { error: 'Verification failed: ' + error.message },
      { status: 500 }
    );
  }
}
