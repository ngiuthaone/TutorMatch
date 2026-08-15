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

  it("projects only persisted Tutor bookings in live mode", () => {
    expect(centerHtml).toContain("fixtures=(Array.isArray(rows)?rows:[]).map(mapLiveTutorBooking)");
    expect(centerHtml).not.toContain("initialFixtures.filter(x=>x.type!=='tutor')");
    expect(centerHtml).toContain("status==='confirmed'?'upcoming'");
    expect(centerHtml).toContain("tutoria-center-tutor-bookings");
  });

  it("escapes persisted learner identity before inserting Center HTML", () => {
    expect(centerHtml).toContain("function escapeHtml(value)");
    expect(centerHtml).toContain("${escapeHtml(b.learner)}");
  });

  it("projects the authenticated Tutor identity and persisted learner identity into live bookings", () => {
    expect(centerPage).toContain("getSessionSnapshot");
    expect(centerPage).toContain("tutor");
    expect(centerHtml).toContain("data-center-account-name");
    expect(centerHtml).toContain("raw?.learner?.displayName");
    expect(centerHtml).not.toContain("learner:`Learner · ${String(raw.id).slice(0,8)}`");
  });

  it("keeps Tutor cancellation in the authenticated parent bridge", () => {
    expect(centerPage).toContain("cancelTutorBooking");
    expect(centerPage).toContain("tutoria-center-cancel-tutor-booking");
    expect(centerHtml).toContain("tutoriaCenterRequestCancellation");
  });
});
