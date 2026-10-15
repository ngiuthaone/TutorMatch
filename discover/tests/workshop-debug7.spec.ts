import { test } from "@playwright/test";

test("debug cookie persistence", async ({ page, context }) => {
  await page.goto("http://localhost:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill("student@example.com");
  await page.locator('input[type="password"]').first().fill("Local-test-only-Password1!");
  await page.locator("button[type='submit']").first().click();
  await page.waitForTimeout(2500);

  const cookies = await context.cookies();
  console.log("COOKIES:", JSON.stringify(cookies.map(c => ({ name: c.name, value: c.value.slice(0,30), domain: c.domain, path: c.path }))));

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  console.log("URL:", page.url());
  console.log("h1:", await page.locator("h1").first().textContent());
  const lsKeys = await page.evaluate(() => {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) out.push(k);
    }
    return out;
  });
  console.log("LS:", JSON.stringify(lsKeys));
});
