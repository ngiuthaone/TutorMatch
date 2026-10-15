import { test } from "@playwright/test";

test("debug booking flow v6 - sign in via UI", async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  // Navigate to sign-in page first
  await page.goto("http://localhost:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"]').first();
  const pwdInput = page.locator('input[type="password"]').first();
  console.log("email input:", await emailInput.count(), "pwd input:", await pwdInput.count());

  await emailInput.fill("student@example.com");
  await pwdInput.fill("Local-test-only-Password1!");
  const submitBtn = page.locator("button[type='submit']").first();
  await submitBtn.click();
  await page.waitForTimeout(3000);

  console.log("URL after sign-in:", page.url());

  // Now go to workshop page
  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Check cookies
  const cookies = await context.cookies();
  console.log("COOKIES:", JSON.stringify(cookies.map(c => ({ name: c.name, domain: c.domain }))));

  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const opts = page.locator("[class*='sessionOption']");
  await opts.first().click();
  await page.waitForTimeout(500);

  const bookBtn = page.locator("text=Book this workshop").first();
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(1500);

  console.log("URL after book click:", page.url());
  const dialog = page.locator("[role='dialog']");
  console.log("dialog count:", await dialog.count());

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet-v6.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
