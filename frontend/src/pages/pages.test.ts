import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary, PageErrorFallback } from '../components/ErrorBoundary'
import { ScrollToTop } from '../components/ScrollToTop'

vi.mock('../store/wallet', () => ({
  useWallet: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      publicKey: null,
      pending: false,
      mode: 'wallet',
      demoAccounts: [],
      demoActive: 0,
      demoPending: false,
      selectDemo: vi.fn(),
      addDemoAccount: vi.fn(),
      startDemo: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      getSigner: () => null,
    }
    return selector ? selector(state) : state
  },
}))

import { CreateTokenForm } from '../components/CreateTokenForm'
import { WalletButton } from '../components/WalletButton'
import { HomePage } from './HomePage'
import { PortfolioPage } from './PortfolioPage'

function renderWithProviders(element: ReactElement, initialEntry = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  return renderToString(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [initialEntry] },
        element,
      ),
    ),
  )
}

describe('Page Components and Lifecycle', () => {
  describe('Minimalist Market, Launch & Portfolio Flows', () => {
    it('renders Pump.fun-style market view and Launch Coin CTA', () => {
      const html = renderWithProviders(createElement(HomePage))
      expect(html).toContain('Memecoin Market')
      expect(html).toContain('Launch Coin')
      expect(html).toContain('Search by name')
      expect(html).toContain('Fair')
    })

    it('renders PortfolioPage with 1-click Testnet Demo & Connect Wallet CTAs when disconnected', () => {
      const html = renderWithProviders(createElement(PortfolioPage), '/portfolio')
      expect(html).toContain('Your Portfolio')
      expect(html).toContain('Testnet Demo (10k XLM)')
      expect(html).toContain('Connect Wallet')
      expect(html).not.toContain('Go to Demo Mode')
    })

    it('renders CreateTokenForm with Testnet Demo option and on-chain Launchpad copy', () => {
      const html = renderWithProviders(createElement(CreateTokenForm), '/create')
      expect(html).toContain('Create &amp; Launch')
      expect(html).toContain('Testnet Demo')
      expect(html).toContain('Connect Wallet')
    })

    it('renders WalletButton with Testnet Demo and Connect Wallet buttons', () => {
      const html = renderWithProviders(createElement(WalletButton))
      expect(html).toContain('Testnet Demo')
      expect(html).toContain('Connect Wallet')
    })
  })

  describe('ErrorBoundary and Fallbacks', () => {
    it('renders PageErrorFallback with retry and error message', () => {
      const html = renderToString(
        createElement(PageErrorFallback, {
          error: new Error('Test RPC failure'),
          onRetry: vi.fn(),
        }),
      )
      expect(html).toContain('Unable to display this view')
      expect(html).toContain('Test RPC failure')
      expect(html).toContain('Retry view')
    })

    it('renders children when no error occurs in ErrorBoundary', () => {
      const html = renderToString(
        createElement(
          ErrorBoundary,
          null,
          createElement('div', null, 'Normal content'),
        ),
      )
      expect(html).toContain('Normal content')
    })
  })

  describe('ScrollToTop', () => {
    it('renders in a router without errors', () => {
      const html = renderToString(
        createElement(
          MemoryRouter,
          { initialEntries: ['/market'] },
          createElement(ScrollToTop),
        ),
      )
      expect(html).toBe('')
    })
  })
})
