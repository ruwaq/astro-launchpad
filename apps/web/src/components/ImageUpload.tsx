'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(value || '');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP, SVG)');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 10MB');
      return;
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
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

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
                {uploadStatus === 'idle' && 'Click to upload or drag & drop'}
              </p>
              <p className="text-sm text-ui-text-secondary mt-1">
                {uploadStatus === 'idle' && 'PNG, JPG, GIF, WebP or SVG (max 10MB)'}
                {uploadStatus === 'uploading' && 'Please wait...'}
                {uploadStatus === 'success' && 'Image stored on IPFS'}
                {uploadStatus === 'error' && 'Please try again'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Preview */
        <div className="relative border-2 border-brand-primary-200 rounded-xl overflow-hidden bg-gray-50">
          <div className="relative aspect-video">
            <img
              src={previewUrl}
              alt="Token preview"
              className="w-full h-full object-contain"
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
