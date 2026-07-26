import { describe, expect, it } from "vitest"; import { validateEmail, validateSignup } from "../../src/auth/validation.js";
const valid = { name: "  Nguyen A  ", email: " user@example.com ", password: " long password ", confirmPassword: " long password ", role: "student", acceptedTerms: true };
describe("auth validation", () => {
  it("trims names and emails but preserves passwords", () => expect(validateSignup(valid)).toEqual({ name: "Nguyen A", email: "user@example.com", password: " long password ", role: "student" }));
  it.each(["admin", "owner", ""])("rejects role %s", (role) => expect(() => validateSignup({ ...valid, role })).toThrow("INVALID_ROLE"));
  it("accepts tutor", () => expect(validateSignup({ ...valid, role: "tutor" }).role).toBe("tutor"));
  it("requires matching passwords", () => expect(() => validateSignup({ ...valid, confirmPassword: "different password" })).toThrow("PASSWORD_MISMATCH"));
  it("requires terms", () => expect(() => validateSignup({ ...valid, acceptedTerms: false })).toThrow("TERMS_REQUIRED"));
  it("rejects whitespace name", () => expect(() => validateSignup({ ...valid, name: " " })).toThrow("INVALID_NAME"));
  it("validates email length and shape", () => expect(() => validateEmail("not-email")).toThrow("INVALID_EMAIL"));
});
