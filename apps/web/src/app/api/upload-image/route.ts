import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';
import { Jimp } from 'jimp';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for Vercel

/**
 * Token Logo Upload API
 *
 * SECURITY: Rate limited and size restricted
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
  // SECURITY: Rate limiting configuration
  rateLimitWindow: 3600, // 1 hour in seconds (for Redis TTL)
  maxUploadsPerHour: 10, // Max uploads per IP per hour
};

// SECURITY: Magic number signatures for file type validation
// This prevents MIME type spoofing attacks
const MAGIC_NUMBERS: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/jpg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a, GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF....WEBP)
  'image/bmp': [[0x42, 0x4D]], // BM
};

// SECURITY: Explicitly forbidden types (security risks)
const FORBIDDEN_TYPES = ['image/svg+xml', 'image/svg']; // SVG can contain JavaScript

/**
 * Validate file content matches declared MIME type using magic numbers
 * SECURITY: Prevents attackers from uploading malicious files with spoofed MIME types
 */
function validateMagicNumber(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_NUMBERS[mimeType];
  if (!signatures) return false;

  return signatures.some(sig =>
    sig.every((byte, index) => buffer[index] === byte)
  );
}

// ============================================================================
// RATE LIMITING: Production-ready with Vercel KV fallback to in-memory
// ============================================================================

// In-memory fallback for development/single-instance deployments
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit using Vercel KV (production) or in-memory (development)
 * PRODUCTION: Set KV_REST_API_URL and KV_REST_API_TOKEN environment variables
 */
async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  // PRODUCTION: Use Vercel KV for distributed rate limiting
  if (kvUrl && kvToken) {
    try {
      const key = `ratelimit:upload:${ip}`;

      // Fetch current count from KV
      const response = await fetch(`${kvUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });

      if (!response.ok && response.status !== 404) {
        console.error(`[RateLimit] KV GET failed: ${response.status}`);
        // Fallback to allowing the request on KV errors
        return { allowed: true, remaining: CONFIG.maxUploadsPerHour - 1, resetAt: now + CONFIG.rateLimitWindow * 1000 };
      }

      const data = await response.json();
      const currentCount = data.result ? parseInt(data.result, 10) : 0;

      if (currentCount >= CONFIG.maxUploadsPerHour) {
        // Get TTL for reset time
        const ttlResponse = await fetch(`${kvUrl}/ttl/${key}`, {
          headers: { Authorization: `Bearer ${kvToken}` },
        });
        const ttlData = await ttlResponse.json();
        const ttl = ttlData.result || CONFIG.rateLimitWindow;

        return { allowed: false, remaining: 0, resetAt: now + ttl * 1000 };
      }

      // Increment counter with TTL
      const incrResponse = await fetch(`${kvUrl}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, CONFIG.rateLimitWindow],
        ]),
      });

      if (!incrResponse.ok) {
        console.error(`[RateLimit] KV INCR failed: ${incrResponse.status}`);
      }

      return {
        allowed: true,
        remaining: CONFIG.maxUploadsPerHour - currentCount - 1,
        resetAt: now + CONFIG.rateLimitWindow * 1000,
      };
    } catch (error) {
      console.error('[RateLimit] KV error, falling back to memory:', error);
      // Fallback to memory on KV errors
    }
  } else if (process.env.NODE_ENV === 'production') {
    // SECURITY WARNING: Log warning in production if KV is not configured
    console.warn('[RateLimit] WARNING: Running in production without distributed rate limiting. Set KV_REST_API_URL and KV_REST_API_TOKEN for proper rate limiting across instances.');
  }

  // DEVELOPMENT/FALLBACK: In-memory rate limiting
  // Note: This won't work across serverless instances in production
  const record = memoryRateLimits.get(ip);

  // Clean up expired entries periodically (memory management)
  if (memoryRateLimits.size > 10000) {
    for (const [key, value] of memoryRateLimits) {
      if (value.resetAt < now) memoryRateLimits.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    // New window
    memoryRateLimits.set(ip, { count: 1, resetAt: now + CONFIG.rateLimitWindow * 1000 });
    return { allowed: true, remaining: CONFIG.maxUploadsPerHour - 1, resetAt: now + CONFIG.rateLimitWindow * 1000 };
  }

  if (record.count >= CONFIG.maxUploadsPerHour) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: CONFIG.maxUploadsPerHour - record.count, resetAt: record.resetAt };
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const rateLimit = await checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetAt),
        },
      }
    );
  }
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

    // SECURITY: Check for explicitly forbidden types (SVG can contain JS)
    if (FORBIDDEN_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'SVG files are not allowed for security reasons. Please use PNG, JPG, WebP, or GIF.' },
        { status: 400 }
      );
    }

    // Validate file type (strict check - only explicitly allowed types)
    if (!CONFIG.validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPG, WebP, GIF, BMP.' },
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

    // SECURITY: Validate magic numbers to prevent MIME type spoofing
    if (!validateMagicNumber(inputBuffer, file.type)) {
      console.warn(`[Upload] Magic number mismatch for IP ${ip}, claimed type: ${file.type}`);
      return NextResponse.json(
        { error: 'File content does not match declared type. Please upload a valid image.' },
        { status: 400 }
      );
    }

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
