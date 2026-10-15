import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug sheet continue", async ({ page }) => {
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

  // Check all Continue buttons
  const allContinue = page.locator("text=Continue");
  console.log("Total Continue buttons:", await allContinue.count());
  for (let i = 0; i < await allContinue.count(); i++) {
    const btn = allContinue.nth(i);
    const box = await btn.boundingBox();
    const disabled = await btn.getAttribute("disabled");
    const inDialog = await btn.locator("ancestor::div[@role='dialog']").count();
    console.log(`Continue[${i}] disabled=${disabled} inDialog=${inDialog} box=${JSON.stringify(box)}`);
  }

  // Try clicking the sheet's Continue (inside dialog)
  const sheetContinue = page.locator("[role='dialog'] text=Continue").first();
  if (await sheetContinue.count() > 0) {
    console.log("Sheet Continue disabled:", await sheetContinue.getAttribute("disabled"));
    console.log("Sheet Continue text:", await sheetContinue.textContent());
    await sheetContinue.click();
    await page.waitForTimeout(1000);
    const newLabel = await page.locator("p").filter({ hasText: /Step \d of 5/ }).first().textContent().catch(() => "NONE");
    console.log("Step label after click:", newLabel);
  }

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet-continue.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
