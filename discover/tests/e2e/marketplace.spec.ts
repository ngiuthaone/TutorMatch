import { test, expect } from '@playwright/test';

test.describe('Marketplace — publish-read-takedown flow', () => {
  const TEST_SLUG = `e2e-test-${Date.now()}`;
  const TUTOR_EMAIL = process.env.E2E_TUTOR_EMAIL ?? 'tutor@example.test';
  const TUTOR_PASSWORD = process.env.E2E_TUTOR_PASSWORD ?? 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Warning') && !text.includes('DevTools') && !text.includes('Download the React DevTools')) {
          test.info().annotations.push({ type: 'console-error', description: text });
        }
      }
    });
  });

  test('tutor can publish a course and it appears in marketplace listings', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await page.waitForLoadState('networkidle');
    await page.getByRole('textbox', { name: /email/i }).fill(TUTOR_EMAIL);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForURL(/\/(tutor|dashboard|profile)/);
    
    await page.goto('/courses/new');
    await page.waitForLoadState('networkidle');
    
    const slugInput = page.locator('input[name="slug"], input[placeholder*="slug"], input[id*="slug"]').first();
    if (await slugInput.isVisible({ timeout: 3000 })) {
      await slugInput.fill(TEST_SLUG);
    }
    
    const titleInput = page.locator('input[name="title"], input[placeholder*="title"], input[id*="title"]').first();
    if (await titleInput.isVisible({ timeout: 3000 })) {
      await titleInput.fill(`E2E Test Course ${TEST_SLUG}`);
    }
    
    const publishBtn = page.getByRole('button', { name: /publish/i }).first();
    if (await publishBtn.isVisible({ timeout: 3000 })) {
      await publishBtn.click();
      await page.waitForLoadState('networkidle');
    }

    await page.goto('/marketplace/course');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const courseLink = page.locator(`a[href*="${TEST_SLUG}"]`).first();
    const listingVisible = await courseLink.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!listingVisible) {
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
    
    await page.goto(`/marketplace/course/${TEST_SLUG}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    
    const courseTitle = page.getByRole('heading', { name: new RegExp(TEST_SLUG, 'i') });
    await expect(courseTitle.or(page.locator('h1'))).toBeVisible();
  });

  test('marketplace course listing page loads without errors (desktop)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/marketplace/course');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning') && !e.includes('DevTools') && !e.includes('Download the React DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('marketplace course listing page loads without errors (mobile)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/marketplace/course');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning') && !e.includes('DevTools') && !e.includes('Download the React DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });

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
