import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../src/config/env.js";
const valid = { NODE_ENV: "development", FRONTEND_ORIGINS: "http://localhost:4173", SUPABASE_URL: "https://p.supabase.co", SUPABASE_PUBLISHABLE_KEY: "unique-secret-value" };
describe("environment", () => {
  it("parses valid development defaults", () => { const result = parseEnvironment(valid); expect(result.PORT).toBe(4000); expect(result.TRUST_PROXY).toBe(false); });
  it.each([
    [{ ...valid, SUPABASE_URL: undefined }, "SUPABASE_URL"], [{ ...valid, SUPABASE_URL: "bad" }, "SUPABASE_URL"],
    [{ ...valid, PORT: "0" }, "PORT"], [{ ...valid, RATE_LIMIT_MAX: "0" }, "RATE_LIMIT_MAX"],
    [{ ...valid, NODE_ENV: "production", FRONTEND_ORIGINS: "*" }, "FRONTEND_ORIGINS"]
  ])("rejects invalid configuration", (input, field) => expect(() => parseEnvironment(input)).toThrow(field));
  it("does not reveal key values", () => expect(() => parseEnvironment({ ...valid, SUPABASE_PUBLISHABLE_KEY: "" })).not.toThrow("unique-secret-value"));
});
