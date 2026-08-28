import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js"; import { testConfig } from "./helpers/config.js"; import { FakeAuthService } from "./helpers/fake-auth-service.js";
const userId = "11111111-1111-4111-8111-111111111111", token = "sensitive-access-token";
const apps: ReturnType<typeof createApp>[] = []; afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
function setup(service = new FakeAuthService()) { const app = createApp({ config: testConfig, authService: service }); apps.push(app); return { app, service }; }
describe("GET /api/v1/me", () => {
  it.each([undefined, "", "Bearer", "Bearer ", "Basic abc", "Bearer one two"])("rejects malformed authorization", async (authorization) => {
    const { app } = setup(); const headers = authorization === undefined ? {} : { authorization };
    const r = await app.inject({ method: "GET", url: "/api/v1/me", headers }); expect(r.statusCode).toBe(401); expect(r.headers["www-authenticate"]).toBe("Bearer"); expect(r.json().error.code).toBe("UNAUTHORIZED");
  });
  it("rejects oversized authorization before auth service", async () => { const { app, service } = setup(); const r = await app.inject({ method: "GET", url: "/api/v1/me", headers: { authorization: `Bearer ${"x".repeat(101)}` } }); expect(r.statusCode).toBe(401); expect(service.authCalls).toBe(0); });
  it("returns the same safe response for invalid tokens", async () => { const { app } = setup(); const r = await app.inject({ method: "GET", url: "/api/v1/me", headers: { authorization: `Bearer ${token}` } }); expect(r.statusCode).toBe(401); expect(r.body).not.toContain(token); });
  it("returns 503 for auth provider unavailability", async () => { const service = new FakeAuthService(); service.authentication = { status: "unavailable" }; const r = await setup(service).app.inject({ method: "GET", url: "/api/v1/me", headers: { authorization: "Bearer x" } }); expect(r.statusCode).toBe(503); expect(r.json().error.code).toBe("AUTH_PROVIDER_UNAVAILABLE"); });
  it("returns only the normalized authenticated profile", async () => {
    const service = new FakeAuthService(); service.authentication = { status: "authenticated", user: { id: userId, email: "student@example.com" } };
    service.profile = { status: "found", profile: { id: userId, role: "student", name: "Student", phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-02T00:00:00.000Z" } };
    const r = await setup(service).app.inject({ method: "GET", url: "/api/v1/me", headers: { authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(200); expect(r.json()).toEqual({ ok: true, user: { id: userId, email: "student@example.com", role: "student", name: "Student", phone: null, avatarUrl: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" } });
    expect(r.headers["cache-control"]).toBe("no-store"); expect(r.body).not.toContain(token);
  });
  it.each([[{ status: "not_found" }, 404, "PROFILE_NOT_FOUND"], [{ status: "unavailable" }, 503, "PROFILE_SERVICE_UNAVAILABLE"], [{ status: "invalid_data" }, 500, "INTERNAL_ERROR"]] as const)("handles profile results safely", async (profile, status, code) => {
    const service = new FakeAuthService(); service.authentication = { status: "authenticated", user: { id: userId, email: null } }; service.profile = profile;
    const r = await setup(service).app.inject({ method: "GET", url: "/api/v1/me", headers: { authorization: "Bearer x" } }); expect(r.statusCode).toBe(status); expect(r.json().error.code).toBe(code); expect(r.headers["cache-control"]).toBe("no-store");
  });
  it("rejects a mismatched profile ID", async () => { const service = new FakeAuthService(); service.authentication = { status: "authenticated", user: { id: userId, email: null } }; service.profile = { status: "found", profile: { id: "22222222-2222-4222-8222-222222222222", role: "student", name: "Wrong", phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" } }; const r = await setup(service).app.inject({ method: "GET", url: "/api/v1/me", headers: { authorization: "Bearer x" } }); expect(r.statusCode).toBe(500); expect(r.body).not.toContain("Wrong"); });
  it("returns safe JSON for unknown routes", async () => { const r = await setup().app.inject({ method: "GET", url: "/missing" }); expect(r.statusCode).toBe(404); expect(r.json()).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } }); expect(r.json().requestId).toBeTruthy(); });
});
