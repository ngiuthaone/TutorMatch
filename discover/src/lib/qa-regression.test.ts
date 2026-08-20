import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const signInForm = readFileSync(resolve(process.cwd(), "src/components/auth/sign-in-form.tsx"), "utf8");
const signUpFlow = readFileSync(resolve(process.cwd(), "src/components/auth/sign-up-flow.tsx"), "utf8");
const globalNav = readFileSync(resolve(process.cwd(), "src/components/header/global-navigation.tsx"), "utf8");
const eventsPage = readFileSync(resolve(process.cwd(), "src/components/discover/events-page.tsx"), "utf8");
const eventDetail = readFileSync(resolve(process.cwd(), "src/components/events/event-detail-page.tsx"), "utf8");

describe("TUT-QA-001: sign-in form must not hardcode a redirect action", () => {
  it("does not have a form action attribute pointing to /discover", () => {
    expect(signInForm).not.toMatch(/<form[^>]*action="\/discover"/);
  });

  it("does not have a method=get on the form element", () => {
    expect(signInForm).not.toMatch(/<form[^>]*method="get"/);
  });
});

describe("TUT-QA-003: Home link must point to /discover, not /landing", () => {
  it("does not link to /landing in the global navigation", () => {
    expect(globalNav).not.toContain('href="/landing"');
  });

  it("links to /discover as the Home destination", () => {
    expect(globalNav).toContain('href="/discover"');
  });
});

describe("TUT-QA-004: capacity wording consistency", () => {
  it("events page uses 'X of Y seats' format instead of 'X/Y'", () => {
    expect(eventsPage).toContain("of {event.capacity} seats");
    expect(eventsPage).not.toMatch(/\{event\.attending\}\/\{event\.capacity\}/);
  });

  it("event detail page uses 'seats left' not 'spots'", () => {
    expect(eventDetail).toContain("seats left");
    expect(eventDetail).not.toMatch(/\{event\.spotsLeft\} spots/);
  });
});

describe("TUT-QA-005: auth pages must not expose Supabase internals", () => {
  it("sign-in form does not mention Supabase dashboard", () => {
    expect(signInForm).not.toMatch(/supabase dashboard/i);
  });

  it("sign-up flow does not mention Supabase dashboard", () => {
    expect(signUpFlow).not.toMatch(/supabase dashboard/i);
  });
});
