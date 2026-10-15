import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug submit session", async ({ page }) => {
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

  for (let i = 0; i < 4; i++) {
    const label = await page.getByText(/Step \d of \d/).first().textContent().catch(() => "");
    if (label.includes("Contact")) {
      await page.locator('input[placeholder="e.g. Linh Tran"]').first().fill("Test User");
      await page.locator('input[placeholder="you@example.com"]').first().fill("test@example.com");
      await page.locator('input[placeholder="e.g. 0912345678"]').first().fill("0912345678");
      await page.waitForTimeout(300);
    }
    const continueBtn = page.locator("[role='dialog'] button", { hasText: "Continue" }).first();
    if (await continueBtn.isDisabled().catch(() => false)) break;
    await continueBtn.click({ force: true });
    await page.waitForTimeout(600);
  }

  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  await termsCheckbox.check();

  // Check session status via the page's React state (try reading __NEXT_DATA__ or window)
  // Check if there's an auth redirect happening
  const initialUrl = page.url();
  console.log("Initial URL:", initialUrl);

  // Listen for navigation
  let navigated = false;
  let navUrl = "";
  page.on("framenavigated", (frame) => {
    if (frame === page) { navigated = true; navUrl = frame.url(); }
  });

  const submitBtn = page.locator("[role='dialog'] button", { hasText: "Send booking request" }).first();
  await submitBtn.click({ force: true });
  await page.waitForTimeout(3000);

  console.log("Navigated:", navigated, "Nav URL:", navUrl);
  console.log("Current URL:", page.url());
  const afterText = await page.locator("[role='dialog']").first().textContent().catch(() => "");
  console.log("AFTER SUBMIT:", afterText.slice(0, 400));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug25-submit.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
