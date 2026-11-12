import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { CosmicLauncherGame } from './CosmicLauncherGame'

describe('CosmicLauncherGame', () => {
  it('renders the interactive moonshot game with initial state and controls', () => {
    const html = renderToString(
      createElement(
        MemoryRouter,
        null,
        createElement(CosmicLauncherGame)
      )
    )

    expect(html).toContain('AstroGate Moonshot Simulator')
    expect(html).toContain('2,000 XLM')
    expect(html).toContain('START PUMPING')
    expect(html).toContain('Single-Tx Atomic')
    expect(html).toContain('100% LP Burned')
    expect(html).toContain('Renounced Owner')
    expect(html).toContain('2,000 XLM Moon')
  })
})
