/**
 * Token Header Component - REAL DATA
 *
 * Displays token information header
 * NO MOCK DATA - All from GraphQL token object
 */

'use client';

import { Copy, ExternalLink, Check } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

interface TokenHeaderProps {
  token: any; // Token object from GraphQL
}

export function TokenHeader({ token }: TokenHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(token.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Truncate address for display
  const addressShort = `${token.address.slice(0, 6)}...${token.address.slice(-4)}`;

  return (
    <div className="bg-white rounded-xl border border-ui-border p-6">
      <div className="flex items-start gap-4">
        {/* Token Logo */}
        <div className="flex-shrink-0">
          {token.logoUrl ? (
            <Image
              src={token.logoUrl}
              alt={token.name}
              width={80}
              height={80}
              className="rounded-full border-2 border-ui-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {token.symbol.charAt(0)}
            </div>
          )}
        </div>

        {/* Token Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ui-text-primary mb-1">
                {token.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-lg text-ui-text-secondary font-semibold">
                  ${token.symbol}
                </span>
                {token.graduated && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    🎓 Graduated
                  </span>
                )}
              </div>
            </div>

            {/* Social Links */}
            {(token.twitter || token.telegram || token.website) && (
              <div className="flex items-center gap-2">
                {token.website && (
                  <a
                    href={token.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Website"
                  >
                    <ExternalLink className="h-4 w-4 text-ui-text-secondary" />
                  </a>
                )}
                {token.twitter && (
                  <a
                    href={`https://twitter.com/${token.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Twitter"
                  >
                    <svg
                      className="h-4 w-4 text-ui-text-secondary"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                )}
                {token.telegram && (
                  <a
                    href={`https://t.me/${token.telegram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Telegram"
                  >
                    <svg
                      className="h-4 w-4 text-ui-text-secondary"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Contract Address */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-ui-text-secondary">Contract:</span>
            <code className="text-sm font-mono text-ui-text-primary bg-gray-100 px-2 py-1 rounded">
              {addressShort}
            </code>
            <button
              onClick={handleCopyAddress}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-ui-text-secondary" />
              )}
            </button>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${token.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="View on Stellar Expert"
            >
              <ExternalLink className="h-4 w-4 text-ui-text-secondary" />
            </a>
          </div>

          {/* Creator */}
          {token.creator && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-ui-text-secondary">Creator:</span>
              <code className="text-sm font-mono text-ui-text-primary">
                {`${token.creator.slice(0, 6)}...${token.creator.slice(-4)}`}
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
