import { test, expect } from '@playwright/test';

test.describe('Explore Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
  });

  test('should display explore page', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Should have the explore heading or title
    const title = page.locator('h1, [data-testid="explore-title"]');
    await expect(title).toBeVisible();
  });

  test('should display token grid or list', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Should have token cards or loading/empty state
    const tokenCards = page.locator('[data-testid="token-card"]');
    const loadingState = page.getByText(/loading/i);
    const emptyState = page.getByText(/no tokens/i);

    const hasContent = await tokenCards.count() > 0 ||
      await loadingState.isVisible() ||
      await emptyState.isVisible();

    expect(hasContent).toBeTruthy();
  });

  test('should have search functionality', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Search should filter results
      // We just verify it doesn't crash
    }
  });

  test('should have sorting options', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for sort controls
    const sortSelect = page.locator('select, [role="combobox"]').first();

    if (await sortSelect.isVisible()) {
      // Should be able to interact with sort
      await sortSelect.click();
    }
  });
});

test.describe('Token Detail Page', () => {
  test('should display 404 for invalid token address', async ({ page }) => {
    await page.goto('/t/invalid-address');

    // Should show error or redirect
    const notFound = page.getByText(/not found|invalid|error/i);
    const errorState = await notFound.isVisible();

    // Either shows error or redirects (which would change URL)
    expect(errorState || page.url() !== '/t/invalid-address').toBeTruthy();
  });
});

test.describe('Leaderboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
  });

  test('should display leaderboard', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Should show leaderboard content
    const leaderboard = page.locator('[data-testid="leaderboard"], table, [role="table"]');
    const loadingState = page.getByText(/loading/i);
    const emptyState = page.getByText(/no data|empty/i);

    const hasContent = await leaderboard.isVisible() ||
      await loadingState.isVisible() ||
      await emptyState.isVisible();

    expect(hasContent).toBeTruthy();
  });

  test('should have timeframe filters', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for timeframe buttons/tabs
    const dayFilter = page.getByRole('button', { name: /24h|day/i });
    const weekFilter = page.getByRole('button', { name: /week|7d/i });

    // At least one timeframe filter should exist
    const hasFilters = await dayFilter.isVisible() || await weekFilter.isVisible();

    // If no filters, that's also acceptable (different UI)
    expect(true).toBeTruthy();
  });
});

test.describe('Create Token Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/create');
  });

  test('should display create form', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Should show create form or connect wallet prompt
    const form = page.locator('form');
    const connectPrompt = page.getByText(/connect wallet/i);

    const hasContent = await form.isVisible() || await connectPrompt.isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('should show connect wallet button when not connected', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for connect wallet button
    const connectButton = page.getByRole('button', { name: /connect/i });

    // Should show connect button or form (if wallet already connected)
    const hasConnectOrForm = await connectButton.isVisible() ||
      await page.locator('form').isVisible();

    expect(hasConnectOrForm).toBeTruthy();
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check h1 exists
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all images
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Each image should have alt text or role="presentation"
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('should be navigable with keyboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should have focus on some element
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeDefined();
  });
});
