import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const URL = "http://localhost:3000/workshops/pizza-4ps-pizza-making-workshop";
const ART = "/Users/soshi/artifacts";

function snap(name: string) {
  return path.join(ART, name);
}

test("workshop detail page renders and interactions work", async ({ page, context }) => {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${msg.location()?.url}:${msg.text()}`);
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.screenshot({ path: snap("01-load.png"), fullPage: true });

  // 1. Page loaded (no blank screen)
  await expect(page.locator("h1").first()).toContainText("Pizza 4P's Pizza-Making Workshop");
  await page.screenshot({ path: snap("02-hero.png") });

  // 2. Media gallery
  await expect(page.locator("[class*='galleryPrimary']").first()).toBeVisible();
  await page.screenshot({ path: snap("03-gallery.png") });

  // 3. Overview/details
  await expect(page.locator("#overview")).toBeVisible();
  await expect(page.locator("#details")).toBeVisible();
  await page.screenshot({ path: snap("04-overview.png") });

  // 4. Highlights
  await expect(page.locator("[class*='highlightCard']").first()).toBeVisible();
  await page.screenshot({ path: snap("05-highlights.png") });

  // 5. Workshop plan
  await expect(page.locator("[class*='planRow']").first()).toBeVisible();
  await page.screenshot({ path: snap("06-plan.png") });

  // 6. Schedule/session picker
  const picker = page.locator("[class*='pickerButton']").first();
  await picker.click();
  await expect(page.locator("[class*='sessionOption']").first()).toBeVisible();
  await page.locator("[class*='sessionOption']").first().click();
  await page.screenshot({ path: snap("07-schedule.png") });

  // 7. Booking card / participant quantity
  await expect(page.locator("[class*='bookingCard']").first()).toBeVisible();
  const inc = page.locator("[class*='quantity']").first();
  if (await inc.count()) {
    await inc.first().click();
  }
  await page.screenshot({ path: snap("08-booking.png") });

  // 8. Branch selector
  const branchBtn = page.locator("[class*='branch']").first();
  if (await branchBtn.count()) {
    await branchBtn.click();
    await page.screenshot({ path: snap("09-branch.png") });
  }

  // 9. Map link HTTPS only
  const mapLink = page.locator("[class*='mapLink']").first();
  if (await mapLink.count()) {
    const href = await mapLink.getAttribute("href");
    console.log("MAP_LINK:", href);
    expect(href).toMatch(/^https:\/\//);
  }

  // 10. Host section
  await expect(page.locator("#host")).toBeVisible();
  await page.screenshot({ path: snap("10-host.png") });

  // 11. FAQ expand/collapse
  const faqBtn = page.locator("[class*='faqItem'] button").first();
  await expect(faqBtn).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[class*='faqItem']").first().locator("p").first()).toBeVisible();
  await faqBtn.click();
  await expect(faqBtn).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[class*='faqItem']").first().locator("p").first()).toBeHidden();
  await page.screenshot({ path: snap("11-faq.png") });

  // 12. Reviews
  await expect(page.locator("#reviews")).toBeVisible();
  await page.screenshot({ path: snap("12-reviews.png") });

  // 13. Recommendations
  await expect(page.locator("#recommendations")).toBeVisible();
  await page.screenshot({ path: snap("13-recommendations.png") });

  // 14. Mobile layout
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.screenshot({ path: snap("14-mobile.png"), fullPage: true });

  // 15. Booking interaction reaches booking sheet
  {
    const ctx = await context.newPage();
    const sheetErrors: string[] = [];
    ctx.on("pageerror", (e) => sheetErrors.push(String(e?.message ?? e)));
    await ctx.setViewportSize({ width: 1440, height: 900 });
    await ctx.goto(URL, { waitUntil: "networkidle" });
    await ctx.waitForTimeout(1500);
    const picker2 = ctx.locator("[class*='pickerButton']").first();
    await picker2.scrollIntoViewIfNeeded();
    await picker2.click();
    await ctx.locator("[class*='sessionOption']").first().click();
    const bookBtn = ctx.locator("text=Book this workshop").first();
    if (await bookBtn.count()) {
      await bookBtn.scrollIntoViewIfNeeded();
      await bookBtn.click();
    }
    await ctx.waitForTimeout(800);
    await ctx.screenshot({ path: snap("15-booking-sheet.png"), fullPage: true });
    console.log("SHEET_ERRORS:", JSON.stringify(sheetErrors));
    await ctx.close();
  }

  console.log("PAGE_ERRORS:", JSON.stringify(pageErrors));
  console.log("CONSOLE_ERRORS:", JSON.stringify(errors.slice(0, 20)));

  expect(pageErrors, "no runtime page errors").toEqual([]);
});
