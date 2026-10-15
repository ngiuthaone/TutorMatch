import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug sheet continue v4", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.addInitScript((cookieValue) => {
    document.cookie = "sb-127-auth-token=" + encodeURIComponent(cookieValue) + "; domain=localhost; path=/; max-age=3600; samesite=lax";
  }, COOKIE_VALUE);

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

  // Select session inside the sheet - force click to bypass backdrop
  const sheetPicker = page.locator("[class*='pickerButton']").last();
  if (await sheetPicker.isVisible().catch(() => false)) {
    await sheetPicker.click({ force: true });
    const sheetOpts = page.locator("[class*='sessionOption']");
    const n = await sheetOpts.count();
    console.log("Sheet session options:", n);
    if (n > 0) await sheetOpts.first().click({ force: true });
    await page.waitForTimeout(300);
  }

  // Fill contact details
  const nameInput = page.locator('input[placeholder="e.g. Linh Tran"]').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill("Test User");
    await page.locator('input[placeholder="you@example.com"]').first().fill("test@example.com");
    await page.locator('input[placeholder="e.g. 0912345678"]').first().fill("0912345678");
  }

  // Get the sheet's Continue button (the one inside the dialog)
  const dialog = page.locator("[role='dialog']").first();
  const sheetContinue = dialog.locator("text=Continue").first();
  console.log("Sheet Continue count:", await dialog.locator("text=Continue").count());
  console.log("Sheet Continue disabled:", await sheetContinue.getAttribute("disabled"));
  if (!(await sheetContinue.getAttribute("disabled"))) {
    await sheetContinue.click({ force: true });
    await page.waitForTimeout(1000);
    const newLabel = await page.locator("p").filter({ hasText: /Step \d of 5/ }).first().textContent().catch(() => "NONE");
    console.log("Step label after click:", newLabel);
  }

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet-continue-v4.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
