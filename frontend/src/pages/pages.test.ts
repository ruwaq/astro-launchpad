import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { GraduationRadar } from '../components/GraduationRadar'
import { NewLaunchesFeed } from '../components/NewLaunchesFeed'
import { ErrorBoundary, PageErrorFallback } from '../components/ErrorBoundary'
import { ScrollToTop } from '../components/ScrollToTop'

describe('Page Components and Lifecycle', () => {
  describe('GraduationRadar', () => {
    it('renders loading skeleton when isLoading is true', () => {
      const html = renderToString(
        createElement(GraduationRadar, {
          tokens: [],
          isLoading: true,
        }),
      )
      expect(html).toContain('Graduating Soon')
      expect(html).toContain('animate-pulse')
    })

    it('renders empty state when tokens is empty and not loading', () => {
      const html = renderToString(
        createElement(GraduationRadar, {
          tokens: [],
          isLoading: false,
        }),
      )
      expect(html).toContain('No tokens approaching graduation yet')
    })
  })

  describe('NewLaunchesFeed', () => {
    it('renders loading skeleton when isLoading is true', () => {
      const html = renderToString(
        createElement(NewLaunchesFeed, {
          tokens: [],
          isLoading: true,
        }),
      )
      expect(html).toContain('Fresh Token Launches')
      expect(html).toContain('animate-pulse')
    })

    it('renders empty state when tokens is empty and not loading', () => {
      const html = renderToString(
        createElement(
          MemoryRouter,
          null,
          createElement(NewLaunchesFeed, {
            tokens: [],
            isLoading: false,
          }),
        ),
      )
      expect(html).toContain('No new launches discovered in recent ledgers')
    })
  })

  describe('ErrorBoundary and Fallbacks', () => {
    it('renders PageErrorFallback with retry and error message', () => {
      const error = new Error('Test RPC failure')
      const html = renderToString(
        createElement(PageErrorFallback, {
          error,
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
          { initialEntries: ['/market#sec-swap'] },
          createElement(ScrollToTop),
        ),
      )
      expect(html).toBe('')
    })
  })
})
