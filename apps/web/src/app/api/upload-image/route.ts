import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for Vercel

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    const pinataJwt = process.env.PINATA_JWT;
    const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;

    if (!pinataJwt) {
      return NextResponse.json(
        { error: 'PINATA_JWT not configured' },
        { status: 500 }
      );
    }

    // Get the file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP, SVG)' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Initialize Pinata SDK
    const pinata = new PinataSDK({
      pinataJwt,
      pinataGateway: pinataGateway || undefined,
    });

    // Upload to IPFS via public network
    const upload = await pinata.upload.public.file(file);

    // Generate IPFS URL
    const ipfsUrl = `ipfs://${upload.cid}`;

    // Generate HTTP gateway URL if gateway is configured
    const gatewayUrl = pinataGateway
      ? `https://${pinataGateway}/ipfs/${upload.cid}`
      : `https://gateway.pinata.cloud/ipfs/${upload.cid}`;

    return NextResponse.json({
      success: true,
      ipfsHash: upload.cid,
      ipfsUrl,
      gatewayUrl,
      size: upload.size,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error uploading to IPFS:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image to IPFS' },
      { status: 500 }
    );
  }
}
