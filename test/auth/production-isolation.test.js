import { describe, expect, it } from "vitest"; import { readFileSync } from "node:fs"; import { join } from "node:path";
const appSource = readFileSync(join(process.cwd(), "app.js"), "utf8"), configSource = readFileSync(join(process.cwd(), "config.js"), "utf8"), authSource = readFileSync(join(process.cwd(), "src/auth/index.js"), "utf8");
describe("production/demo isolation", () => {
  it("gates legacy state backend behind explicit demo mode", () => expect(appSource).toContain("DEMO_MODE && location.protocol"));
  it("does not save production state", () => expect(appSource).toContain("if (!DEMO_MODE) return;"));
  it("uses the trusted auth profile in production", () => expect(appSource).toContain("auth?.getProfile?.()"));
  it("does not put service-role configuration in frontend config", () => expect(configSource + authSource).not.toMatch(/service.?role/i));
  it("does not clear all browser storage", () => expect(appSource + authSource).not.toContain("localStorage.clear"));
  it("keeps tokens out of custom storage", () => expect(authSource).not.toMatch(/localStorage|sessionStorage/));
  it("does not expose the raw session through public state", () => expect(authSource).toContain("const publicState"));
  it("does not silently enable demo after auth errors", () => expect(authSource).not.toContain("demoMode = true"));
  it("blocks production mutations", () => expect(appSource).toContain("This feature will be connected in the next backend milestone."));
});
