import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Discover home', () => {
  test('discover home page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`${BASE_URL}/discover`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning') && !e.includes('DevTools') && !e.includes('Download the React DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('courses/new page loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`${BASE_URL}/courses/new`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning') && !e.includes('DevTools') && !e.includes('Download the React DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
