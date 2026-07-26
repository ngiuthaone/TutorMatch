import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";
const apps: ReturnType<typeof createApp>[] = []; afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
describe("health", () => {
  it("returns public liveness data without using Supabase", async () => {
    const service = new FakeAuthService(); const app = createApp({ config: testConfig, authService: service }); apps.push(app);
    const response = await app.inject({ method: "GET", url: "/api/v1/health" }); const body = response.json();
    expect(response.statusCode).toBe(200); expect(body).toMatchObject({ ok: true, service: "tutoria-api", version: "v1" });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false); expect(service.authCalls).toBe(0); expect(JSON.stringify(body)).not.toContain("SUPABASE");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
