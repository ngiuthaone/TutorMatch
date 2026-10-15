import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

type ReactFiberButton = HTMLButtonElement & { __reactProps$?: { onClick?: unknown } };

test("debug native click", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.addInitScript((cookieValue) => {
    document.cookie = "sb-127-auth-token=" + encodeURIComponent(cookieValue) + "; domain=localhost; path=/; max-age=3600; samesite=lax";
  }, COOKIE_VALUE);

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

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

  // Get the button and inspect it
  const btnInfo = await page.evaluate(() => {
    const btns = document.querySelectorAll("[role='dialog'] button");
    for (const b of btns) {
      if (b.textContent?.includes("Send booking request")) {
        return {
          text: b.textContent?.trim(),
          disabled: (b as HTMLButtonElement).disabled,
          type: (b as HTMLButtonElement).type,
          outerHTML: b.outerHTML.slice(0, 500),
          // Check React fiber
          hasReactProps: !!(b as ReactFiberButton).__reactProps$,
          reactOnClick: typeof (b as ReactFiberButton).__reactProps$?.onClick,
        };
      }
    }
    return null;
  });
  console.log("BTN INFO:", JSON.stringify(btnInfo, null, 2));

  // Try native click via dispatchEvent
  const nativeResult = await page.evaluate(() => {
    const btns = document.querySelectorAll("[role='dialog'] button");
    for (const b of btns) {
      if (b.textContent?.includes("Send booking request")) {
        const event = new MouseEvent("click", { bubbles: true, cancelable: true, view: window });
        return b.dispatchEvent(event);
      }
    }
    return null;
  });
  console.log("Native click result:", nativeResult);
  await page.waitForTimeout(3000);

  const afterText = await page.locator("[role='dialog']").first().textContent().catch(() => "");
  console.log("AFTER NATIVE CLICK:", afterText.slice(0, 400));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug29-submit.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
