import { test, expect } from '@playwright/test';

test.describe('Marketplace', () => {
  test('event listing loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const criticalErrors = errors.filter(e => 
      !e.includes('Warning') && !e.includes('DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
