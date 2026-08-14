import { describe, expect, it } from "vitest";

import { evaluateAuthGate } from "./gate";

describe("evaluateAuthGate", () => {
  it("waits while the session is still restoring so it never redirects prematurely", () => {
    expect(evaluateAuthGate("initializing", "/messages")).toEqual({ type: "wait" });
  });

  it("authorizes an authenticated session", () => {
    expect(evaluateAuthGate("authenticated", "/messages")).toEqual({ type: "authorize" });
  });

  it("redirects an anonymous session to sign-in with an encoded internal return path", () => {
    expect(evaluateAuthGate("anonymous", "/messages")).toEqual({
      type: "redirect",
      to: "/auth/sign-in?next=%2Fmessages",
    });
  });

  it("keeps the gate closed without redirecting when auth is unavailable", () => {
    expect(evaluateAuthGate("unavailable", "/messages")).toEqual({ type: "wait" });
  });
});
