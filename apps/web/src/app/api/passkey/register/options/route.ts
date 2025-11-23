/**
 * Passkey Registration Options API
 *
 * Generates WebAuthn registration options for creating new passkeys
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  type GenerateRegistrationOptionsOpts,
} from '@simplewebauthn/server';

// In production, store these in environment variables
const RP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Astro Shiba';
const RP_ID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000';

// In production, use a database to store challenges
// For demo, we use a simple in-memory map (will be lost on restart)
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

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
      userID: new TextEncoder().encode(userId),
      userName: username,
      userDisplayName: username,
      // Stellar uses secp256r1 (ES256, alg -7)
      // This is the CRITICAL part that makes Stellar compatible
      attestationType: 'none',
      authenticatorSelection: {
        // Platform authenticators (FaceID, TouchID, Windows Hello)
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

    // Store challenge for verification (expires in 5 minutes)
    challengeStore.set(userId, {
      challenge: registrationOptions.challenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // Clean up expired challenges
    for (const [id, data] of challengeStore.entries()) {
      if (data.expiresAt < Date.now()) {
        challengeStore.delete(id);
      }
    }

    return NextResponse.json(registrationOptions);
  } catch (error: any) {
    console.error('Error generating registration options:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
