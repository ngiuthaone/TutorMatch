import { test } from "@playwright/test";

test("debug continue button", async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.goto("http://localhost:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill("student@example.com");
  await page.locator('input[type="password"]').first().fill("Local-test-only-Password1!");
  await page.locator("button[type='submit']").first().click();
  await page.waitForTimeout(2500);

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

  // Check the sheet state
  const continueBtn = page.locator("text=Continue").first();
  console.log("Continue disabled:", await continueBtn.getAttribute("disabled"));
  console.log("Continue text:", await continueBtn.textContent());

  // Check session label in sheet
  const sheetText = await page.locator("[role='dialog']").first().textContent();
  console.log("SHEET has 'Pick a date':", sheetText.includes("Pick a date and time"));
  console.log("SHEET has 'Choose a date':", sheetText.includes("Choose a date"));
  console.log("SHEET text start:", sheetText.slice(0, 600));

  // Fill contact
  const nameInput = page.locator('input[placeholder="e.g. Linh Tran"]').first();
  await nameInput.fill("Test User");
  await page.locator('input[placeholder="you@example.com"]').first().fill("test@example.com");
  await page.locator('input[placeholder="e.g. 0912345678"]').first().fill("0912345678");
  await page.waitForTimeout(300);
  console.log("After fill, Continue disabled:", await page.locator("text=Continue").first().getAttribute("disabled"));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-continue.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
