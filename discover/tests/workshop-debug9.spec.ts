import { test } from "@playwright/test";

test("debug SSR fetch", async ({ page, context }) => {
  await page.goto("http://localhost:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill("student@example.com");
  await page.locator('input[type="password"]').first().fill("Local-test-only-Password1!");
  await page.locator("button[type='submit']").first().click();
  await page.waitForTimeout(2500);

  // Listen to API requests from the browser
  page.on("response", async (r) => {
    if (r.url().includes("/api/")) {
      console.log("BROWSER API:", r.status(), r.url());
    }
  });

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log("h1:", await page.locator("h1").first().textContent());
  console.log("not found text present:", await page.locator("text=Workshop not found").count());
});
