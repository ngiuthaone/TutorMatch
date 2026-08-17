import { describe, expect, it } from "vitest";
import { getBookingsPageState } from "./page-state";

describe("getBookingsPageState", () => {
  it("keeps the loading state while auth is initializing", () => {
    expect(getBookingsPageState(true, "initializing", "loading")).toBe("loading");
  });

  it("resolves a missing Supabase session to the sign-in state", () => {
    expect(getBookingsPageState(true, "anonymous", "loading")).toBe("sign-in");
  });

  it("loads bookings only for an authenticated session", () => {
    expect(getBookingsPageState(true, "authenticated", "loading")).toBe("loading");
    expect(getBookingsPageState(true, "authenticated", "ready")).toBe("ready");
  });

  it("returns to sign-in after sign-out even if the old booking status was loading", () => {
    expect(getBookingsPageState(true, "anonymous", "loading")).toBe("sign-in");
  });

  it("allows anonymous-to-authenticated rehydration to render bookings", () => {
    expect(getBookingsPageState(true, "authenticated", "ready")).toBe("ready");
  });

  it("never exposes the authenticated booking state to anonymous users", () => {
    expect(getBookingsPageState(true, "anonymous", "ready")).toBe("sign-in");
    expect(getBookingsPageState(true, "anonymous", "error")).toBe("sign-in");
  });
});
