import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js"; import { testConfig } from "./helpers/config.js"; import { FakeAuthService } from "./helpers/fake-auth-service.js";
const apps: ReturnType<typeof createApp>[] = []; afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
describe("rate limiting", () => {
  it("enforces the global limit with the standard shape and ignores forwarded IP", async () => { const app = createApp({ config: { ...testConfig, RATE_LIMIT_MAX: 1 }, authService: new FakeAuthService() }); apps.push(app); expect((await app.inject({ method: "GET", url: "/api/v1/health", headers: { "x-forwarded-for": "1.1.1.1" } })).statusCode).toBe(200); const r = await app.inject({ method: "GET", url: "/api/v1/health", headers: { "x-forwarded-for": "2.2.2.2" } }); expect(r.statusCode).toBe(429); expect(r.json().error.code).toBe("RATE_LIMIT_EXCEEDED"); });
  it("uses the stricter me limit", async () => { const service = new FakeAuthService(); const app = createApp({ config: { ...testConfig, ME_RATE_LIMIT_MAX: 1 }, authService: service }); apps.push(app); await app.inject({ method: "GET", url: "/api/v1/me" }); const r = await app.inject({ method: "GET", url: "/api/v1/me", headers: { authorization: "Bearer secret" } }); expect(r.statusCode).toBe(429); expect(r.body).not.toContain("secret"); });
});
