import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug step label", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.addInitScript((cookieValue) => {
    document.cookie = "sb-127-auth-token=" + encodeURIComponent(cookieValue) + "; domain=localhost; path=/; max-age=3600; samesite=lax";
  }, COOKIE_VALUE);

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log("h1:", await page.locator("h1").first().textContent());

  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const opts = page.locator("[class*='sessionOption']");
  await opts.first().click();
  await page.waitForTimeout(300);

  const bookBtn = page.locator("text=Book this workshop").first();
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(800);

  const dialog = page.locator("[role='dialog']").first();
  const sheetText = await dialog.textContent();
  console.log("SHEET:", sheetText.slice(0, 600));

  // Check all p tags in dialog
  const pTexts = await dialog.locator("p").allTextContents();
  console.log("P TAGS:", JSON.stringify(pTexts));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet-text.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
