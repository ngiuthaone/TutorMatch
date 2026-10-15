import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug canContinue bug", async ({ page }) => {
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

  // Check the Continue button state on "When" step
  const continueBtn = page.locator("text=Continue").first();
  const disabled = await continueBtn.getAttribute("disabled");
  console.log("When-step Continue disabled attr:", disabled);

  // Check if contact inputs exist on When step
  const nameInputCount = await page.locator('input[placeholder="e.g. Linh Tran"]').count();
  console.log("Name input count on When step:", nameInputCount);

  // Check the actual button classes
  const btnClass = await continueBtn.getAttribute("class");
  console.log("Continue button class:", btnClass);

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-when-step.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
