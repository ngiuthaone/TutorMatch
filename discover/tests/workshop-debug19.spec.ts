import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug continue button", async ({ page }) => {
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

  // Dump all buttons in the sheet
  const buttons = await page.locator("[role='dialog'] button").all();
  console.log("BUTTON COUNT:", buttons.length);
  for (let i = 0; i < buttons.length; i++) {
    const txt = await buttons[i].textContent();
    const cls = await buttons[i].getAttribute("class");
    const disabled = await buttons[i].isDisabled();
    console.log(`  btn[${i}]: text="${txt?.trim()}" disabled=${disabled} class="${cls?.slice(0,80)}"`);
  }

  // Try clicking Continue by role
  const continueBtn = page.locator("[role='dialog'] button", { hasText: "Continue" }).first();
  const cntExists = await continueBtn.count();
  console.log("Continue button count:", cntExists);
  if (cntExists > 0) {
    const before = await page.locator("[role='dialog']").first().textContent();
    await continueBtn.click({ force: true });
    await page.waitForTimeout(800);
    const after = await page.locator("[role='dialog']").first().textContent();
    console.log("BEFORE:", before?.slice(0,200));
    console.log("AFTER:", after?.slice(0,200));
  }

  await page.screenshot({ path: "/Users/soshi/artifacts/debug19-continue.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
