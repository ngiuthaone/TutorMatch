import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js"; import { testConfig } from "./helpers/config.js"; import { FakeAuthService } from "./helpers/fake-auth-service.js";
const apps: ReturnType<typeof createApp>[] = []; afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
const make = () => { const app = createApp({ config: testConfig, authService: new FakeAuthService() }); apps.push(app); return app; };
describe("CORS", () => {
  it("allows only configured origin without credentials", async () => { const r = await make().inject({ method: "GET", url: "/api/v1/health", headers: { origin: "https://frontend.test" } }); expect(r.headers["access-control-allow-origin"]).toBe("https://frontend.test"); expect(r.headers["access-control-allow-credentials"]).toBeUndefined(); });
  it("does not echo a disallowed origin", async () => { const r = await make().inject({ method: "GET", url: "/api/v1/health", headers: { origin: "https://evil.test" } }); expect(r.headers["access-control-allow-origin"]).toBeUndefined(); });
  it("supports allowed preflight", async () => { const r = await make().inject({ method: "OPTIONS", url: "/api/v1/me", headers: { origin: "https://frontend.test", "access-control-request-method": "GET" } }); expect(r.statusCode).toBe(204); });
  it("does not let an absent origin bypass auth", async () => { expect((await make().inject({ method: "GET", url: "/api/v1/me" })).statusCode).toBe(401); });
});
