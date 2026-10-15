import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

type IntrospectableButton = HTMLButtonElement & Record<string, unknown>;

test("debug react props", async ({ page }) => {
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

  // Find all React fiber keys
  const fiberInfo = await page.evaluate(() => {
    const btns = document.querySelectorAll("[role='dialog'] button");
    for (const b of btns) {
      if (b.textContent?.includes("Send booking request")) {
        const keys = Object.keys(b).filter(k => k.startsWith("__react"));
        const fiber: Record<string, unknown> = {};
        for (const k of keys) {
          fiber[k] = typeof (b as IntrospectableButton)[k];
        }
        return { keys, fiber };
      }
    }
    return null;
  });
  console.log("FIBER KEYS:", JSON.stringify(fiberInfo));

  // Check if there's a form element wrapping
  const formInfo = await page.evaluate(() => {
    const btns = document.querySelectorAll("[role='dialog'] button");
    for (const b of btns) {
      if (b.textContent?.includes("Send booking request")) {
        let parent = b.parentElement;
        const chain: string[] = [];
        while (parent && chain.length < 10) {
          chain.push(`${parent.tagName}.${parent.className?.slice(0,40)}`);
          parent = parent.parentElement;
        }
        return chain;
      }
    }
    return null;
  });
  console.log("PARENT CHAIN:", JSON.stringify(formInfo));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug30-submit.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
