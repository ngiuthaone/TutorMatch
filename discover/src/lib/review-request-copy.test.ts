import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("review request payment copy", () => {
  it("communicates request-first and payment-later without a payment action", () => {
    const html = readFileSync(new URL("../../public/tutor-profile-exact.html", import.meta.url), "utf8");

    expect(html).toContain("You won't be charged yet. Payment becomes available after the tutor accepts your request.");
    expect(html).toContain("You won't be charged yet. Payment becomes available after ${tutorName} accepts your request.");
    expect(html).not.toContain("You’ll pay after the tutor accepts your request.");
    expect(html).toContain('id="bookingNext"');
    expect(html).toContain("Send booking request");
    expect(html).not.toContain("Confirm and pay");
    expect(html).not.toContain("Payment method");
  });
});
