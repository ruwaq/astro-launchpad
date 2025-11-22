'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearch } from '@/hooks/useApi';
import { truncateAddress, formatCompactNumber } from '@/lib/stellar/utils';
import Link from 'next/link';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { search, data, loading } = useSearch();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length >= 2) {
      search(value);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const tokens = data?.search.tokens || [];
  const pools = data?.search.pools || [];
  const hasResults = tokens.length > 0 || pools.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-lg">
      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Search tokens, pools..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Searching...
            </div>
          ) : !hasResults && query.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            <>
              {/* Tokens Section */}
              {tokens.length > 0 && (
                <div className="border-b border-gray-200">
                  <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                    Tokens
                  </div>
                  {tokens.map((token: any) => (
                    <Link
                      key={token.address}
                      href={`/explore?token=${token.address}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex items-center space-x-3">
                        {token.logoUrl && (
                          <img
                            src={token.logoUrl}
                            alt={token.symbol}
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {token.symbol}
                          </div>
                          <div className="text-sm text-gray-500">{token.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          ${formatCompactNumber(parseFloat(token.currentPrice))}
                        </div>
                        <div className={`text-xs ${
                          parseFloat(token.priceChange24h) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {parseFloat(token.priceChange24h).toFixed(2)}%
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Pools Section */}
              {pools.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                    Pools
                  </div>
                  {pools.map((pool: any) => (
                    <Link
                      key={pool.address}
                      href={`/pools?pool=${pool.address}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex -space-x-2">
                          {pool.token0.logoUrl && (
                            <img
                              src={pool.token0.logoUrl}
                              alt={pool.token0.symbol}
                              className="w-8 h-8 rounded-full border-2 border-white"
                            />
                          )}
                          {pool.token1.logoUrl && (
                            <img
                              src={pool.token1.logoUrl}
                              alt={pool.token1.symbol}
                              className="w-8 h-8 rounded-full border-2 border-white"
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {pool.token0.symbol}/{pool.token1.symbol}
                          </div>
                          <div className="text-sm text-gray-500">
                            {truncateAddress(pool.address, 6)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          TVL: ${formatCompactNumber(parseFloat(pool.liquidity))}
                        </div>
                        <div className="text-xs text-green-600">
                          APY: {pool.apy}%
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
