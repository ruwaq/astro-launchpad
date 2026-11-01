import { defineConfig } from 'vitest/config'

/**
 * Tests de lógica pura (sin DOM): parser de eventos, matemática del AMM,
 * formato de cantidades y errores. Los flujos de UI se cubren con el smoke
 * de render y, más adelante, con Playwright.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
  },
})
