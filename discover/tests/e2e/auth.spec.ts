import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

test.describe('Auth', () => {
  test('redirects unauthenticated user to sign-in', async ({ page }) => {
    await page.goto('/bookings');
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('sign-in page renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/auth/sign-in');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});
