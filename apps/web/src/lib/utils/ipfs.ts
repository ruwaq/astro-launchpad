/**
 * IPFS Utility Functions
 *
 * Converts ipfs:// URLs to HTTPS gateway URLs for display.
 * Uses Pinata gateway configured in environment.
 */

const DEFAULT_GATEWAY = 'gateway.pinata.cloud';

/**
 * Convert an IPFS URL (ipfs://CID) to an HTTPS gateway URL
 *
 * @param url - Original URL (may be ipfs://, https://, or null)
 * @returns HTTPS URL or null if no valid URL provided
 *
 * @example
 * getIpfsUrl('ipfs://bafybeih...') // 'https://gateway.pinata.cloud/ipfs/bafybeih...'
 * getIpfsUrl('https://example.com/img.png') // 'https://example.com/img.png'
 * getIpfsUrl(null) // null
 */
export function getIpfsUrl(url: string | undefined | null): string | null {
  if (!url) return null;

  // Already an HTTP URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Convert IPFS URL to gateway URL
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '');
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || DEFAULT_GATEWAY;
    return `https://${gateway}/ipfs/${cid}`;
  }

  // Assume it's a CID if it starts with 'Qm' or 'bafy'
  if (url.startsWith('Qm') || url.startsWith('bafy')) {
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || DEFAULT_GATEWAY;
    return `https://${gateway}/ipfs/${url}`;
  }

  // Return as-is for other URLs (relative paths, etc.)
  return url;
}

/**
 * Alias for backward compatibility
 */
export const getImageUrl = getIpfsUrl;
