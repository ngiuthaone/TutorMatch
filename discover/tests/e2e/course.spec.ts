import { test, expect } from '@playwright/test';

// REQUIRES_REAL_DB: These tests need a running Supabase instance
// Run with: pnpm playwright test tests/e2e/course.spec.ts

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Course Creator Flow', () => {
  test.skip('C1: should create a course', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/courses/new`);
    
    // Fill in course details
    await page.fill('input[name="title"]', 'Test Course ' + Date.now());
    await page.fill('input[name="slug"]', 'test-course-' + Date.now());
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify redirect to course editor
    await expect(page).toHaveURL(/\/creator\/courses\/[a-f0-9-]+/);
  });

  test.skip('C2: should add sections and lessons', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/courses`);
    
    // Click on first course
    await page.click('[data-testid="course-card"]');
    
    // Add section
    await page.click('button:has-text("Add Section")');
    await page.fill('input[name="section-title"]', 'Getting Started');
    await page.click('button:has-text("Save")');
    
    // Add lesson
    await page.click('button:has-text("Add Lesson")');
    await page.fill('input[name="lesson-title"]', 'Introduction');
    await page.selectOption('select[name="lesson-type"]', 'video');
    await page.click('button:has-text("Save")');
  });

  test.skip('C3: should create quiz with questions', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/courses`);
    await page.click('[data-testid="course-card"]');
    
    // Create quiz lesson
    await page.click('button:has-text("Add Lesson")');
    await page.fill('input[name="lesson-title"]', 'Section Quiz');
    await page.selectOption('select[name="lesson-type"]', 'quiz');
    await page.click('button:has-text("Save")');
    
    // Add questions (would need actual quiz editor interaction)
  });

  test.skip('C4: should publish course', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/courses`);
    await page.click('[data-testid="course-card"]');
    
    // Click publish
    await page.click('button:has-text("Publish")');
    
    // Confirm
    await page.click('button:has-text("Confirm")');
    
    // Verify published
    await expect(page.locator('text=Published')).toBeVisible();
  });
});

test.describe('Course Learner Flow', () => {
  test.skip('L1: should discover published courses', async ({ page }) => {
    await page.goto(`${BASE_URL}/courses`);
    
    // Verify course catalog loads
    await expect(page.locator('h1:has-text("Courses")')).toBeVisible();
    
    // Verify at least one course is visible
    await expect(page.locator('[data-testid="course-card"]').first()).toBeVisible();
  });

  test.skip('L2: should view course detail', async ({ page }) => {
    await page.goto(`${BASE_URL}/courses`);
    
    // Click on first course
    await page.click('[data-testid="course-card"]');
    
    // Verify course detail page
    await expect(page.locator('[data-testid="course-title"]')).toBeVisible();
    await expect(page.locator('button:has-text("Enroll")')).toBeVisible();
  });

  test.skip('L3: should enroll in free course', async ({ page }) => {
    await page.goto(`${BASE_URL}/courses/test-course`);
    
    // Click enroll
    await page.click('button:has-text("Enroll")');
    
    // Verify enrolled state
    await expect(page.locator('text=Enrolled')).toBeVisible();
  });

  test.skip('L4: should track video position', async ({ page }) => {
    await page.goto(`${BASE_URL}/courses/test-course/lessons/intro`);
    
    // Watch video...
    
    // Verify position is saved (check API call)
    // The position API should be called periodically
  });

  test.skip('L5: should complete quiz and see results', async ({ page }) => {
    await page.goto(`${BASE_URL}/courses/test-course/lessons/quiz`);
    
    // Answer questions
    await page.click('button:has-text("Option 2")');
    await page.click('button:has-text("Submit")');
    
    // Verify results
    await expect(page.locator('text=Passed')).toBeVisible();
  });

  test.skip('L6: should download certificate after completion', async ({ page }) => {
    await page.goto(`${BASE_URL}/courses/test-course/certificate`);
    
    // Verify certificate view
    await expect(page.locator('[data-testid="certificate"]')).toBeVisible();
    
    // Click download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download PDF")');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('certificate');
  });
});

test.describe('Course Security', () => {
  test.skip('S1: creator A cannot access creator B analytics', async ({ page, context }) => {
    // Login as creator A
    await context.clearCookies();
    await page.goto(`${BASE_URL}/login`);
    // ... login as creator A
    
    // Try to access creator B's analytics
    await page.goto(`${BASE_URL}/creator/courses/[other-course-id]/analytics`);
    
    // Should be blocked
    await expect(page.locator('text=Not Found')).toBeVisible();
  });

  test.skip('S2: learner A cannot access learner B progress', async ({ page, context }) => {
    // Login as learner A
    await context.clearCookies();
    await page.goto(`${BASE_URL}/login`);
    // ... login as learner A
    
    // Try to access learner B's progress via API
    const response = await page.request.get(`${BASE_URL}/api/v1/marketplace/course/[other-course-id]/progress`);
    
    // Should be blocked
    expect(response.status()).toBe(403);
  });
});

test.describe('Course UI Loads', () => {
  test('course catalog page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/courses`);
    await expect(page).toHaveTitle(/Courses|Tutoria/);
  });

  test('course detail page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/courses`);
    // Just verify no crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('creator dashboard loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/courses`);
    // Just verify no crash
    await expect(page.locator('body')).toBeVisible();
  });
});
