import { test } from "@playwright/test";
import * as fs from "node:fs";

const COOKIE_VALUE = fs.readFileSync("/tmp/cookie2.txt", "utf8").trim();

test("debug submit via js", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));
  const apiCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/workshops") || req.url().includes("workshop-booking")) {
      apiCalls.push(`${req.method()} ${req.url()}`);
    }
  });

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

  // Check the Pay step button
  const payBtns = await page.locator("[role='dialog'] button").all();
  console.log("PAY STEP BUTTONS:", payBtns.length);
  for (let i = 0; i < payBtns.length; i++) {
    const txt = await payBtns[i].textContent();
    const disabled = await payBtns[i].isDisabled();
    const onClick = await payBtns[i].getAttribute("onclick");
    console.log(`  btn[${i}]: "${txt?.trim()}" disabled=${disabled} onclick=${onClick}`);
  }

  // JS click the Send booking request button
  await page.evaluate(() => {
    const btns = document.querySelectorAll("[role='dialog'] button");
    for (const b of btns) {
      if (b.textContent?.includes("Send booking request")) (b as HTMLElement).click();
    }
  });
  await page.waitForTimeout(3000);

  const afterText = await page.locator("[role='dialog']").first().textContent().catch(() => "");
  console.log("AFTER JS CLICK:", afterText.slice(0, 400));
  console.log("API CALLS:", JSON.stringify(apiCalls));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug22-submit.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
