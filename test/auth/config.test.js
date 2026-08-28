import { describe, expect, it } from "vitest";
import { validateAuthConfig } from "../../src/auth/config.js";
const development = { apiBaseUrl: "http://localhost:4000/", supabaseUrl: "http://127.0.0.1:54321", supabasePublishableKey: "test-key", authCallbackUrl: "http://localhost:4173/auth/callback", demoMode: false, environment: "development" };
describe("auth configuration", () => {
  it("accepts loopback development and normalizes URLs", () => expect(validateAuthConfig(development).apiBaseUrl).toBe("http://localhost:4000"));
  it("accepts valid production", () => expect(validateAuthConfig({ ...development, apiBaseUrl: "https://api.test", supabaseUrl: "https://project.supabase.co", authCallbackUrl: "https://app.test/auth/callback", environment: "production" }).demoMode).toBe(false));
  it.each([["apiBaseUrl", ""], ["supabaseUrl", ""], ["supabasePublishableKey", ""], ["demoMode", "false"], ["environment", "preview"]])("rejects invalid %s", (key, value) => expect(() => validateAuthConfig({ ...development, environment: "production", [key]: value })).toThrow());
  it("rejects production HTTP", () => expect(() => validateAuthConfig({ ...development, apiBaseUrl: "http://api.test", environment: "production" })).toThrow("HTTPS"));
  it("does not default missing config to demo", () => expect(() => validateAuthConfig()).toThrow());
  it("does not reveal a key in errors", () => { const secret = "value-that-must-not-appear"; expect(() => validateAuthConfig({ ...development, environment: "production", supabaseUrl: secret })).not.toThrow(secret); });
  it("allows explicit demo configuration without Supabase", () => expect(validateAuthConfig({ apiBaseUrl: "http://localhost:4173", demoMode: true, environment: "development" }).demoMode).toBe(true));
  it("refuses demo mode in production", () => expect(() => validateAuthConfig({ apiBaseUrl: "https://app.test", demoMode: true, environment: "production" })).toThrow("demoMode"));
});
