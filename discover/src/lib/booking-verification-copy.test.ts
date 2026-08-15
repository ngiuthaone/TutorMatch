import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bookingHtml = readFileSync(new URL("../../public/tutor-profile-exact.html", import.meta.url), "utf8");
const verifyPage = readFileSync(new URL("../app/auth/verify-email/page.tsx", import.meta.url), "utf8");
const verifyScreen = readFileSync(new URL("../components/auth/verify-email-screen.tsx", import.meta.url), "utf8");
const signInForm = readFileSync(new URL("../components/auth/sign-in-form.tsx", import.meta.url), "utf8");

describe("Booking email verification continuity", () => {
  it("exposes explicit verification copy and a safe verification route", () => {
    expect(bookingHtml).toContain("EMAIL_VERIFICATION_REQUIRED");
    expect(bookingHtml).toContain("RATE_LIMITED");
    expect(bookingHtml).toContain("Email verification is required");
    expect(verifyPage).toContain("safeRedirectPath");
    expect(verifyScreen).toContain("resendSignupConfirmation");
    expect(verifyScreen).toContain("We&apos;ll return you to your Tutor");
    expect(signInForm).toContain("EMAIL_NOT_CONFIRMED");
    expect(signInForm).toContain("/auth/verify-email?next=");
    expect(bookingHtml).toContain("data-auth-sign-out");
  });

  it("bridges live iframe sign-out through the parent auth store", () => {
    const frame = readFileSync(new URL("../components/discover/tutor-profile-frame.tsx", import.meta.url), "utf8");
    expect(bookingHtml).toContain("tutoria-auth-sign-out");
    expect(frame).toContain("signOutLive");
    expect(frame).toContain("tutoria-auth-sign-out");
  });
});
