import { test, expect } from "@playwright/test";
import * as fs from "node:fs";

const STORAGE = JSON.parse(fs.readFileSync("/tmp/storage.json", "utf8"));

test("debug booking flow v4 - inject session", async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.addInitScript((storage) => {
    const key = "sb-127-0-0-1-auth-token";
    const payload = {
      storageKey: key,
      version: 2,
      ...storage,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, STORAGE);

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const lsKeys = await page.evaluate(() => {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) out.push(k);
    }
    return out;
  });
  console.log("LS KEYS:", JSON.stringify(lsKeys));

  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const opts = page.locator("[class*='sessionOption']");
  console.log("session options:", await opts.count());
  await opts.first().click();
  await page.waitForTimeout(500);

  const bookBtn = page.locator("text=Book this workshop").first();
  console.log("book btn count:", await bookBtn.count());
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(1000);

  const dialog = page.locator("[role='dialog']");
  console.log("dialog count:", await dialog.count());
  const sheetText = await page.locator("[role='dialog']").first().textContent().catch(() => "NONE");
  console.log("SHEET_TEXT_START:", sheetText.slice(0, 500));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet-v4.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
