import { test } from "@playwright/test";

test("debug booking flow", async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE_ERR:", msg.text()); });

  // Sign in via BFF
  const si = await context.request.post("http://127.0.0.1:4000/api/v1/auth/sign-in", {
    data: { email: "student@example.com", password: "Local-test-only-Password1!" },
  });
  const siBody = await si.text();
  console.log("SIGN_IN status:", si.status());

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Check localStorage for supabase session
  const localStorage = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) out[k] = window.localStorage.getItem(k) || "";
    }
    return out;
  });
  console.log("LOCALSTORAGE KEYS:", Object.keys(localStorage));

  // Check session state
  const sessionState = await page.evaluate(() => {
    // Try to read the LiveIdentity
    return { href: window.location.href };
  });
  console.log("URL:", sessionState.href);

  const picker = page.locator("[class*='pickerButton']").first();
  console.log("picker count:", await picker.count());
  await picker.click();
  await page.waitForTimeout(500);
  const opts = page.locator("[class*='sessionOption']");
  console.log("session options:", await opts.count());
  await opts.first().click();
  await page.waitForTimeout(500);

  const bookBtn = page.locator("text=Book this workshop").first();
  console.log("book btn count:", await bookBtn.count());
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(1000);

  const dialog = page.locator("[role='dialog']");
  console.log("dialog count:", await dialog.count());
  const sheetText = await page.locator("[role='dialog']").first().textContent().catch(() => "NONE");
  console.log("SHEET_TEXT_START:", sheetText.slice(0, 400));

  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
