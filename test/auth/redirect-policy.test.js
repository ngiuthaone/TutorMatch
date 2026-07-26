import { describe, expect, it } from "vitest"; import { callbackCode, routeForRole, sanitizeInternalRoute } from "../../src/auth/redirect-policy.js";
describe("redirect policy", () => {
  it.each(["#/", "#/student", "#/tutor/profile", "#/admin"])("allows internal %s", (route) => expect(sanitizeInternalRoute(route)).toBe(route));
  it.each(["https://evil.test", "//evil.test", "javascript:alert(1)", "%68%74%74%70%73%3A%2F%2Fevil.test", "/admin"])("rejects unsafe %s", (route) => expect(sanitizeInternalRoute(route)).toBe("#/"));
  it("maps only trusted roles", () => { expect(routeForRole("student")).toBe("#/student"); expect(routeForRole("unknown")).toBe("#/"); });
  it("accepts one callback code on the callback path", () => expect(callbackCode({ pathname: "/auth/callback", search: "?code=abcdefgh" })).toBe("abcdefgh"));
  it("rejects an unexpected callback origin", () => expect(() => callbackCode({ origin: "https://evil.test", pathname: "/auth/callback", search: "?code=abcdefgh" }, "https://app.test/auth/callback")).toThrow("INVALID_CALLBACK"));
  it.each([{ pathname: "/", search: "?code=abcdefgh" }, { pathname: "/auth/callback", search: "?code=a&code=b" }, { pathname: "/auth/callback", search: "?code=x" }])("rejects malformed callbacks", (location) => expect(() => callbackCode(location)).toThrow("INVALID_CALLBACK"));
});
