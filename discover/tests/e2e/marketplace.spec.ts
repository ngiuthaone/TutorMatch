import { test, expect } from '@playwright/test';

test.describe('Marketplace / Events', () => {
  test('events listing page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning') && !e.includes('DevTools') && !e.includes('Download the React DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
