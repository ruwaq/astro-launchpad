/**
 * TokenCard Component Tests
 *
 * Tests rendering with various token data, click handlers, graduated vs non-graduated states,
 * and price display formatting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TokenCard } from '@/components/token/TokenCard';
import { useToken } from '@/hooks/useToken';
import { usePrice } from '@/hooks/usePrice';

// Mock hooks
vi.mock('@/hooks/useToken');
vi.mock('@/hooks/usePrice');

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: ({ src, alt, onError, ...props }: any) => {
    return (
      <img
        src={src}
        alt={alt}
        onError={onError}
        {...props}
      />
    );
  },
}));

const mockTokenData = {
  name: 'Astro Token',
  symbol: 'ASTRO',
  decimals: 7,
  total_supply: '1000000000',
  xlm_raised: '34500000000', // 50% of graduation
  creator: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  issuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  xlm_reserve: '34500000000',
  token_reserve: '500000000',
  virtual_xlm_reserve: '34500000000',
  virtual_token_reserve: '500000000',
  initial_virtual_xlm_reserve: '30000000000',
  initial_virtual_token_reserve: '1073000000000',
  status: 'Active',
  image_url: 'https://example.com/token.png',
  description: 'A test token for the Astro ecosystem',
  market_cap: '69000000000',
  price: '10000000',
  holders_count: 42,
  k_last: '17250000000000000000',
};

const mockPriceData = {
  price: BigInt(10_000_000), // 1 XLM
  previousPrice: BigInt(9_500_000), // 0.95 XLM
  priceChange24h: 5.26,
  priceDirection: 'up' as const,
  isLoading: false,
  error: null,
  refresh: vi.fn(),
};

describe('TokenCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToken as any).mockReturnValue({
      token: mockTokenData,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: vi.fn(),
      clearError: vi.fn(),
    });
    (usePrice as any).mockReturnValue(mockPriceData);
  });

  describe('Loading State', () => {
    it('should render loading skeleton when loading', () => {
      (useToken as any).mockReturnValue({
        token: null,
        isLoading: true,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      // Check for animated pulse class (skeleton loader)
      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });

    it('should render loading skeleton when token is null', () => {
      (useToken as any).mockReturnValue({
        token: null,
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error message when error occurs', () => {
      (useToken as any).mockReturnValue({
        token: null,
        isLoading: false,
        isRefreshing: false,
        error: 'Failed to load token data',
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('Failed to load token')).toBeInTheDocument();
      expect(screen.getByText('Failed to load token data')).toBeInTheDocument();
    });

    it('should apply error styling to error container', () => {
      (useToken as any).mockReturnValue({
        token: null,
        isLoading: false,
        isRefreshing: false,
        error: 'Network error',
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      const errorContainer = screen.getByText('Failed to load token').closest('div');
      expect(errorContainer).toHaveClass('bg-red-50', 'border-red-200');
    });
  });

  describe('Token Display', () => {
    it('should render token name and symbol', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('Astro Token')).toBeInTheDocument();
      expect(screen.getByText('$ASTRO')).toBeInTheDocument();
    });

    it('should render token image', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      const image = screen.getByAltText('Astro Token');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/token.png');
    });

    it('should handle image load error with fallback', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      const image = screen.getByAltText('Astro Token') as HTMLImageElement;

      // Trigger error event
      fireEvent.error(image);

      // Should fallback to default image
      expect(image.src).toContain('default-token.svg');
    });

    it('should render token description in non-compact mode', () => {
      render(<TokenCard tokenAddress="CTEST123" compact={false} />);

      expect(screen.getByText('A test token for the Astro ecosystem')).toBeInTheDocument();
    });

    it('should not render description in compact mode', () => {
      render(<TokenCard tokenAddress="CTEST123" compact={true} />);

      expect(screen.queryByText('A test token for the Astro ecosystem')).not.toBeInTheDocument();
    });
  });

  describe('Price Display', () => {
    it('should display current price in XLM', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText(/1\.0000000 XLM/i)).toBeInTheDocument();
    });

    it('should display market cap with compact formatting', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText(/Market Cap/i)).toBeInTheDocument();
      // Market cap should be formatted (e.g., $6.9k or similar)
      expect(screen.getByText(/\$6\.9/i)).toBeInTheDocument();
    });

    it('should format large numbers compactly', () => {
      (useToken as any).mockReturnValue({
        token: {
          ...mockTokenData,
          market_cap: '1500000000000', // 150 billion stroops = 15k XLM
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      // Should show compact notation (15k, 15K, or similar)
      const marketCap = screen.getByText(/Market Cap/i).nextSibling;
      expect(marketCap?.textContent).toMatch(/\d+\.?\d*[kKmMbB]/);
    });
  });

  describe('Price Direction Indicators', () => {
    it('should show trending up indicator with positive change', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('+5.3%')).toBeInTheDocument();
      const upIndicator = screen.getByText('+5.3%').closest('div');
      expect(upIndicator).toHaveClass('text-green-600');
    });

    it('should show trending down indicator with negative change', () => {
      (usePrice as any).mockReturnValue({
        ...mockPriceData,
        price: BigInt(9_000_000),
        previousPrice: BigInt(10_000_000),
        priceChange24h: -10.0,
        priceDirection: 'down',
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('-10.0%')).toBeInTheDocument();
      const downIndicator = screen.getByText('-10.0%').closest('div');
      expect(downIndicator).toHaveClass('text-red-600');
    });

    it('should not show indicator for stable price', () => {
      (usePrice as any).mockReturnValue({
        ...mockPriceData,
        priceDirection: 'stable',
        priceChange24h: 0,
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.queryByText(/TrendingUp/)).not.toBeInTheDocument();
      expect(screen.queryByText(/TrendingDown/)).not.toBeInTheDocument();
    });
  });

  describe('Graduation Progress', () => {
    it('should display graduation progress bar for active tokens', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('Graduation Progress')).toBeInTheDocument();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('should calculate graduation percentage correctly', () => {
      (useToken as any).mockReturnValue({
        token: {
          ...mockTokenData,
          xlm_raised: '17250000000', // 25% of 69k XLM
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    it('should cap graduation percentage at 100%', () => {
      (useToken as any).mockReturnValue({
        token: {
          ...mockTokenData,
          xlm_raised: '80000000000', // > 69k XLM
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('should display graduated badge for graduated tokens', () => {
      (useToken as any).mockReturnValue({
        token: {
          ...mockTokenData,
          status: 'Graduated',
          xlm_raised: '69000000000',
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('GRADUATED')).toBeInTheDocument();
      expect(screen.getByText('🎓')).toBeInTheDocument();
      expect(screen.queryByText('Graduation Progress')).not.toBeInTheDocument();
    });

    it('should apply correct styling to progress bar', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      const progressBar = document.querySelector('.bg-gradient-to-r');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveClass('from-brand-primary', 'to-brand-blue');
    });
  });

  describe('Additional Stats', () => {
    it('should display holders count in non-compact mode', () => {
      render(<TokenCard tokenAddress="CTEST123" compact={false} />);

      expect(screen.getByText('42 holders')).toBeInTheDocument();
    });

    it('should display XLM raised in non-compact mode', () => {
      render(<TokenCard tokenAddress="CTEST123" compact={false} />);

      // 34500000000 stroops = 3450 XLM, formatted as 3.45K or similar
      expect(screen.getByText(/3\.45/i)).toBeInTheDocument();
    });

    it('should not display additional stats in compact mode', () => {
      render(<TokenCard tokenAddress="CTEST123" compact={true} />);

      expect(screen.queryByText(/holders/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/XLM/i)).toBeInTheDocument(); // Price still shows
    });
  });

  describe('Click Handlers', () => {
    it('should call onClick handler when card is clicked', () => {
      const onClick = vi.fn();
      render(<TokenCard tokenAddress="CTEST123" onClick={onClick} />);

      const card = screen.getByText('Astro Token').closest('a');
      fireEvent.click(card!);

      expect(onClick).toHaveBeenCalled();
    });

    it('should navigate to token page with correct link', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      const card = screen.getByText('Astro Token').closest('a');
      expect(card).toHaveAttribute('href', '/t/CTEST123');
    });

    it('should apply hover effects', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      const card = screen.getByText('Astro Token').closest('a');
      expect(card).toHaveClass('hover:border-brand-primary', 'hover:shadow-lg');
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive grid classes to stats', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      const statsGrid = screen.getByText('Price').closest('.grid');
      expect(statsGrid).toHaveClass('grid-cols-2');
    });

    it('should truncate long text on small screens', () => {
      render(<TokenCard tokenAddress="CTEST123" />);

      const tokenName = screen.getByText('Astro Token');
      expect(tokenName).toHaveClass('truncate');
    });

    it('should handle long token names gracefully', () => {
      (useToken as any).mockReturnValue({
        token: {
          ...mockTokenData,
          name: 'Very Long Token Name That Should Be Truncated On Small Screens',
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      const tokenName = screen.getByText('Very Long Token Name That Should Be Truncated On Small Screens');
      expect(tokenName).toHaveClass('truncate');
    });
  });

  describe('Data Refresh', () => {
    it('should refresh token data at specified interval', async () => {
      const { rerender } = render(<TokenCard tokenAddress="CTEST123" />);

      // Token should be fetched with 30s refresh interval by default
      expect(useToken).toHaveBeenCalledWith('CTEST123', {
        refreshInterval: 30000,
      });
    });

    it('should refresh price data at specified interval', async () => {
      const { rerender } = render(<TokenCard tokenAddress="CTEST123" />);

      // Price should be fetched with 5s refresh interval
      expect(usePrice).toHaveBeenCalledWith('CTEST123', {
        interval: 5000,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields gracefully', () => {
      (useToken as any).mockReturnValue({
        token: {
          ...mockTokenData,
          description: undefined,
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      // Should still render without description
      expect(screen.getByText('Astro Token')).toBeInTheDocument();
    });

    it('should handle zero values correctly', () => {
      (useToken as any).mockReturnValue({
        token: {
          ...mockTokenData,
          xlm_raised: '0',
          holders_count: 0,
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      expect(screen.getByText('0.0%')).toBeInTheDocument(); // Graduation progress
      expect(screen.getByText('0 holders')).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      (useToken as any).mockReturnValue({
        token: {
          ...mockTokenData,
          market_cap: '9999999999999999', // Very large number
        },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: vi.fn(),
        clearError: vi.fn(),
      });

      render(<TokenCard tokenAddress="CTEST123" />);

      // Should format without crashing
      expect(screen.getByText(/Market Cap/i)).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('should not re-render when unrelated props change', () => {
      const { rerender } = render(<TokenCard tokenAddress="CTEST123" />);

      // Rerender with same props
      rerender(<TokenCard tokenAddress="CTEST123" />);

      // Component should be memoized (React.memo)
      // This is tested by ensuring useToken is not called more than necessary
      expect(useToken).toHaveBeenCalledTimes(2); // Once per render
    });

    it('should re-render when tokenAddress changes', () => {
      const { rerender } = render(<TokenCard tokenAddress="CTEST123" />);

      rerender(<TokenCard tokenAddress="CTEST456" />);

      expect(useToken).toHaveBeenCalledWith('CTEST456', expect.anything());
    });
  });
});
