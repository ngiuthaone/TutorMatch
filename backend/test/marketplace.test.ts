import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";

const userId = "11111111-1111-4111-8111-111111111111", token = "secret-token";
const apps: any[] = [];

function fakeMarketplace() {
  const service: any = { calls: 0, list: async () => ({ status: "ok", data: [] }) };
  service.publish = async () => { service.calls++; return { status: "ok", data: { id: "listing-1" } }; };
  return service;
}
function setup(role: "student" | "tutor" = "tutor", service: any = fakeMarketplace(), logger: any = undefined) {
  const auth = new FakeAuthService();
  auth.authentication = { status: "authenticated", user: { id: userId, email: null } };
  auth.profile = { status: "found", profile: { id: userId, role, name: "Tutor", phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } };
  const app = createApp({ config: testConfig, authService: auth, marketplaceService: service, logger });
  apps.push(app);
  return { app, service, auth };
}
afterEach(async () => Promise.all(apps.splice(0).map((a) => a.close())));
const listing = { slug: "algebra-fundamentals", title: "Algebra fundamentals", payload: { curriculum: ["linear equations"], image: "https://example.com/course.png" } };
const publish = (app: any, body: unknown = listing) => app.inject({ method: "POST", url: "/api/v1/marketplace/course", headers: { authorization: `Bearer ${token}` }, payload: body });

describe("marketplace routes", () => {
  it("lists publicly without authentication", async () => {
    const { app, service } = setup();
    service.list = async () => ({ status: "ok" as const, data: [{ id: "1", kind: "course", slug: "x", title: "X", creatorId: userId, payload: {}, publishedAt: "2026-01-01T00:00:00Z" }] });
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course" });
    expect(r.statusCode).toBe(200);
    expect(r.json().items).toHaveLength(1);
  });
  it("marks public reads as no-store", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
  });
  it("rejects unknown kind", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/unknown" });
    expect(r.statusCode).toBe(404);
  });
  it("returns 503 when the listing service is unavailable", async () => {
    const { app, service } = setup();
    service.list = async () => ({ status: "unavailable" });
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course" });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });
  it("requires authentication to publish", async () => {
    const { app, service } = setup();
    const r = await app.inject({ method: "POST", url: "/api/v1/marketplace/course", payload: listing });
    expect(r.statusCode).toBe(401);
    expect(service.calls).toBe(0);
  });
  it("never echoes the bearer token in unauthenticated responses", async () => {
    const { app, auth } = setup();
    auth.authentication = { status: "invalid" };
    const r = await app.inject({ method: "POST", url: "/api/v1/marketplace/course", headers: { authorization: `Bearer ${token}` }, payload: listing });
    expect(r.statusCode).toBe(401);
    expect(JSON.stringify(r.json())).not.toContain(token);
  });
  it("rejects non-tutor creators", async () => {
    const { app, service } = setup("student");
    const r = await publish(app);
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("TUTOR_ROLE_REQUIRED");
    expect(service.calls).toBe(0);
  });
  it("allows tutors to publish", async () => {
    const { app, service } = setup();
    const original = service.publish;
    service.publish = async () => { await original(); return { status: "ok" as const, data: { id: "1", kind: "course" as const, slug: "algebra-fundamentals", title: "Algebra fundamentals", creatorId: userId, payload: {}, publishedAt: "2026-01-01T00:00:00Z" } }; };
    const r = await publish(app);
    expect(r.statusCode).toBe(200);
    expect(service.calls).toBe(1);
  });
  it("reports a 409 when the slug is already taken by another creator", async () => {
    const { app, service } = setup();
    service.publish = async () => { service.calls++; return { status: "conflict" }; };
    const r = await publish(app);
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe("LISTING_SLUG_CONFLICT");
    expect(service.calls).toBe(1);
  });
  it("returns 503 when publishing is unavailable", async () => {
    const { app, service } = setup();
    service.publish = async () => { service.calls++; return { status: "unavailable" }; };
    const r = await publish(app);
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });
  it("rejects invalid slugs", async () => {
    const { app, service } = setup();
    const r = await publish(app, { ...listing, slug: "Bad Slug!" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("MARKETPLACE_INVALID");
    expect(service.calls).toBe(0);
  });
  it("rejects payloads above the listing schema cap", async () => {
    const { app, service } = setup();
    const r = await publish(app, { ...listing, payload: { text: "a".repeat(510_000) } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("MARKETPLACE_INVALID");
    expect(service.calls).toBe(0);
  });
  it("rejects request bodies above the scoped marketplace limit", async () => {
    const { app, service } = setup();
    const r = await publish(app, { ...listing, payload: { text: "a".repeat(700_000) } });
    expect(r.statusCode).toBe(413);
    expect(r.json().error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(service.calls).toBe(0);
  });
  it("logs authentication rejections with a reason but never the token", async () => {
    const lines: string[] = [];
    const stream = new Writable({ write(chunk, _encoding, callback) { lines.push(String(chunk)); callback(); } });
    const auth = new FakeAuthService();
    auth.authentication = { status: "invalid" };
    const app = createApp({ config: testConfig, authService: auth, marketplaceService: fakeMarketplace(), logger: { level: "warn", stream } });
    apps.push(app);
    const r = await app.inject({ method: "POST", url: "/api/v1/marketplace/course", headers: { authorization: `Bearer ${token}` }, payload: listing });
    expect(r.statusCode).toBe(401);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const all = lines.join("");
    expect(all).toContain("Authentication rejected");
    expect(all).toContain('"reason":"invalid_access_token"');
    expect(all).not.toContain(token);
  });
});
