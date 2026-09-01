import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { mapRow } from "../src/services/marketplace-service.js";
import { testConfig } from "./helpers/config.js";
import { FakeAuthService } from "./helpers/fake-auth-service.js";

const userId = "11111111-1111-4111-8111-111111111111", token = "secret-token";
const apps: any[] = [];

function fakeMarketplace() {
  const service: any = { calls: 0, list: async () => ({ status: "ok", data: [] }) };
  service.publish = async () => { service.calls++; return { status: "ok", data: { id: "listing-1" } }; };
  service.getPublic = async () => ({ status: "not_found" });
  service.update = async () => ({ status: "not_found" });
  service.unpublish = async () => ({ status: "not_found" });
  service.listMine = async () => ({ status: "ok", data: [] });
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
    service.list = async () => ({ status: "ok" as const, data: [{ id: "1", kind: "course", slug: "x", title: "X", creatorId: userId, payload: {}, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: 1 }] });
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
  it("requires authentication to list my listings", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course/mine" });
    expect(r.statusCode).toBe(401);
  });
  it("rejects non-tutors from listing my listings", async () => {
    const { app, service } = setup("student");
    service.listMine = async () => { service.calls++; return { status: "ok", data: [] }; };
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course/mine", headers: { authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("TUTOR_ROLE_REQUIRED");
    expect(service.calls).toBe(0);
  });
  it("allows tutors to list only their own listings", async () => {
    const { app, service } = setup();
    const mine = [{ id: "draft-1", kind: "course", slug: "a", title: "A", creatorId: userId, payload: {}, publishedAt: "2026-01-01T00:00:00Z", status: "draft", version: 1 }];
    service.listMine = async (_token: unknown, _kind: unknown, ownerId: unknown) => {
      expect(ownerId).toBe(userId);
      service.calls++;
      return { status: "ok", data: mine };
    };
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course/mine", headers: { authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(200);
    expect(service.calls).toBe(1);
    expect(r.json().items).toHaveLength(1);
  });
  it("allows tutors to publish", async () => {
    const { app, service } = setup();
    const original = service.publish;
    service.publish = async () => { await original(); return { status: "ok" as const, data: { id: "1", kind: "course" as const, slug: "algebra-fundamentals", title: "Algebra fundamentals", creatorId: userId, payload: {}, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: 1 } }; };
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
  it("rejects a course body whose serialized config exceeds the 3MB cap", async () => {
    const { app, service } = setup();
    const r = await publish(app, { slug: "algebra-fundamentals", title: "Algebra fundamentals", description: "a".repeat(3_500_000) });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("MARKETPLACE_INVALID");
    expect(service.calls).toBe(0);
  });
  it("rejects request bodies above the scoped marketplace limit", async () => {
    const { app, service } = setup();
    const r = await publish(app, { slug: "algebra-fundamentals", title: "Algebra fundamentals", description: "a".repeat(4_500_000) });
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

const publishedListing = { id: "listing-1", kind: "course" as const, slug: "algebra-fundamentals", title: "Algebra fundamentals", creatorId: userId, payload: { curriculum: ["linear equations"] }, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: 1 };

describe("GET /api/v1/marketplace/:kind/:slug (single read)", () => {
  it("returns a published listing by slug", async () => {
    const { app, service } = setup();
    service.getPublic = async () => ({ status: "ok" as const, data: publishedListing });
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course/algebra-fundamentals" });
    expect(r.statusCode).toBe(200);
    expect(r.json().item.slug).toBe("algebra-fundamentals");
  });
  it("returns 404 when the listing does not exist", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course/nonexistent" });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe("NOT_FOUND");
  });
  it("returns 503 when the service is unavailable", async () => {
    const { app, service } = setup();
    service.getPublic = async () => ({ status: "unavailable" });
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course/algebra-fundamentals" });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });
  it("marks the response as no-store", async () => {
    const { app, service } = setup();
    service.getPublic = async () => ({ status: "ok" as const, data: publishedListing });
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course/algebra-fundamentals" });
    expect(r.headers["cache-control"]).toBe("no-store");
  });
  it("does not require authentication", async () => {
    const { app, service } = setup();
    service.getPublic = async () => ({ status: "ok" as const, data: publishedListing });
    const r = await app.inject({ method: "GET", url: "/api/v1/marketplace/course/algebra-fundamentals" });
    expect(r.statusCode).toBe(200);
  });
});

describe("PATCH /api/v1/marketplace/:kind/:slug (CAS update)", () => {
  const patchBody = { title: "Updated title", version: 1 };
  it("updates a listing with valid CAS version", async () => {
    const { app, service } = setup();
    service.update = async () => ({ status: "ok" as const, data: { ...publishedListing, title: "Updated title", version: 2 } });
    const r = await app.inject({ method: "PATCH", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` }, payload: patchBody });
    expect(r.statusCode).toBe(200);
    expect(r.json().item.version).toBe(2);
  });
  it("returns 409 on version mismatch (stale CAS)", async () => {
    const { app, service } = setup();
    service.update = async () => ({ status: "conflict" as const });
    const r = await app.inject({ method: "PATCH", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` }, payload: patchBody });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe("VERSION_CONFLICT");
  });
  it("returns 404 when the listing is not found", async () => {
    const { app, service } = setup();
    service.update = async () => ({ status: "not_found" as const });
    const r = await app.inject({ method: "PATCH", url: "/api/v1/marketplace/course/nonexistent", headers: { authorization: `Bearer ${token}` }, payload: patchBody });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe("NOT_FOUND");
  });
  it("returns 403 when the user does not own the listing", async () => {
    const { app, service } = setup();
    service.update = async () => ({ status: "forbidden" as const });
    const r = await app.inject({ method: "PATCH", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` }, payload: patchBody });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("FORBIDDEN");
  });
  it("returns 401 without authentication", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "PATCH", url: "/api/v1/marketplace/course/algebra-fundamentals", payload: patchBody });
    expect(r.statusCode).toBe(401);
  });
  it("returns 403 for non-tutor users", async () => {
    const { app } = setup("student");
    const r = await app.inject({ method: "PATCH", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` }, payload: patchBody });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("TUTOR_ROLE_REQUIRED");
  });
  it("rejects patch without version", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "PATCH", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` }, payload: { title: "Updated" } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("MARKETPLACE_INVALID");
  });
  it("returns 503 when the service is unavailable", async () => {
    const { app, service } = setup();
    service.update = async () => ({ status: "unavailable" as const });
    const r = await app.inject({ method: "PATCH", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` }, payload: patchBody });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("DELETE /api/v1/marketplace/:kind/:slug (unpublish)", () => {
  it("unpublishes a listing", async () => {
    const { app, service } = setup();
    service.unpublish = async () => ({ status: "ok" as const, data: { ...publishedListing, status: "unpublished", version: 2 } });
    const r = await app.inject({ method: "DELETE", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(200);
    expect(r.json().item.status).toBe("unpublished");
  });
  it("returns 404 when the listing is not found", async () => {
    const { app, service } = setup();
    service.unpublish = async () => ({ status: "not_found" as const });
    const r = await app.inject({ method: "DELETE", url: "/api/v1/marketplace/course/nonexistent", headers: { authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe("NOT_FOUND");
  });
  it("returns 401 without authentication", async () => {
    const { app } = setup();
    const r = await app.inject({ method: "DELETE", url: "/api/v1/marketplace/course/algebra-fundamentals" });
    expect(r.statusCode).toBe(401);
  });
  it("returns 403 for non-tutor users", async () => {
    const { app } = setup("student");
    const r = await app.inject({ method: "DELETE", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("TUTOR_ROLE_REQUIRED");
  });
  it("returns 503 when the service is unavailable", async () => {
    const { app, service } = setup();
    service.unpublish = async () => ({ status: "unavailable" as const });
    const r = await app.inject({ method: "DELETE", url: "/api/v1/marketplace/course/algebra-fundamentals", headers: { authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("marketplace write-side payload scrub (R5/L3)", () => {
  function recordingService() {
    const calls: { publish: any[]; update: any[] } = { publish: [], update: [] };
    const service: any = {
      list: async () => ({ status: "ok" as const, data: [] }),
      getPublic: async () => ({ status: "not_found" as const }),
      unpublish: async () => ({ status: "not_found" as const }),
    };
    service.publish = async (token: string, creatorId: string, input: any) => {
      calls.publish.push({ token, creatorId, input });
      return { status: "ok" as const, data: { id: "listing-1", kind: input.kind, slug: input.slug, title: input.title, creatorId, payload: input.payload, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: 1 } };
    };
    service.update = async (token: string, kind: string, slug: string, version: number, patch: any) => {
      calls.update.push({ token, kind, slug, version, patch });
      return { status: "ok" as const, data: { id: "listing-1", kind, slug, title: patch.title ?? "Algebra fundamentals", creatorId: userId, payload: patch.payload ?? {}, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: version + 1 } };
    };
    return { service, calls };
  }

  it("strips identity/contact keys from the published payload", async () => {
    const auth = new FakeAuthService();
    auth.authentication = { status: "authenticated", user: { id: userId, email: null } };
    auth.profile = { status: "found", profile: { id: userId, role: "tutor", name: "Tutor", phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } };
    const { service, calls } = recordingService();
    const app = createApp({ config: testConfig, authService: auth, marketplaceService: service });
    apps.push(app);

    const body = {
      slug: "algebra-fundamentals",
      title: "Algebra fundamentals",
      description: "<p>Learn algebra.</p>",
      curriculum: [{ title: "Linear equations" }],
      image: "https://example.com/course.png",
      creatorId: "attacker-victim",
      creatorEmail: "attacker@example.com",
      hostEmail: "host@example.com",
      hostId: "host-victim",
      authId: "auth-victim",
      creatorUserId: "creator-victim",
      phone: "+84-900-000-000",
      phoneNumber: "+84-900-000-001",
      contactPhone: "+84-900-000-002",
      hostPhone: "+84-900-000-003",
      hostName: "Mallory",
      hostNameOverride: "Not Mallory",
      creator_id: "snake-case-victim",
    };

    const r = await app.inject({ method: "POST", url: "/api/v1/marketplace/course", headers: { authorization: `Bearer ${token}` }, payload: body });
    expect(r.statusCode).toBe(200);

    expect(calls.publish).toHaveLength(1);
    const storedPayload = calls.publish[0].input.payload as Record<string, unknown>;
    expect(storedPayload.creatorId).toBeUndefined();
    expect(storedPayload.creatorEmail).toBeUndefined();
    expect(storedPayload.hostEmail).toBeUndefined();
    expect(storedPayload.hostId).toBeUndefined();
    expect(storedPayload.authId).toBeUndefined();
    expect(storedPayload.creatorUserId).toBeUndefined();
    expect(storedPayload.phone).toBeUndefined();
    expect(storedPayload.phoneNumber).toBeUndefined();
    expect(storedPayload.contactPhone).toBeUndefined();
    expect(storedPayload.hostPhone).toBeUndefined();
    expect(storedPayload.hostName).toBeUndefined();
    expect(storedPayload.hostNameOverride).toBeUndefined();
    expect(storedPayload.creator_id).toBeUndefined();
    // Non-identity fields survive the scrub.
    expect(storedPayload.description).toBe("<p>Learn algebra.</p>");
    expect(storedPayload.curriculum).toEqual([{ title: "Linear equations" }]);
    expect(storedPayload.image).toBe("https://example.com/course.png");
    // creatorId always comes from the JWT, never from the payload.
    expect(calls.publish[0].creatorId).toBe(userId);
  });

  it("strips identity/contact keys from a PATCH payload", async () => {
    const auth = new FakeAuthService();
    auth.authentication = { status: "authenticated", user: { id: userId, email: null } };
    auth.profile = { status: "found", profile: { id: userId, role: "tutor", name: "Tutor", phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } };
    const { service, calls } = recordingService();
    const app = createApp({ config: testConfig, authService: auth, marketplaceService: service });
    apps.push(app);

    const r = await app.inject({
      method: "PATCH",
      url: "/api/v1/marketplace/course/algebra-fundamentals",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        description: "Updated curriculum",
        creatorId: "attacker",
        phone: "+84-900-000-000",
        hostName: "Mallory",
        version: 1,
      },
    });
    expect(r.statusCode).toBe(200);
    expect(calls.update).toHaveLength(1);
    const storedPayload = calls.update[0].patch.payload as Record<string, unknown>;
    expect(storedPayload.creatorId).toBeUndefined();
    expect(storedPayload.phone).toBeUndefined();
    expect(storedPayload.hostName).toBeUndefined();
    expect(storedPayload.description).toBe("Updated curriculum");
  });

  it("strips identity keys that arrive nested inside a free-form payload key (coursePostSchema is closed)", async () => {
    const auth = new FakeAuthService();
    auth.authentication = { status: "authenticated", user: { id: userId, email: null } };
    auth.profile = { status: "found", profile: { id: userId, role: "tutor", name: "Tutor", phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } };
    const { service, calls } = recordingService();
    const app = createApp({ config: testConfig, authService: auth, marketplaceService: service });
    apps.push(app);

    const r = await app.inject({
      method: "POST",
      url: "/api/v1/marketplace/course",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        slug: "algebra-fundamentals",
        title: "Algebra fundamentals",
        description: "ok",
        instructor: { displayName: "Tutor A", headline: "PhD" },
        creatorId: "attacker",
      },
    });
    // creatorId is not part of the schema; the route should still succeed and the
    // service should receive a payload without creatorId.
    expect(r.statusCode).toBe(200);
    expect(calls.publish[0].input.payload.creatorId).toBeUndefined();
    expect(calls.publish[0].input.payload.instructor).toEqual({ displayName: "Tutor A", headline: "PhD" });
  });

  it("rejects a course payload whose serialized size exceeds 3MB", async () => {
    const { app, service } = setup();
    service.publish = async () => ({ status: "ok" as const, data: { id: "1", kind: "course" as const, slug: "x", title: "X", creatorId: userId, payload: {}, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: 1 } });
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/marketplace/course",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        slug: "algebra-fundamentals",
        title: "Algebra fundamentals",
        description: "a".repeat(3_500_000),
      },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("MARKETPLACE_INVALID");
  });

  it("rejects an oversized inline base64 cover image with 400 and never calls the service", async () => {
    const { app, service } = setup();
    service.publish = async () => { throw new Error("service should not be called"); };
    const oversize = `data:image/png;base64,${"A".repeat(700_000)}`;
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/marketplace/course",
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: "algebra-fundamentals", title: "Algebra fundamentals", image: oversize },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("MARKETPLACE_INVALID");
  });

  it("accepts a valid https:// cover image and passes it through to the service", async () => {
    const auth = new FakeAuthService();
    auth.authentication = { status: "authenticated", user: { id: userId, email: null } };
    auth.profile = { status: "found", profile: { id: userId, role: "tutor", name: "Tutor", phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } };
    const { service, calls } = recordingService();
    const app = createApp({ config: testConfig, authService: auth, marketplaceService: service });
    apps.push(app);
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/marketplace/course",
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: "algebra-fundamentals", title: "Algebra fundamentals", image: "https://cdn.example.com/course.png" },
    });
    expect(r.statusCode).toBe(200);
    expect(calls.publish[0].input.payload.image).toBe("https://cdn.example.com/course.png");
  });
});

describe("marketplace_service public-read creatorId omission (S-5)", () => {
  const row = {
    id: "listing-1", kind: "course", slug: "algebra-fundamentals", title: "Algebra",
    creator_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    payload: { curriculum: ["linear equations"] }, published_at: "2026-01-01T00:00:00Z",
    status: "published", version: 1,
  };

  it("omits creatorId for public reads (getPublic/list)", () => {
    const publicRow = mapRow(row, false);
    expect(publicRow.creatorId).toBe("");
  });

  it("keeps creatorId for authed write paths (publish/update/unpublish)", () => {
    const ownerRow = mapRow(row);
    expect(ownerRow.creatorId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("keeps all non-identity fields on public reads", () => {
    const publicRow = mapRow(row, false);
    expect(publicRow.slug).toBe("algebra-fundamentals");
    expect(publicRow.title).toBe("Algebra");
    expect(publicRow.payload).toEqual({ curriculum: ["linear equations"] });
    expect(publicRow.status).toBe("published");
  });
});
