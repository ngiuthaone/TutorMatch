import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const centerHtml = readFileSync(resolve(process.cwd(), "public/center.html"), "utf8");
const centerPage = readFileSync(resolve(process.cwd(), "src/app/center/page.tsx"), "utf8");

describe("Center tutor decision bridge contract", () => {
  it("uses the parent bridge action name for the visible Decline control", () => {
    expect(centerHtml).toContain('data-booking-decision="reject"');
    expect(centerHtml).not.toContain('data-booking-decision="decline"');
    expect(centerPage).toContain('message.action === "accept" || message.action === "reject"');
  });
});
