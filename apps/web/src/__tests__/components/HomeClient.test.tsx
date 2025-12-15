/**
 * HomeClient Component Tests
 *
 * Tests the home page client component including:
 * - Initial rendering with server data
 * - Wallet integration
 * - Navigation links
 * - Live stats display
 * - Responsive design elements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HomeClient } from '@/app/HomeClient';
import { useWallet } from '@/contexts/WalletContext';

// Mock dependencies
vi.mock('@/contexts/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} data-testid="next-image" />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/layout/LandingNavbar', () => ({
  LandingNavbar: () => <nav data-testid="landing-navbar">Navbar</nav>,
}));

describe('HomeClient', () => {
  const mockUseWallet = vi.mocked(useWallet);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      networkWarning: null,
      expectedNetwork: 'testnet',
      kit: null,
      isMobile: false,
      isStandalone: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signAuthMessage: vi.fn(),
      getAuthHeaders: vi.fn(),
      openMobileWallet: vi.fn(),
    });
  });

  describe('Initial Rendering', () => {
    it('should render the landing navbar', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByTestId('landing-navbar')).toBeInTheDocument();
    });

    it('should display the hero section with main heading', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText(/Launch Tokens/i)).toBeInTheDocument();
      expect(screen.getByText(/Instantly on Stellar/i)).toBeInTheDocument();
    });

    it('should display the live status badge', () => {
      render(<HomeClient initialTokenCount={0} />);
      const badges = screen.getAllByText(/Live on Stellar Testnet/i);
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should display the main tagline', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(
        screen.getByText(/Fair launch platform with bonding curves/i)
      ).toBeInTheDocument();
    });

    it('should render the Astro Shiba character image', () => {
      render(<HomeClient initialTokenCount={0} />);
      const image = screen.getByAltText('Astro Shiba Character');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', '/images/personajeastroslatando.png');
    });
  });

  describe('Live Statistics', () => {
    it('should display initial token count of 0', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Tokens Launched')).toBeInTheDocument();
    });

    it('should display correct token count when provided', () => {
      render(<HomeClient initialTokenCount={42} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should display large token counts correctly', () => {
      render(<HomeClient initialTokenCount={1337} />);
      expect(screen.getByText('1337')).toBeInTheDocument();
    });

    it('should display all three stat cards', () => {
      render(<HomeClient initialTokenCount={10} />);
      expect(screen.getByText('Tokens Launched')).toBeInTheDocument();
      expect(screen.getByText('Gas Fees')).toBeInTheDocument();
      expect(screen.getByText('Finality')).toBeInTheDocument();
    });

    it('should display $0 gas fees', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('should display 3-5s finality time', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('3-5s')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('should render Launch Token CTA button', () => {
      render(<HomeClient initialTokenCount={0} />);
      const launchButtons = screen.getAllByText(/Launch Token/i);
      expect(launchButtons.length).toBeGreaterThan(0);
      // Find the primary CTA in hero section
      const heroCTA = launchButtons.find(
        (btn) => btn.closest('a')?.getAttribute('href') === '/create'
      );
      expect(heroCTA).toBeInTheDocument();
    });

    it('should render Explore Tokens button', () => {
      render(<HomeClient initialTokenCount={0} />);
      const exploreLink = screen.getByText('Explore Tokens').closest('a');
      expect(exploreLink).toHaveAttribute('href', '/explore');
    });

    it('should render final Launch Now CTA in footer', () => {
      render(<HomeClient initialTokenCount={0} />);
      const launchNowLink = screen.getByText('Launch Now - Free').closest('a');
      expect(launchNowLink).toHaveAttribute('href', '/create');
    });
  });

  describe('Feature Sections', () => {
    it('should display Fair Launch feature', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('Fair Launch')).toBeInTheDocument();
      expect(
        screen.getByText(/Zero pre-mints. Bonding curve ensures fair price discovery/i)
      ).toBeInTheDocument();
    });

    it('should display Auto Graduation feature', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('Auto Graduation')).toBeInTheDocument();
      expect(
        screen.getByText(/Tokens automatically graduate to AMM at 10,000 XLM/i)
      ).toBeInTheDocument();
    });

    it('should display Real-Time Trading feature', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('Real-Time Trading')).toBeInTheDocument();
      expect(
        screen.getByText(/Live price updates, instant transactions/i)
      ).toBeInTheDocument();
    });
  });

  describe('Smart Contract Information', () => {
    it('should display SAC Factory contract section', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('SAC Factory')).toBeInTheDocument();
      expect(screen.getByText(/Token Launch & Bonding Curve/i)).toBeInTheDocument();
    });

    it('should display AMM Pair contract section', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('AMM Pair')).toBeInTheDocument();
      expect(screen.getByText(/Automated Market Maker/i)).toBeInTheDocument();
    });

    it('should have external links to Stellar Expert', () => {
      render(<HomeClient initialTokenCount={0} />);
      const allLinks = screen.getAllByRole('link');
      const externalLinks = allLinks.filter((link) =>
        link.getAttribute('target') === '_blank'
      );
      expect(externalLinks.length).toBeGreaterThan(0);
      externalLinks.forEach((link) => {
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });

  describe('How It Works Section', () => {
    it('should display all three steps', () => {
      render(<HomeClient initialTokenCount={0} />);
      // Use getAllByText for text that appears multiple times
      expect(screen.getAllByText(/Launch Token/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Trade on Bonding Curve')).toBeInTheDocument();
      expect(screen.getByText('Graduate to AMM')).toBeInTheDocument();
    });

    it('should display step descriptions', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(
        screen.getByText(/Create your token with name, symbol, and image/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Buy and sell instantly. Price determined by constant product formula/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/At 10,000 XLM, token graduates to AMM/i)
      ).toBeInTheDocument();
    });
  });

  describe('Wallet Integration', () => {
    it('should call useWallet hook on mount', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(mockUseWallet).toHaveBeenCalled();
    });

    it('should render correctly when wallet is disconnected', () => {
      mockUseWallet.mockReturnValue({
        address: null,
        isConnected: false,
        isConnecting: false,
        error: null,
        networkWarning: null,
        expectedNetwork: 'testnet',
        kit: null,
        isMobile: false,
        isStandalone: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signAuthMessage: vi.fn(),
        getAuthHeaders: vi.fn(),
        openMobileWallet: vi.fn(),
      });

      render(<HomeClient initialTokenCount={5} />);
      expect(screen.getByText(/Launch Tokens/i)).toBeInTheDocument();
    });

    it('should render correctly when wallet is connected', () => {
      mockUseWallet.mockReturnValue({
        address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        isConnected: true,
        isConnecting: false,
        error: null,
        networkWarning: null,
        expectedNetwork: 'testnet',
        kit: null,
        isMobile: false,
        isStandalone: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signAuthMessage: vi.fn(),
        getAuthHeaders: vi.fn(),
        openMobileWallet: vi.fn(),
      });

      render(<HomeClient initialTokenCount={5} />);
      expect(screen.getByText(/Launch Tokens/i)).toBeInTheDocument();
    });
  });

  describe('Call to Action Section', () => {
    it('should display final CTA heading', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText(/Ready to Launch Your Token?/i)).toBeInTheDocument();
    });

    it('should display CTA description', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(
        screen.getByText(/Join the fair launch revolution on Stellar/i)
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper main landmark', () => {
      render(<HomeClient initialTokenCount={0} />);
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
    });

    it('should have descriptive alt text for images', () => {
      render(<HomeClient initialTokenCount={0} />);
      const image = screen.getByAltText('Astro Shiba Character');
      expect(image).toBeInTheDocument();
    });

    it('should have proper link elements', () => {
      render(<HomeClient initialTokenCount={0} />);
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero token count', () => {
      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle very large token counts', () => {
      render(<HomeClient initialTokenCount={999999} />);
      expect(screen.getByText('999999')).toBeInTheDocument();
    });

    it('should render without crashing when wallet context errors', () => {
      mockUseWallet.mockReturnValue({
        address: null,
        isConnected: false,
        isConnecting: false,
        error: 'Connection failed',
        networkWarning: null,
        expectedNetwork: 'testnet',
        kit: null,
        isMobile: false,
        isStandalone: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signAuthMessage: vi.fn(),
        getAuthHeaders: vi.fn(),
        openMobileWallet: vi.fn(),
      });

      render(<HomeClient initialTokenCount={0} />);
      expect(screen.getByText(/Launch Tokens/i)).toBeInTheDocument();
    });
  });
});
