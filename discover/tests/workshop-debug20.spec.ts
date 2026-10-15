import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug continue click", async ({ page }) => {
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
  await page.waitForTimeout(1000);

  // Find the Continue button precisely
  const continueBtn = page.locator("[role='dialog'] button", { hasText: "Continue" }).first();
  const cnt = await continueBtn.count();
  console.log("Continue count:", cnt);
  const disabled = await continueBtn.isDisabled();
  console.log("Continue disabled:", disabled);
  const box = await continueBtn.boundingBox();
  console.log("Continue box:", JSON.stringify(box));

  // Try force click
  await continueBtn.click({ force: true });
  await page.waitForTimeout(1000);
  const after1 = await page.locator("[role='dialog']").first().textContent();
  console.log("AFTER CLICK1:", after1?.slice(0, 300));

  // Try JS click
  await page.evaluate(() => {
    const btns = document.querySelectorAll("[role='dialog'] button");
    for (const b of btns) {
      if (b.textContent?.includes("Continue")) (b as HTMLElement).click();
    }
  });
  await page.waitForTimeout(1000);
  const after2 = await page.locator("[role='dialog']").first().textContent();
  console.log("AFTER CLICK2:", after2?.slice(0, 300));

  // Check React state via window
  await page.screenshot({ path: "/Users/soshi/artifacts/debug20-continue.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
