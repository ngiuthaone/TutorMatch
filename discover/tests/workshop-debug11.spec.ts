import { test } from "@playwright/test";

test("debug sheet state", async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.goto("http://localhost:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill("student@example.com");
  await page.locator('input[type="password"]').first().fill("Local-test-only-Password1!");
  await page.locator("button[type='submit']").first().click();
  await page.waitForTimeout(2500);

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const opts = page.locator("[class*='sessionOption']");
  await opts.first().click();
  await page.waitForTimeout(300);

  const bookBtn = page.locator("text=Book this workshop").first();
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(800);

  const sheetText = await page.locator("[role='dialog']").first().textContent();
  console.log("SHEET_TEXT_START:", sheetText.slice(0, 800));
  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet-state.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
