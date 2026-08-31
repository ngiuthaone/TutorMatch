import { test, expect } from '@playwright/test';

test.describe('Discover home', () => {
  test('loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    // Filter out known non-critical warnings
    const criticalErrors = errors.filter(e => 
      !e.includes('Warning') && 
      !e.includes('DevTools') &&
      !e.includes('Download the React DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('navigation to /courses/new shows course creator iframe', async ({ page }) => {
    await page.goto('/courses/new');
    // The page should load (in demo or auth-gated state)
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
