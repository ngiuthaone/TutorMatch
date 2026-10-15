import { test } from "@playwright/test";
import * as fs from "node:fs";

const STORAGE = JSON.parse(fs.readFileSync("/tmp/storage.json", "utf8"));

test("debug booking flow v5", async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE_ERR:", msg.text()); });

  await page.addInitScript((storage) => {
    const key = "sb-127-0-0-1-auth-token";
    const payload = { storageKey: key, version: 2, ...storage };
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, STORAGE);

  await page.goto("http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  const opts = page.locator("[class*='sessionOption']");
  await opts.first().click();
  await page.waitForTimeout(500);

  const bookBtn = page.locator("text=Book this workshop").first();
  await bookBtn.scrollIntoViewIfNeeded();
  await bookBtn.click();
  await page.waitForTimeout(2000);

  console.log("URL after click:", page.url());
  const html = await page.content();
  fs.writeFileSync("/tmp/page-after-book.html", html);
  console.log("has sign-in link:", html.includes("/auth/sign-in"));
  console.log("has dialog:", html.includes('role="dialog"'));

  // Check session status via React
  const sessionCheck = await page.evaluate(() => {
    // Check if there's a redirect happening
    return { href: window.location.href, title: document.title };
  });
  console.log("SESSION CHECK:", JSON.stringify(sessionCheck));
  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
});
