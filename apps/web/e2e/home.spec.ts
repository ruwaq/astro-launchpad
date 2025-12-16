import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main heading', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for main branding or heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('should display navigation', async ({ page }) => {
    // Check for main navigation elements
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    // Check Explore link exists and is clickable
    const exploreLink = page.getByRole('link', { name: /explore/i });
    if (await exploreLink.isVisible()) {
      await exploreLink.click();
      await expect(page).toHaveURL(/explore/);
    }
  });

  test('should display token list or loading state', async ({ page }) => {
    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Should show either tokens or loading/empty state
    const tokenList = page.locator('[data-testid="token-list"]');
    const loadingState = page.getByText(/loading/i);
    const emptyState = page.getByText(/no tokens/i);

    // At least one of these should be visible
    const hasContent = await tokenList.isVisible() ||
      await loadingState.isVisible() ||
      await emptyState.isVisible();

    expect(hasContent).toBeTruthy();
  });

  test('should be responsive on mobile', async ({ page, isMobile }) => {
    if (isMobile) {
      // Check mobile menu toggle exists
      const menuButton = page.getByRole('button', { name: /menu/i });
      await expect(menuButton).toBeVisible();
    }
  });
});

test.describe('SEO & Meta', () => {
  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/Astro/i);

    // Check meta description
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);

    // Check Open Graph tags
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /.+/);
  });

  test('should have favicon', async ({ page }) => {
    await page.goto('/');

    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveAttribute('href', /.+/);
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known acceptable errors (like analytics, third-party)
    const criticalErrors = errors.filter(
      (e) => !e.includes('analytics') && !e.includes('third-party')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
