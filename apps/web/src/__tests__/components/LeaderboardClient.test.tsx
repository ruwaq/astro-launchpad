/**
 * LeaderboardClient Component Tests
 *
 * Tests the leaderboard page client component including:
 * - Type filtering (Traders/Creators/LPs)
 * - Timeframe filtering (1H/24H/7D/30D/All Time)
 * - Top 3 podium display
 * - Full rankings table
 * - King of the Hill widget
 * - Wallet connection
 * - Data fallback from SSR to Apollo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { LeaderboardClient } from '@/app/leaderboard/LeaderboardClient';
import { useWallet } from '@/contexts/WalletContext';
import type { LeaderboardEntry, GlobalStats, Token } from '@/lib/graphql/types';

// Mock dependencies
vi.mock('@/contexts/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/hooks/useApi', () => ({
  useLeaderboard: vi.fn(() => ({
    data: null,
    loading: false,
  })),
  useGlobalStats: vi.fn(() => ({
    data: null,
    loading: false,
  })),
}));

vi.mock('@/components/widgets/MetricCard', () => ({
  MetricCard: ({ title, value, loading, prefix }: any) => (
    <div data-testid={`metric-card-${title.replace(/\s/g, '-')}`}>
      {loading ? 'Loading...' : `${prefix || ''}${value}`}
    </div>
  ),
}));

vi.mock('@/components/widgets/TokensWidget', () => ({
  TokensWidget: () => <div data-testid="tokens-widget">Trending Tokens</div>,
}));

vi.mock('@/components/widgets/ActivityWidget', () => ({
  ActivityWidget: () => <div data-testid="activity-widget">Recent Activity</div>,
}));

vi.mock('@/components/explore/KingOfTheHill', () => ({
  KingOfTheHill: ({ token, isLoading }: any) => (
    <div data-testid="king-of-the-hill">
      {isLoading ? 'Loading King...' : token ? `King: ${token.name}` : 'No King'}
    </div>
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('LeaderboardClient', () => {
  const mockUseWallet = vi.mocked(useWallet);
  const user = userEvent.setup();

  const mockLeaderboardEntry: LeaderboardEntry = {
    rank: 1,
    address: 'GTRADER1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    volume24h: '50000',
    trades24h: 100,
    profitLoss24h: '5000',
  };

  const mockStats: GlobalStats = {
    totalTokens: 150,
    totalPools: 50,
    totalUsers: 1000,
    totalVolume24h: '1000000',
    totalTVL: '5000000',
  };

  const mockTopToken: Token = {
    address: 'CKING123',
    name: 'King Token',
    symbol: 'KING',
    decimals: 7,
    totalSupply: '1000000',
    creator: 'GCREATOR',
    bondingCurve: 'LINEAR' as any,
    initialPrice: '0.01',
    currentPrice: '1.00',
    marketCap: '500000',
    volume24h: '100000',
    priceChange24h: '25.5',
    holders: 250,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    graduated: false,
  };

  const mockInitialLeaderboard: LeaderboardEntry[] = [
    mockLeaderboardEntry,
    {
      rank: 2,
      address: 'GTRADER2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      volume24h: '30000',
      trades24h: 75,
      profitLoss24h: '3000',
    },
    {
      rank: 3,
      address: 'GTRADER3XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      volume24h: '20000',
      trades24h: 50,
      profitLoss24h: '2000',
    },
  ];

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
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signAuthMessage: vi.fn(),
      getAuthHeaders: vi.fn(),
      openMobileWallet: vi.fn(),
    });
  });

  describe('Initial Rendering', () => {
    it('should render the leaderboard header', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText('Leaderboard')).toBeInTheDocument();
      expect(screen.getByText(/Astro Shiba Token Launchpad/i)).toBeInTheDocument();
    });

    it('should display platform stats', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByTestId('metric-card-Total-Tokens')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-Volume-(24h)')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-Users')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-TVL')).toBeInTheDocument();
    });

    it('should display King of the Hill widget', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByTestId('king-of-the-hill')).toBeInTheDocument();
      expect(screen.getByText('King: King Token')).toBeInTheDocument();
    });

    it('should show create token button when wallet is connected', () => {
      mockUseWallet.mockReturnValue({
        address: 'GCONNECTED',
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

      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const createButton = screen.getByText('Create Token').closest('a');
      expect(createButton).toHaveAttribute('href', '/create');
    });

    it('should not show create token button when wallet is disconnected', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.queryByText('Create Token')).not.toBeInTheDocument();
    });
  });

  describe('Wallet Connection Notice', () => {
    it('should show connect wallet notice when disconnected', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText(/Connect to start trading/i)).toBeInTheDocument();
    });

    it('should not show connect wallet notice when connected', () => {
      mockUseWallet.mockReturnValue({
        address: 'GCONNECTED',
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

      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.queryByText('Connect Your Wallet')).not.toBeInTheDocument();
    });

    it('should call connect function when connect button is clicked', async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
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
        connect: mockConnect,
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signAuthMessage: vi.fn(),
        getAuthHeaders: vi.fn(),
        openMobileWallet: vi.fn(),
      });

      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const connectButton = screen.getByText('Connect Wallet');
      await user.click(connectButton);

      expect(mockConnect).toHaveBeenCalled();
    });

    it('should disable connect button when connecting', () => {
      mockUseWallet.mockReturnValue({
        address: null,
        isConnected: false,
        isConnecting: true,
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

      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const connectButton = screen.getByText('Connecting...');
      expect(connectButton).toBeDisabled();
    });
  });

  describe('Type Filtering', () => {
    it('should display all type filter buttons', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText('Top Traders')).toBeInTheDocument();
      expect(screen.getByText('Top Creators')).toBeInTheDocument();
      expect(screen.getByText('Top LPs')).toBeInTheDocument();
    });

    it('should have Traders selected by default', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const tradersButton = screen.getByText('Top Traders');
      expect(tradersButton).toHaveClass(/bg-brand-primary/);
    });

    it('should change type filter when clicked', async () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const creatorsButton = screen.getByText('Top Creators');
      await user.click(creatorsButton);

      expect(creatorsButton).toHaveClass(/bg-brand-primary/);
    });

    it('should display correct description for each type', async () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText(/Ranked by trading volume/i)).toBeInTheDocument();

      await user.click(screen.getByText('Top Creators'));
      expect(screen.getByText(/Ranked by tokens created/i)).toBeInTheDocument();

      await user.click(screen.getByText('Top LPs'));
      expect(screen.getByText(/Ranked by liquidity provided/i)).toBeInTheDocument();
    });
  });

  describe('Timeframe Filtering', () => {
    it('should display all timeframe buttons', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText('1H')).toBeInTheDocument();
      expect(screen.getByText('24H')).toBeInTheDocument();
      expect(screen.getByText('7D')).toBeInTheDocument();
      expect(screen.getByText('30D')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('should have 24H selected by default', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const dayButton = screen.getByText('24H');
      expect(dayButton).toHaveClass(/bg-brand-primary/);
    });

    it('should change timeframe when clicked', async () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const weekButton = screen.getByText('7D');
      await user.click(weekButton);

      expect(weekButton).toHaveClass(/bg-brand-primary/);
    });
  });

  describe('Top 3 Podium', () => {
    it('should display podium when at least 3 entries exist', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      // Check for podium numbers (multiple elements with same text)
      const ones = screen.getAllByText('1');
      const twos = screen.getAllByText('2');
      const threes = screen.getAllByText('3');
      expect(ones.length).toBeGreaterThan(0);
      expect(twos.length).toBeGreaterThan(0);
      expect(threes.length).toBeGreaterThan(0);
    });

    it('should not display podium with less than 3 entries', () => {
      const shortLeaderboard = [mockInitialLeaderboard[0], mockInitialLeaderboard[1]];

      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={shortLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      // Podium section should not be rendered
      const podiumNumbers = screen.queryAllByText(/^[123]$/);
      // Should only find numbers in the table, not podium
      expect(podiumNumbers.length).toBeLessThan(3);
    });
  });

  describe('Rankings Table', () => {
    it('should display full rankings table', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should display table headers', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText('Rank')).toBeInTheDocument();
      expect(screen.getByText('Address')).toBeInTheDocument();
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('Trades')).toBeInTheDocument();
    });

    it('should display all leaderboard entries', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const rows = screen.getAllByRole('row');
      // Header + 3 data rows
      expect(rows.length).toBe(4);
    });

    it('should truncate addresses in table', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      // Addresses should be truncated (not full 56 characters)
      const fullAddress = 'GTRADER1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      expect(screen.queryByText(fullAddress)).not.toBeInTheDocument();
    });

    it('should change table headers based on selected type', async () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      // Initially shows Volume/Trades for Traders
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('Trades')).toBeInTheDocument();

      // Switch to Creators
      await user.click(screen.getByText('Top Creators'));
      expect(screen.getByText('Tokens')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no rankings exist', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={[]}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText('No Rankings Yet')).toBeInTheDocument();
      expect(screen.getByText(/Be the first to rank/i)).toBeInTheDocument();
    });

    it('should show Start Trading link in empty state', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={[]}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const startTradingLink = screen.getByText('Start Trading').closest('a');
      expect(startTradingLink).toHaveAttribute('href', '/explore');
    });
  });

  describe('Widgets', () => {
    it('should display TokensWidget', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByTestId('tokens-widget')).toBeInTheDocument();
    });

    it('should display ActivityWidget', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByTestId('activity-widget')).toBeInTheDocument();
    });
  });

  describe('Feature Grid', () => {
    it('should display all feature cards', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText('Instant Launch')).toBeInTheDocument();
      expect(screen.getByText('Fair Launch')).toBeInTheDocument();
      expect(screen.getByText('LP Locked')).toBeInTheDocument();
    });

    it('should display feature descriptions', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getByText(/Deploy tokens in seconds/i)).toBeInTheDocument();
      expect(screen.getByText(/No pre-mints, everyone starts equal/i)).toBeInTheDocument();
      expect(screen.getByText(/Liquidity burned on graduation/i)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton when stats are loading', async () => {
      // Mock the hooks module before importing
      const useApiModule = await import('@/hooks/useApi');
      vi.spyOn(useApiModule, 'useGlobalStats').mockReturnValue({
        data: null,
        loading: true,
        error: undefined,
        refetch: vi.fn(),
        fetchMore: vi.fn(),
      } as any);

      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={null}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
    });

    it('should show loading state for King of the Hill', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={null}
          />
        </MockedProvider>
      );

      // Should render King of the Hill widget even without data
      expect(screen.getByTestId('king-of-the-hill')).toBeInTheDocument();
    });
  });

  describe('Data Fallback', () => {
    it('should use initial data when Apollo data is not available', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      // Should display SSR data
      expect(screen.getByText('King: King Token')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      const rowgroups = screen.getAllByRole('rowgroup');
      expect(rowgroups.length).toBeGreaterThan(0);
    });

    it('should have proper button roles for filters', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={mockInitialLeaderboard}
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      const typeButtons = screen.getAllByRole('button').filter((btn) =>
        btn.textContent?.includes('Top')
      );
      expect(typeButtons.length).toBe(3);
    });

    it('should have proper link structure', () => {
      render(
        <MockedProvider mocks={[]}>
          <LeaderboardClient
            initialLeaderboard={[]} // Empty to show "Start Trading" link
            initialStats={mockStats}
            initialTopToken={mockTopToken}
          />
        </MockedProvider>
      );

      // When leaderboard is empty, "Start Trading" link should exist
      const linkText = screen.getByText('Start Trading');
      const linkElement = linkText.closest('a');
      expect(linkElement).toHaveAttribute('href', '/explore');
    });
  });
});
