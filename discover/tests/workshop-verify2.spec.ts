import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const URL = "http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop";
const ART = "/Users/soshi/artifacts";

function snap(name: string) {
  return path.join(ART, name);
}

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("workshop page full verification v2", async ({ page }) => {
  test.setTimeout(90000);
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.addInitScript((cookieValue) => {
    document.cookie = "sb-127-auth-token=" + encodeURIComponent(cookieValue) + "; domain=localhost; path=/; max-age=3600; samesite=lax";
  }, COOKIE_VALUE);

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Page loads
  const h1Text = await page.locator("h1").first().textContent();
  console.log("H1:", h1Text);
  await page.screenshot({ path: snap("v2-01-load.png"), fullPage: true });
  expect(h1Text).toContain("Pizza");

  // 2. Workshop plan hover preview
  const planStep = page.locator("[data-plan-step]").first();
  const planVisible = await planStep.isVisible().catch(() => false);
  console.log("Plan step visible:", planVisible);
  await page.screenshot({ path: snap("v2-02-plan-before.png") });
  if (planVisible) {
    await planStep.hover();
    await page.waitForTimeout(500);
  }
  const activeAfterHover = await page.locator("[data-active='true']").count();
  await page.screenshot({ path: snap("v2-02-plan-after.png") });
  console.log("CHECK 2: active steps after hover =", activeAfterHover);

  // 3. Booking sheet opens
  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const opts = page.locator("[class*='sessionOption']");
  const nOpts = await opts.count();
  console.log("Session options:", nOpts);
  if (nOpts > 0) await opts.first().click();
  await page.waitForTimeout(300);

  const bookBtn = page.locator("text=Book this workshop").first();
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: snap("v2-03-sheet-open.png"), fullPage: true });

  const sheetOpen = await page.locator("[role='dialog']").first().isVisible().catch(() => false);
  console.log("CHECK 3: booking sheet open =", sheetOpen);

  // 4. Steps work
  const stepLabel = () => page.getByText(/Step \d of \d/).first();
  const steps: string[] = [];
  for (let i = 0; i < 5; i++) {
    const label = await stepLabel().textContent().catch(() => "");
    steps.push(label || `step-${i}`);
    console.log(`Step ${i + 1}: ${label}`);
    await page.screenshot({ path: snap(`v2-04-step-${i + 1}.png`) });
    if (i < 4) {
      // Fill contact fields on the Contact step so Continue enables
      if (label.includes("Contact")) {
        const nameInput = page.locator('input[placeholder="e.g. Linh Tran"]').first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill("Test User");
          await page.locator('input[placeholder="you@example.com"]').first().fill("test@example.com");
          await page.locator('input[placeholder="e.g. 0912345678"]').first().fill("0912345678");
          await page.waitForTimeout(300);
        }
      }
      const continueBtn = page.locator("[role='dialog'] button", { hasText: "Continue" }).first();
      const isEnabled = await continueBtn.isEnabled().catch(() => false);
      const isDisabled = await continueBtn.isDisabled().catch(() => false);
      console.log(`  continue enabled: ${isEnabled}, disabled: ${isDisabled}`);
      if (isEnabled && !isDisabled) {
        await continueBtn.click({ force: true });
        await page.waitForTimeout(600);
      } else {
        console.log("  Continue disabled — checking why");
        const cls = await continueBtn.getAttribute("class").catch(() => "");
        console.log("  button class:", cls);
        break;
      }
    }
  }
  console.log("CHECK 4: steps visited =", JSON.stringify(steps));
  await page.screenshot({ path: snap("v2-04-final.png"), fullPage: true });

  // 5. Free cancellation badge
  const freeBadge = page.locator("text=Free cancellation").first();
  const badgeVisible = await freeBadge.isVisible().catch(() => false);
  await page.screenshot({ path: snap("v2-05-badge.png") });
  console.log("CHECK 5: free cancellation badge visible =", badgeVisible);

  // 6. Success screen
  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  if (await termsCheckbox.isVisible().catch(() => false)) {
    await termsCheckbox.check();
  }
  const submitBtn = page.locator("[role='dialog'] button", { hasText: "Send booking request" }).first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: snap("v2-06-success.png"), fullPage: true });

  const receiptVisible = await page.locator("text=Request sent").first().isVisible().catch(() => false);
  const checkInCode = await page.locator("text=Show this code to the host").first().isVisible().catch(() => false);
  console.log("CHECK 6: receipt visible =", receiptVisible, "check-in code =", checkInCode);

  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
