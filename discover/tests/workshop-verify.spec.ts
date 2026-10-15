import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const URL = "http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop";
const ART = "/Users/soshi/artifacts";

function snap(name: string) {
  return path.join(ART, name);
}

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("workshop page full verification", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.addInitScript((cookieValue) => {
    document.cookie = "sb-127-auth-token=" + encodeURIComponent(cookieValue) + "; domain=localhost; path=/; max-age=3600; samesite=lax";
  }, COOKIE_VALUE);

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Page loads (not blank)
  await expect(page.locator("h1").first()).toContainText("Pizza 4P's Pizza-Making Workshop");
  await page.screenshot({ path: snap("v-01-load.png"), fullPage: true });
  console.log("CHECK 1 PASS: page loaded, h1 present");

  // 2. Workshop plan hover preview works
  const planStep = page.locator("[data-plan-step]").first();
  await expect(planStep).toBeVisible();
  await page.screenshot({ path: snap("v-02-plan-before.png") });
  await planStep.hover();
  await page.waitForTimeout(300);
  const activeAfterHover = await page.locator("[data-active='true']").count();
  await page.screenshot({ path: snap("v-02-plan-after.png") });
  console.log("CHECK 2: active steps after hover =", activeAfterHover);
  expect(activeAfterHover).toBeGreaterThan(0);

  // 3. Booking sheet opens (select session then click Continue)
  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const sessionOption = page.locator("[class*='sessionOption']").first();
  await sessionOption.click();
  await page.waitForTimeout(300);

  const bookBtn = page.locator("text=Book this workshop").first();
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: snap("v-03-sheet-open.png"), fullPage: true });

  const sheetOpen = await page.locator("[role='dialog']").first().isVisible();
  console.log("CHECK 3: booking sheet open =", sheetOpen);
  expect(sheetOpen).toBe(true);

  // 4. Booking sheet has 5 steps working
  // Step 1 "When" — select a session inside the sheet
  const sheetPicker = page.locator("[class*='pickerButton']").last();
  if (await sheetPicker.isVisible().catch(() => false)) {
    await sheetPicker.click({ force: true });
    const sheetOpts = page.locator("[class*='sessionOption']");
    const n = await sheetOpts.count();
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

  const stepLabel = () => page.getByText(/Step \d of 5/).first();

  const steps: string[] = [];
  for (let i = 0; i < 5; i++) {
    const label = await stepLabel().textContent().catch(() => "");
    steps.push(label || `step-${i}`);
    console.log(`Step ${i + 1}: ${label}`);
    await page.screenshot({ path: snap(`v-04-step-${i + 1}.png`) });
    if (i < 4) {
      const continueBtn = page.locator("text=Continue").first();
      const isEnabled = await continueBtn.isEnabled().catch(() => false);
      console.log(`  continue enabled: ${isEnabled}`);
      if (isEnabled) {
        await continueBtn.click({ force: true });
        await page.waitForTimeout(500);
      } else {
        console.log("  Continue disabled — stopping");
        break;
      }
    }
  }
  console.log("CHECK 4: steps visited =", JSON.stringify(steps));
  await page.screenshot({ path: snap("v-04-final.png"), fullPage: true });
  expect(steps.length).toBe(5);

  // 5. "Free cancellation" badge appears
  const freeBadge = page.locator("text=Free cancellation").first();
  const badgeVisible = await freeBadge.isVisible().catch(() => false);
  await page.screenshot({ path: snap("v-05-badge.png") });
  console.log("CHECK 5: free cancellation badge visible =", badgeVisible);
  expect(badgeVisible).toBe(true);

  // 6. Success screen after booking
  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  if (await termsCheckbox.isVisible().catch(() => false)) {
    await termsCheckbox.check();
  }
  const submitBtn = page.locator("text=Send booking request").first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: snap("v-06-success.png"), fullPage: true });

  const receiptVisible = await page.locator("text=Request sent").first().isVisible().catch(() => false);
  const checkInCode = await page.locator("text=Show this code to the host").first().isVisible().catch(() => false);
  console.log("CHECK 6: receipt visible =", receiptVisible, "check-in code =", checkInCode);
  expect(receiptVisible || checkInCode).toBe(true);

  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
