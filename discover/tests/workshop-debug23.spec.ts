import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug submit coords", async ({ page }) => {
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

  // Check terms checkbox and submit
  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  await termsCheckbox.check();
  console.log("Checkbox checked:", await termsCheckbox.isChecked());

  const submitBtn = page.locator("[role='dialog'] button", { hasText: "Send booking request" }).first();
  const box = await submitBtn.boundingBox();
  console.log("Submit box:", JSON.stringify(box));

  // Scroll into view first
  await submitBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box2 = await submitBtn.boundingBox();
  console.log("Submit box after scroll:", JSON.stringify(box2));

  // Click at center of button
  if (box2) {
    await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
  }
  await page.waitForTimeout(3000);

  const afterText = await page.locator("[role='dialog']").first().textContent().catch(() => "");
  console.log("AFTER MOUSE CLICK:", afterText.slice(0, 400));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug23-submit.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
