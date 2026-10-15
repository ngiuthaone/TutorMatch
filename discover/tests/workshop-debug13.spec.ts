import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug sheet continue v2", async ({ page }) => {
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

  // Select session inside the sheet
  const sheetPicker = page.locator("[role='dialog'] [class*='pickerButton']").first();
  if (await sheetPicker.isVisible().catch(() => false)) {
    await sheetPicker.click();
    const sheetOpts = page.locator("[role='dialog'] [class*='sessionOption']");
    const n = await sheetOpts.count();
    console.log("Sheet session options:", n);
    if (n > 0) await sheetOpts.first().click();
    await page.waitForTimeout(300);
  }

  // Check Continue buttons
  const allContinue = page.locator("text=Continue");
  console.log("Total Continue buttons:", await allContinue.count());
  for (let i = 0; i < await allContinue.count(); i++) {
    const btn = allContinue.nth(i);
    const disabled = await btn.getAttribute("disabled");
    const box = await btn.boundingBox();
    console.log(`Continue[${i}] disabled=${disabled} box=${JSON.stringify(box)}`);
  }

  // Click the sheet's Continue (last one, inside dialog)
  const sheetContinue = page.locator("[role='dialog'] text=Continue").first();
  if (await sheetContinue.count() > 0) {
    console.log("Sheet Continue disabled:", await sheetContinue.getAttribute("disabled"));
    if (!(await sheetContinue.getAttribute("disabled"))) {
      await sheetContinue.click();
      await page.waitForTimeout(1000);
      const newLabel = await page.locator("p").filter({ hasText: /Step \d of 5/ }).first().textContent().catch(() => "NONE");
      console.log("Step label after click:", newLabel);
    }
  }

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet-continue-v2.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
