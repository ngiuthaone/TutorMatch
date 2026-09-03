import { test, expect } from "@playwright/test";

test.describe("Host Center", () => {
  test("center.html loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`file://${process.cwd()}/public/center.html`);
    await page.waitForTimeout(1000);

    // Header should be visible
    await expect(page.locator("header")).toBeVisible();

    // No console errors
    expect(errors).toHaveLength(0);
  });

  test("sidebar navigation renders", async ({ page }) => {
    await page.goto(`file://${process.cwd()}/public/center.html`);
    await page.waitForTimeout(500);

    // Check some nav items are present
    await expect(page.locator('[data-page="host-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-page="host-offerings"]')).toBeVisible();
  });
});
