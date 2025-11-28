/**
 * Asset Validation Utilities for SAC Factory
 *
 * Simple validation utilities for token creation.
 * V2 tokens (pure Soroban) don't require issuer keypairs or set_admin calls.
 *
 * @since V2 (November 2024) - Simplified for pure Soroban tokens
 */

/**
 * Validates a token symbol according to Stellar rules
 *
 * @param symbol - Symbol to validate
 * @returns True if valid, false otherwise
 */
export function validateSymbol(symbol: string): boolean {
  // 1-12 characters
  if (!symbol || symbol.length === 0 || symbol.length > 12) {
    return false;
  }

  // Alphanumeric only (uppercase recommended)
  if (!/^[A-Z0-9]+$/.test(symbol)) {
    return false;
  }

  return true;
}

/**
 * Validates a token name
 *
 * @param name - Name to validate
 * @returns True if valid, false otherwise
 */
export function validateName(name: string): boolean {
  // 1-32 characters
  if (!name || name.length === 0 || name.length > 32) {
    return false;
  }

  return true;
}

/**
 * Validates a token description
 *
 * @param description - Description to validate
 * @returns True if valid, false otherwise
 */
export function validateDescription(description: string): boolean {
  // Max 500 characters, can be empty
  if (description && description.length > 500) {
    return false;
  }

  return true;
}

/**
 * Validates an image URL
 *
 * @param imageUrl - Image URL to validate
 * @returns True if valid, false otherwise
 */
export function validateImageUrl(imageUrl: string): boolean {
  // Allow empty (default image will be used)
  if (!imageUrl) {
    return true;
  }

  // Must be HTTPS or IPFS
  if (
    !imageUrl.startsWith('https://') &&
    !imageUrl.startsWith('ipfs://')
  ) {
    return false;
  }

  return true;
}

/**
 * Validates all token creation parameters
 *
 * @param params - Token creation parameters
 * @returns Validation result with error message if invalid
 */
export function validateTokenParams(params: {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
}): { valid: boolean; error?: string } {
  if (!validateName(params.name)) {
    return {
      valid: false,
      error: 'Name must be 1-32 characters',
    };
  }

  if (!validateSymbol(params.symbol)) {
    return {
      valid: false,
      error: 'Symbol must be 1-12 alphanumeric uppercase characters',
    };
  }

  if (params.description && !validateDescription(params.description)) {
    return {
      valid: false,
      error: 'Description must be under 500 characters',
    };
  }

  if (params.imageUrl && !validateImageUrl(params.imageUrl)) {
    return {
      valid: false,
      error: 'Image URL must be HTTPS or IPFS',
    };
  }

  return { valid: true };
}
