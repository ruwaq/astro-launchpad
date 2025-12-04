'use client';

import { useState } from 'react';
import { Search, Loader2, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import FocusTrap from 'focus-trap-react';
import type { TokenOption } from './types';
import { STROOPS_PER_XLM } from './constants';

interface TokenSelectorProps {
  tokens: TokenOption[];
  selectedToken: TokenOption | null;
  onSelect: (token: TokenOption) => void;
  isLoading?: boolean;
  disabled?: boolean;
  showSelector: boolean;
  onToggle: () => void;
  displayMode: 'input' | 'output';
  tradeType: 'buy' | 'sell';
}

export function TokenSelector({
  tokens,
  selectedToken,
  onSelect,
  isLoading,
  disabled,
  showSelector,
  onToggle,
  displayMode,
  tradeType,
}: TokenSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredTokens = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(search.toLowerCase()) ||
      token.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const testnetTokens = filteredTokens.filter((t) => t.isTestnet);
  const platformTokens = filteredTokens.filter((t) => !t.isTestnet);

  const handleSelect = (token: TokenOption) => {
    onSelect(token);
    setSearch('');
  };

  // Determine what to show in the selector button
  const showXLM = (displayMode === 'input' && tradeType === 'buy') ||
                  (displayMode === 'output' && tradeType === 'sell');

  return (
    <>
      <button
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {showXLM ? (
          <>
            <Image
              src="https://stellar.org/favicon.ico"
              alt="XLM"
              width={20}
              height={20}
              className="rounded-full"
            />
            <span className="font-semibold text-sm">XLM</span>
          </>
        ) : selectedToken ? (
          <>
            {selectedToken.imageUrl && (
              <Image
                src={selectedToken.imageUrl}
                alt={selectedToken.symbol}
                width={20}
                height={20}
                className="rounded-full"
              />
            )}
            <span className="font-semibold text-sm">{selectedToken.symbol}</span>
          </>
        ) : (
          <span className="text-sm text-gray-500">Select token</span>
        )}
        {displayMode === 'output' && <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {showSelector && (
        <FocusTrap
          focusTrapOptions={{
            escapeDeactivates: true,
            onDeactivate: onToggle,
            initialFocus: false,
            returnFocusOnDeactivate: true,
          }}
        >
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
            onClick={onToggle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="token-selector-title"
          >
            <div
              className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] sm:max-h-[600px] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="p-4 border-b border-gray-200">
              <h3 id="token-selector-title" className="font-bold mb-3">Select a token</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or symbol"
                  className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary text-base sm:text-sm"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 overscroll-contain">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-label="Loading tokens" />
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No tokens found</div>
              ) : (
                <div className="space-y-3">
                  {testnetTokens.length > 0 && (
                    <TokenSection
                      title="Stellar Testnet Tokens"
                      emoji="🧪"
                      tokens={testnetTokens}
                      onSelect={handleSelect}
                      variant="testnet"
                    />
                  )}
                  {platformTokens.length > 0 && (
                    <TokenSection
                      title="Astro Shiba Tokens"
                      emoji="🚀"
                      tokens={platformTokens}
                      onSelect={handleSelect}
                      variant="platform"
                    />
                  )}
                </div>
              )}
            </div>
            {/* Safe area padding for iOS devices with home indicator */}
            <div className="sm:hidden pb-[env(safe-area-inset-bottom,0px)]" />
            </div>
          </div>
        </FocusTrap>
      )}
    </>
  );
}

interface TokenSectionProps {
  title: string;
  emoji: string;
  tokens: TokenOption[];
  onSelect: (token: TokenOption) => void;
  variant: 'testnet' | 'platform';
}

function TokenSection({ title, emoji, tokens, onSelect, variant }: TokenSectionProps) {
  return (
    <div>
      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {emoji} {title}
      </div>
      <div className="space-y-1">
        {tokens.map((token) => (
          <button
            key={token.address}
            onClick={() => onSelect(token)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              variant === 'testnet'
                ? 'hover:bg-blue-50 border border-blue-100'
                : 'hover:bg-gray-50'
            }`}
          >
            {token.imageUrl && (
              <Image
                src={token.imageUrl}
                alt={token.symbol}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <div className="flex-1 text-left">
              <div className="font-semibold">{token.symbol}</div>
              <div className="text-xs text-gray-500">{token.name}</div>
            </div>
            {variant === 'testnet' ? (
              <div className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Testnet
              </div>
            ) : (
              <div className="text-right">
                <div className="text-sm font-medium">
                  {token.currentPrice
                    ? `${(parseFloat(token.currentPrice) / STROOPS_PER_XLM).toFixed(6)} XLM`
                    : '-'}
                </div>
                {token.priceChange24h !== undefined && (
                  <div
                    className={`text-xs ${
                      token.priceChange24h > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {token.priceChange24h > 0 ? '+' : ''}
                    {token.priceChange24h.toFixed(2)}%
                  </div>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
