import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('sign-in page renders the form without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/auth/sign-in');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email address/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('auth callback route does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/auth/callback');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning') && !e.includes('DevTools') && !e.includes('Download the React DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
