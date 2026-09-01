import { test, expect } from '@playwright/test';

test.describe('Bookings', () => {
  test('bookings list page loads in demo mode when not authenticated', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/bookings');
    // Should show demo message or sign-in redirect
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
  });
});
