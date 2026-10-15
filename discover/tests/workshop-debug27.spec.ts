import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug session state 2", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.addInitScript((cookieValue) => {
    document.cookie = "sb-127-auth-token=" + encodeURIComponent(cookieValue) + "; domain=localhost; path=/; max-age=3600; samesite=lax";
  }, COOKIE_VALUE);

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Check if the page shows "Sign in" link (not authenticated)
  const signInVisible = await page.locator("text=Sign in").first().isVisible().catch(() => false);
  console.log("Sign in visible:", signInVisible);

  // Check for auth redirect elements
  const authText = await page.evaluate(() => {
    return document.body.innerText.slice(0, 500);
  });
  console.log("BODY:", authText);

  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const opts = page.locator("[class*='sessionOption']");
  await opts.first().click();
  await page.waitForTimeout(300);

  const bookBtn = page.locator("text=Book this workshop").first();
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(1000);

  // Check session state inside the sheet via React dev
  const sheetText = await page.locator("[role='dialog']").first().textContent();
  console.log("SHEET TEXT:", sheetText?.slice(0, 300));

  // Check if there's a "Sign in" redirect happening inside sheet
  const sheetSignIn = await page.locator("[role='dialog']").first().locator("text=Sign in").first().isVisible().catch(() => false);
  console.log("Sheet Sign in visible:", sheetSignIn);

  await page.screenshot({ path: "/Users/soshi/artifacts/debug27-sheet.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
