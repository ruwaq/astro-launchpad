import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';
import { Jimp } from 'jimp';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for Vercel

/**
 * Token Logo Upload API
 *
 * Accepts ANY image and automatically processes it for Stellar ecosystem:
 * 1. Validate file type and size
 * 2. Auto-crop to square (center crop)
 * 3. Resize to 512x512 (standard token logo size)
 * 4. Convert to PNG with transparency support
 * 5. Optimize compression
 * 6. Upload to IPFS via Pinata
 *
 * Input: Any PNG, JPG, WebP, or GIF up to 5MB
 * Output: 512x512 PNG optimized for Stellar ecosystem
 */

// Configuration
const CONFIG = {
  validTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
  maxInputSize: 5 * 1024 * 1024, // 5MB
  outputSize: 512, // 512x512 pixels
};

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

    // Validate file type (be flexible, accept common image types)
    const isValidType = CONFIG.validTypes.includes(file.type) || file.type.startsWith('image/');
    if (!isValidType) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image file.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > CONFIG.maxInputSize) {
      return NextResponse.json(
        { error: `File too large. Maximum: ${CONFIG.maxInputSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Load image with Jimp
    const image = await Jimp.read(inputBuffer);
    const width = image.width;
    const height = image.height;

    if (!width || !height) {
      return NextResponse.json(
        { error: 'Could not read image dimensions' },
        { status: 400 }
      );
    }

    // Calculate if image needs cropping
    const isSquare = Math.abs(width - height) / Math.max(width, height) < 0.05;
    const cropSize = Math.min(width, height);

    // Process image with Jimp:
    // 1. Extract square from center (if not already square)
    // 2. Resize to 512x512
    // 3. Convert to PNG

    // If not square, crop to center
    if (!isSquare) {
      const left = Math.floor((width - cropSize) / 2);
      const top = Math.floor((height - cropSize) / 2);
      image.crop({ x: left, y: top, w: cropSize, h: cropSize });
    }

    // Resize to target size
    image.resize({ w: CONFIG.outputSize, h: CONFIG.outputSize });

    // Get PNG buffer
    const processedBuffer = await image.getBuffer('image/png');

    // Create a new File object with processed image
    // Convert Buffer to Uint8Array for File constructor compatibility
    const processedFile = new File(
      [new Uint8Array(processedBuffer)],
      `token-logo-${Date.now()}.png`,
      { type: 'image/png' }
    );

    // Initialize Pinata SDK
    const pinata = new PinataSDK({
      pinataJwt,
      pinataGateway: pinataGateway || undefined,
    });

    // Upload to IPFS via public network
    const upload = await pinata.upload.public.file(processedFile);

    // Generate IPFS URL
    const ipfsUrl = `ipfs://${upload.cid}`;

    // Generate HTTP gateway URL
    const gatewayUrl = pinataGateway
      ? `https://${pinataGateway}/ipfs/${upload.cid}`
      : `https://gateway.pinata.cloud/ipfs/${upload.cid}`;

    return NextResponse.json({
      success: true,
      ipfsHash: upload.cid,
      ipfsUrl,
      gatewayUrl,
      processed: {
        originalSize: file.size,
        processedSize: processedBuffer.length,
        originalDimensions: `${width}x${height}`,
        outputDimensions: `${CONFIG.outputSize}x${CONFIG.outputSize}`,
        format: 'PNG',
        wasCropped: !isSquare,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error processing/uploading image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process and upload image' },
      { status: 500 }
    );
  }
}
