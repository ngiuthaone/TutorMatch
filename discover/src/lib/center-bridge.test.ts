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

  it("retries the existing parent-ready handshake after the parent listener is installed", () => {
    expect(centerPage).toContain("const frameRef = useRef<HTMLIFrameElement>(null)");
    expect(centerPage).toContain("notifyFrameReady();");
    expect(centerPage).toContain("onLoad={notifyFrameReady}");
  });

  it("keeps non-Tutor fixtures while projecting confirmed live Tutor bookings as upcoming", () => {
    expect(centerHtml).toContain("initialFixtures.filter(x=>x.type!=='tutor')");
    expect(centerHtml).toContain("status==='confirmed'?'upcoming'");
    expect(centerHtml).toContain("tutoria-center-tutor-bookings");
  });

  it("projects the authenticated Tutor identity and persisted learner identity into live bookings", () => {
    expect(centerPage).toContain("getSessionSnapshot");
    expect(centerPage).toContain("tutor");
    expect(centerHtml).toContain("data-center-account-name");
    expect(centerHtml).toContain("raw?.learner?.displayName");
    expect(centerHtml).not.toContain("learner:`Learner · ${String(raw.id).slice(0,8)}`");
  });
});
