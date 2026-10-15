import { test } from "@playwright/test";

type TutoriaConfigWindow = Window & {
  TUTORIA_CONFIG?: { supabaseUrl: string; supabasePublishableKey: string; useBffAuth?: boolean; environment?: string };
};

test("debug booking flow v3", async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Sign in via Supabase client in-page (useBffAuth is false)
  const si = await page.evaluate(async () => {
    const cfg = (window as TutoriaConfigWindow).TUTORIA_CONFIG;
    return { supabaseUrl: cfg?.supabaseUrl, useBff: cfg?.useBffAuth, env: cfg?.environment };
  });
  console.log("CONFIG:", JSON.stringify(si));

  const signInResult = await page.evaluate(async () => {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    const cfg = (window as TutoriaConfigWindow).TUTORIA_CONFIG;
    const client = createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: "student@example.com", password: "Local-test-only-Password1!" });
    return { ok: !!data.session, error: error?.message, email: data.session?.user?.email };
  });
  console.log("IN_PAGE_SIGN_IN:", JSON.stringify(signInResult));

  await page.waitForTimeout(1000);
  const localStorage = await page.evaluate(() => {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.includes("supabase")) out.push(k);
    }
    return out;
  });
  console.log("SUPA LOCALSTORAGE:", JSON.stringify(localStorage));

  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const opts = page.locator("[class*='sessionOption']");
  await opts.first().click();
  await page.waitForTimeout(500);

  const bookBtn = page.locator("text=Book this workshop").first();
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(1000);

  const dialog = page.locator("[role='dialog']");
  console.log("dialog count:", await dialog.count());
  await page.screenshot({ path: "/Users/soshi/artifacts/debug-sheet-v3.png", fullPage: true });
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
