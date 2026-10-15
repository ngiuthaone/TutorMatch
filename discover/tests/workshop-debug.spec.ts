import { test } from "@playwright/test";
import * as fs from "node:fs";

test("debug workshop page", async ({ page }) => {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${msg.location()?.url}:${msg.text()}`);
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/")) console.log("API:", r.status(), r.url());
  });

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const html = await page.content();
  fs.writeFileSync("/tmp/page-hydrated.html", html);
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  console.log("H1:", await page.locator("h1").first().textContent());
  console.log("has galleryPrimary:", await page.locator("[class*='galleryPrimary']").count());
  console.log("has planRow:", await page.locator("[class*='planRow']").count());
  console.log("has notFound:", (await page.locator("text=Workshop not found").count()) > 0);
});
