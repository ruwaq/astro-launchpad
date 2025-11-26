'use client';

import { useState, useRef } from 'react';
import NextImage from 'next/image';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Info, Crop } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Token Logo Upload (Stellar Ecosystem Compatible)
 *
 * Accepts any image format and automatically processes it:
 * - Auto-crops to square (center crop)
 * - Resizes to 512x512 pixels
 * - Converts to PNG format
 * - Optimizes for IPFS storage
 *
 * Input: Any PNG, JPG, or WebP image up to 5MB
 * Output: 512x512 PNG optimized for Stellar ecosystem
 */

// Image validation constants
const IMAGE_CONFIG = {
  validTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  maxSizeMB: 5,
  minDimension: 100, // Lowered minimum
  maxDimension: 8192, // Increased maximum
  targetSize: 512, // Server will resize to this
};

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  width?: number;
  height?: number;
  isSquare?: boolean;
}

export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(value || '');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Validate image dimensions by loading it
   * Now more flexible - accepts any aspect ratio, server will auto-crop
   */
  const validateImageDimensions = (file: File): Promise<ImageValidationResult> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const { width, height } = img;

        // Check minimum dimensions (at least one side must be >= minDimension)
        const minSide = Math.min(width, height);
        if (minSide < IMAGE_CONFIG.minDimension) {
          resolve({
            valid: false,
            error: `Image too small. Minimum size: ${IMAGE_CONFIG.minDimension}px. Current: ${width}x${height}`,
            width,
            height,
          });
          return;
        }

        // Check maximum dimensions
        const maxSide = Math.max(width, height);
        if (maxSide > IMAGE_CONFIG.maxDimension) {
          resolve({
            valid: false,
            error: `Image too large. Maximum: ${IMAGE_CONFIG.maxDimension}px. Current: ${width}x${height}`,
            width,
            height,
          });
          return;
        }

        // Check if square (allow 5% tolerance)
        const aspectRatio = width / height;
        const isSquare = aspectRatio >= 0.95 && aspectRatio <= 1.05;

        // Valid, but add warning if not square
        resolve({
          valid: true,
          width,
          height,
          isSquare,
          warning: !isSquare ? `Image will be center-cropped to square` : undefined,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ valid: false, error: 'Failed to load image. File may be corrupted.' });
      };

      img.src = objectUrl;
    });
  };

  const [willBeCropped, setWillBeCropped] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setImageDimensions(null);
    setWillBeCropped(false);

    // Validate file type (accept common formats)
    if (!IMAGE_CONFIG.validTypes.includes(file.type)) {
      toast.error('Invalid format. Use PNG, JPG, WebP, or GIF');
      return;
    }

    // Validate file size
    const maxSize = IMAGE_CONFIG.maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum: ${IMAGE_CONFIG.maxSizeMB}MB`);
      return;
    }

    // Validate dimensions
    const validation = await validateImageDimensions(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid image');
      return;
    }

    setImageDimensions({ width: validation.width!, height: validation.height! });
    setWillBeCropped(!validation.isSquare);

    // Show warning if image will be cropped
    if (validation.warning) {
      toast(validation.warning, { icon: '✂️', duration: 3000 });
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to IPFS
    await uploadToIPFS(file);
  };

  const uploadToIPFS = async (file: File) => {
    setIsUploading(true);
    setUploadStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await response.json();

      // Use IPFS URL for the token metadata
      onChange(data.ipfsUrl);

      setUploadStatus('success');
      toast.success('Image uploaded to IPFS successfully!');

      // Show success for 2 seconds, then back to idle
      setTimeout(() => {
        setUploadStatus('idle');
      }, 2000);

    } catch (error: any) {
      console.error('Error uploading image:', error);
      setUploadStatus('error');
      toast.error(error.message || 'Failed to upload image to IPFS');

      // Clear preview on error
      setPreviewUrl('');
      onChange('');

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
      }, 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl('');
    onChange('');
    setUploadStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.gif,image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Requirements Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">Upload any image - we&apos;ll optimize it!</p>
            <ul className="space-y-0.5">
              <li>• <span className="font-medium">Formats:</span> PNG, JPG, WebP, GIF</li>
              <li>• <span className="font-medium">Max size:</span> 5MB</li>
              <li>• Non-square images will be center-cropped</li>
              <li>• Output: 512×512 PNG (Stellar compatible)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      {!previewUrl ? (
        <div
          onClick={handleClick}
          className={`
            relative border-2 border-dashed rounded-xl p-8 transition-all
            ${disabled || isUploading
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-brand-primary-200 bg-brand-primary-50 hover:border-brand-primary hover:bg-brand-primary-100 cursor-pointer'
            }
          `}
        >
          <div className="flex flex-col items-center justify-center gap-3">
            {uploadStatus === 'uploading' ? (
              <Loader2 className="h-12 w-12 text-brand-primary animate-spin" />
            ) : uploadStatus === 'success' ? (
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            ) : uploadStatus === 'error' ? (
              <AlertCircle className="h-12 w-12 text-red-600" />
            ) : (
              <Upload className="h-12 w-12 text-brand-primary" />
            )}

            <div className="text-center">
              <p className="font-semibold text-ui-text-primary">
                {uploadStatus === 'uploading' && 'Uploading to IPFS...'}
                {uploadStatus === 'success' && 'Upload successful!'}
                {uploadStatus === 'error' && 'Upload failed'}
                {uploadStatus === 'idle' && 'Click to upload your logo'}
              </p>
              <p className="text-sm text-ui-text-secondary mt-1">
                {uploadStatus === 'idle' && 'Any format • Auto-optimized • Max 5MB'}
                {uploadStatus === 'uploading' && 'Processing and optimizing...'}
                {uploadStatus === 'success' && 'Image stored on IPFS'}
                {uploadStatus === 'error' && 'Please try again'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Preview */
        <div className="relative border-2 border-brand-primary-200 rounded-xl overflow-hidden bg-gray-50">
          <div className="relative aspect-square max-w-[256px] mx-auto">
            <NextImage
              src={previewUrl}
              alt="Token preview"
              width={256}
              height={256}
              className="w-full h-full object-contain"
              unoptimized
            />
          </div>

          {/* Remove Button */}
          {!disabled && !isUploading && (
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Upload Status Badge */}
          {uploadStatus !== 'idle' && (
            <div className="absolute bottom-2 left-2 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm flex items-center gap-2 shadow-lg">
              {uploadStatus === 'uploading' && (
                <>
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <span className="text-sm font-medium text-blue-900">Uploading...</span>
                </>
              )}
              {uploadStatus === 'success' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Uploaded to IPFS</span>
                </>
              )}
              {uploadStatus === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-900">Upload failed</span>
                </>
              )}
            </div>
          )}

          {/* Dimensions Badge */}
          {imageDimensions && uploadStatus === 'idle' && (
            <div className="absolute bottom-2 left-2 flex items-center gap-2">
              <div className="px-2 py-1 rounded bg-gray-900/80 backdrop-blur-sm">
                <span className="text-xs font-mono text-white">
                  {imageDimensions.width}×{imageDimensions.height}px
                </span>
              </div>
              {willBeCropped && (
                <div className="px-2 py-1 rounded bg-amber-500/90 backdrop-blur-sm flex items-center gap-1">
                  <Crop className="h-3 w-3 text-white" />
                  <span className="text-xs font-medium text-white">Auto-crop</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current IPFS URL (if exists) */}
      {value && uploadStatus === 'idle' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1 font-medium">IPFS URL:</p>
          <p className="text-sm font-mono text-gray-900 break-all">{value}</p>
        </div>
      )}
    </div>
  );
}
