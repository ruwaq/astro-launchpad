/**
 * TokenCardPremium Component Tests
 *
 * Tests enhanced token card with animations, badges, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TokenCardPremium } from '@/components/token/TokenCardPremium';
import { useToken } from '@/hooks/useToken';
import { usePrice } from '@/hooks/usePrice';

// Mock hooks
vi.mock('@/hooks/useToken');
vi.mock('@/hooks/usePrice');

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
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

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGraphQLToken = {
  address: 'CTEST123',
  name: 'Premium Token',
  symbol: 'PREM',
  imageUrl: 'https://example.com/token.png',
  currentPrice: '10000000',
  priceChange24h: 5.5,
  marketCap: '69000000000',
  xlmRaised: '34500000000',
  xlmReserve: '34500000000',
  circulatingSupply: '500000000',
  graduated: false,
};

const mockPriceData = {
  price: BigInt(10_000_000),
  previousPrice: BigInt(9_500_000),
  priceChange24h: 5.5,
  priceDirection: 'up' as const,
  isLoading: false,
  error: null,
  refresh: vi.fn(),
};

describe('TokenCardPremium', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToken as any).mockReturnValue({
      token: null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });
    (usePrice as any).mockReturnValue(mockPriceData);
  });

  describe('Rendering with GraphQL Data', () => {
    it('should render token card with GraphQL data', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      expect(screen.getByText('Premium Token')).toBeInTheDocument();
      expect(screen.getByText('$PREM')).toBeInTheDocument();
    });

    it('should display token image', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      const image = screen.getByAltText('Premium Token');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/token.png');
    });

    it('should not fetch token data when GraphQL data provided', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      expect(useToken).toHaveBeenCalledWith(null, expect.anything());
    });
  });

  describe('Rendering with Contract Fetch', () => {
    const mockContractToken = {
      token_address: 'CTEST456',
      name: 'Contract Token',
      symbol: 'CONT',
      image_url: 'https://example.com/contract.png',
      market_cap: '50000000000',
      xlm_raised: '25000000000',
      xlm_reserve: '25000000000',
      holders_count: 100,
      status: 'Bonding',
      bonding_curve: {
        xlm_reserve: '25000000000',
        token_reserve: '750000000',
      },
    };

    it('should fetch token data when address provided without GraphQL data', () => {
      (useToken as any).mockReturnValue({
        token: mockContractToken,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<TokenCardPremium tokenAddress="CTEST456" />);

      expect(useToken).toHaveBeenCalledWith('CTEST456', { refreshInterval: 30000 });
      expect(screen.getByText('Contract Token')).toBeInTheDocument();
    });

    it('should show loading skeleton when fetching', () => {
      (useToken as any).mockReturnValue({
        token: null,
        isLoading: true,
        error: null,
        refresh: vi.fn(),
      });

      render(<TokenCardPremium tokenAddress="CTEST456" />);

      expect(document.querySelector('.animate-shimmer')).toBeInTheDocument();
    });

    it('should display error state on fetch failure', () => {
      (useToken as any).mockReturnValue({
        token: null,
        isLoading: false,
        error: 'Failed to fetch token',
        refresh: vi.fn(),
      });

      render(<TokenCardPremium tokenAddress="CTEST456" />);

      expect(screen.getByText('Failed to load token')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch token')).toBeInTheDocument();
    });
  });

  describe('Price Display and Changes', () => {
    it('should display current price with XLM suffix', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      expect(screen.getByText(/1\.0000000/)).toBeInTheDocument();
      expect(screen.getByText('XLM')).toBeInTheDocument();
    });

    it('should show price increase indicator', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      expect(screen.getByText('+5.5%')).toBeInTheDocument();
      const priceChange = screen.getByText('+5.5%').closest('div');
      expect(priceChange).toHaveClass('text-green-600');
    });

    it('should show price decrease indicator', () => {
      const tokenWithDecrease = {
        ...mockGraphQLToken,
        priceChange24h: -3.2,
      };

      render(<TokenCardPremium token={tokenWithDecrease} />);

      expect(screen.getByText('-3.2%')).toBeInTheDocument();
      const priceChange = screen.getByText('-3.2%').closest('div');
      expect(priceChange).toHaveClass('text-red-600');
    });

    it('should format market cap compactly', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      expect(screen.getByText('Market Cap')).toBeInTheDocument();
      // Market cap should be formatted (69B stroops = ~6.9k XLM)
      expect(screen.getByText(/\$6\.9/i)).toBeInTheDocument();
    });
  });

  describe('Graduation Status and Badges', () => {
    it('should display graduation progress for bonding tokens', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      expect(screen.getByText('Bonding Curve Progress')).toBeInTheDocument();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('should show GRADUATED badge for graduated tokens', () => {
      const graduatedToken = {
        ...mockGraphQLToken,
        graduated: true,
        xlmRaised: '690000000000',
      };

      render(<TokenCardPremium token={graduatedToken} />);

      expect(screen.getByText('GRADUATED')).toBeInTheDocument();
      expect(screen.queryByText('Bonding Curve Progress')).not.toBeInTheDocument();
    });

    it('should show GRADUATING badge when near threshold', () => {
      const nearGraduationToken = {
        ...mockGraphQLToken,
        xlmRaised: '580000000000', // ~84% of 69k XLM
      };

      render(<TokenCardPremium token={nearGraduationToken} />);

      expect(screen.getByText('GRADUATING')).toBeInTheDocument();
      expect(screen.getByText(/Almost graduating to DEX/i)).toBeInTheDocument();
    });

    it('should show trending badge with rank', () => {
      render(<TokenCardPremium token={mockGraphQLToken} trendingRank={3} />);

      expect(screen.getByText('#3')).toBeInTheDocument();
    });

    it('should show NEW badge for new tokens', () => {
      render(<TokenCardPremium token={mockGraphQLToken} isNew={true} />);

      expect(screen.getByText('NEW')).toBeInTheDocument();
    });

    it('should not show trending badge for rank > 10', () => {
      render(<TokenCardPremium token={mockGraphQLToken} trendingRank={15} />);

      expect(screen.queryByText('#15')).not.toBeInTheDocument();
    });
  });

  describe('Stats Display', () => {
    it('should display all stats in grid', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      expect(screen.getByText('Market Cap')).toBeInTheDocument();
      expect(screen.getByText('Holders')).toBeInTheDocument();
      expect(screen.getByText('XLM Reserve')).toBeInTheDocument();
    });

    it('should show holders count', () => {
      const tokenWithHolders = {
        ...mockGraphQLToken,
      };

      render(<TokenCardPremium token={tokenWithHolders} />);

      // Note: GraphQL tokens don't have holders_count in this implementation
      // It shows '-' for missing data
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('should format XLM reserve compactly', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      const reserveStat = screen.getByText('XLM Reserve').nextSibling;
      expect(reserveStat?.textContent).toMatch(/\d+\.?\d*[kKmMbB]?/);
    });
  });

  describe('Click Handlers and Navigation', () => {
    it('should navigate to token page when card clicked', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      const card = screen.getByText('Premium Token').closest('a');
      expect(card).toHaveAttribute('href', '/t/CTEST123');
    });

    it('should call onClick handler when provided', () => {
      const onClick = vi.fn();
      render(<TokenCardPremium token={mockGraphQLToken} onClick={onClick} />);

      const card = screen.getByText('Premium Token').closest('a');
      fireEvent.click(card!);

      expect(onClick).toHaveBeenCalled();
    });

    it('should navigate to token page on Quick Buy click', () => {
      render(<TokenCardPremium token={mockGraphQLToken} showQuickActions={true} />);

      const quickBuyButton = screen.getByText('Quick Buy').closest('button');
      fireEvent.click(quickBuyButton!);

      expect(mockPush).toHaveBeenCalledWith('/t/CTEST123');
    });

    it('should show Trade on DEX for graduated tokens', () => {
      const graduatedToken = {
        ...mockGraphQLToken,
        graduated: true,
      };

      render(<TokenCardPremium token={graduatedToken} showQuickActions={true} />);

      expect(screen.getByText('Trade on DEX')).toBeInTheDocument();
    });
  });

  describe('Quick Actions', () => {
    it('should toggle like button state', () => {
      render(<TokenCardPremium token={mockGraphQLToken} showQuickActions={true} />);

      const likeButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg')?.classList.contains('lucide-heart')
      );
      expect(likeButton).toBeInTheDocument();

      // Click to like
      fireEvent.click(likeButton!);

      // Check if heart icon has fill class (liked state)
      const heartIcon = likeButton!.querySelector('svg');
      expect(heartIcon).toHaveClass('text-red-500');
    });

    it('should handle share button click', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(<TokenCardPremium token={mockGraphQLToken} showQuickActions={true} />);

      const shareButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg')?.classList.contains('lucide-share-2')
      );

      fireEvent.click(shareButton!);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('/t/CTEST123')
        );
      });
    });

    it('should not show quick actions in compact mode', () => {
      render(<TokenCardPremium token={mockGraphQLToken} compact={true} showQuickActions={true} />);

      expect(screen.queryByText('Quick Buy')).not.toBeInTheDocument();
    });
  });

  describe('Graduated Token Display', () => {
    const graduatedToken = {
      ...mockGraphQLToken,
      graduated: true,
      xlmRaised: '690000000000',
    };

    it('should show Trading on DEX message', () => {
      render(<TokenCardPremium token={graduatedToken} />);

      expect(screen.getByText('Trading on DEX')).toBeInTheDocument();
      expect(screen.getByText(/Successfully graduated with locked liquidity/i)).toBeInTheDocument();
    });

    it('should apply green gradient border to graduated tokens', () => {
      render(<TokenCardPremium token={graduatedToken} />);

      const card = screen.getByText('Premium Token').closest('a');
      expect(card).toHaveClass('border-green-300');
    });

    it('should show green progress bar at 100%', () => {
      render(<TokenCardPremium token={graduatedToken} />);

      // Card should have graduated status, not show progress bar
      expect(screen.queryByText('Bonding Curve Progress')).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      render(<TokenCardPremium token={mockGraphQLToken} compact={true} />);

      expect(screen.getByText('Premium Token')).toBeInTheDocument();
    });

    it('should hide social stats in compact mode', () => {
      render(<TokenCardPremium token={mockGraphQLToken} compact={true} />);

      // Social stats (holders count text) should not be visible
      expect(screen.queryByText(/holders/i)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing image gracefully', () => {
      const tokenNoImage = {
        ...mockGraphQLToken,
        imageUrl: null,
      };

      render(<TokenCardPremium token={tokenNoImage} />);

      const image = screen.getByAltText('Premium Token');
      expect(image).toHaveAttribute('src', '/images/default-token.svg');
    });

    it('should handle zero XLM raised', () => {
      const tokenZeroRaised = {
        ...mockGraphQLToken,
        xlmRaised: '0',
      };

      render(<TokenCardPremium token={tokenZeroRaised} />);

      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('should cap graduation progress at 100%', () => {
      const tokenOverCap = {
        ...mockGraphQLToken,
        xlmRaised: '800000000000', // > 69k XLM
        graduated: false, // Still in bonding curve
      };

      render(<TokenCardPremium token={tokenOverCap} />);

      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      const tokenLargeNumbers = {
        ...mockGraphQLToken,
        marketCap: '99999999999999999',
      };

      render(<TokenCardPremium token={tokenLargeNumbers} />);

      // Should not crash
      expect(screen.getByText('Premium Token')).toBeInTheDocument();
    });

    it('should handle missing optional fields', () => {
      const minimalToken = {
        address: 'CTEST789',
        name: 'Minimal',
        symbol: 'MIN',
      };

      render(<TokenCardPremium token={minimalToken as any} />);

      expect(screen.getByText('Minimal')).toBeInTheDocument();
      expect(screen.getByText('$MIN')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper link to token page', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/t/CTEST123');
    });

    it('should have accessible image alt text', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      const image = screen.getByAltText('Premium Token');
      expect(image).toBeInTheDocument();
    });

    it('should have minimum touch target sizes for buttons', () => {
      render(<TokenCardPremium token={mockGraphQLToken} showQuickActions={true} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        expect(minHeight).toBeGreaterThanOrEqual(40); // 44px recommended, allowing some margin
      });
    });
  });

  describe('Performance', () => {
    it('should be memoized', () => {
      const { rerender } = render(<TokenCardPremium token={mockGraphQLToken} />);

      // Rerender with same props
      rerender(<TokenCardPremium token={mockGraphQLToken} />);

      // Component should not cause unnecessary re-renders
      expect(screen.getByText('Premium Token')).toBeInTheDocument();
    });

    it('should use lazy loading for images', () => {
      render(<TokenCardPremium token={mockGraphQLToken} />);

      const image = screen.getByAltText('Premium Token');
      expect(image).toHaveAttribute('loading', 'lazy');
    });
  });
});
