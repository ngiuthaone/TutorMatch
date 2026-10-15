import { test } from "@playwright/test";
import * as fs from "node:fs";

test("debug full cookie", async ({ page, context }) => {
  await page.goto("http://localhost:3000/auth/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill("student@example.com");
  await page.locator('input[type="password"]').first().fill("Local-test-only-Password1!");
  await page.locator("button[type='submit']").first().click();
  await page.waitForTimeout(2500);

  const cookies = await context.cookies();
  const sb = cookies.find(c => c.name === "sb-127-auth-token");
  console.log("FULL COOKIE VALUE:", sb ? sb.value : "NONE");
  if (sb) fs.writeFileSync("/tmp/cookie.txt", sb.value);

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("h1:", await page.locator("h1").first().textContent());
});
