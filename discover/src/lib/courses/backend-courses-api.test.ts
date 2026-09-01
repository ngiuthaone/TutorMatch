import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/config", () => ({ getApiBaseUrl: () => "http://api.example.test" }));

const accessTokenMock = vi.fn<() => string | null>();
vi.mock("@/lib/auth/session", () => ({ getSessionAccessToken: () => accessTokenMock() }));

import { BackendCourseApiError, publishBackendCourse } from "./backend-courses-api";

describe("publishBackendCourse", () => {
  beforeEach(() => {
    accessTokenMock.mockReset();
    accessTokenMock.mockReturnValue("access-token");
    vi.restoreAllMocks();
  });

  it("throws UNAUTHORIZED when no session token is available", async () => {
    accessTokenMock.mockReturnValue(null);
    await expect(publishBackendCourse({ slug: "s", title: "t", payload: {} })).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("POSTs to the marketplace course endpoint with the bearer token and dedupes slug/title from payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, item: { id: "i", kind: "course", slug: "s", title: "t", payload: {}, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: 1 } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(publishBackendCourse({
      slug: "s",
      title: "t",
      payload: { description: "ok", curriculum: [{ title: "l1" }], slug: "duplicate-should-be-stripped", title: "duplicate-should-be-stripped" },
    })).resolves.toMatchObject({ id: "i", slug: "s", title: "t" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/marketplace/course",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token", "Content-Type": "application/json" }),
        body: JSON.stringify({ slug: "s", title: "t", payload: { description: "ok", curriculum: [{ title: "l1" }] } }),
      }),
    );
  });

  it("strips identity/contact keys from the payload before sending (R5/L3 defense-in-depth)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, item: { id: "i", kind: "course", slug: "s", title: "t", payload: {}, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: 1 } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await publishBackendCourse({
      slug: "s",
      title: "t",
      payload: {
        description: "ok",
        creatorId: "attacker",
        creatorEmail: "a@b.c",
        hostEmail: "h@b.c",
        hostId: "h",
        authId: "a",
        creatorUserId: "cu",
        creator_id: "snake",
        creator_email: "snake@b.c",
        host_email: "hs@b.c",
        host_id: "hs",
        auth_id: "as",
        creator: "creator-display",
        phone: "+84-900-000-000",
        phoneNumber: "+84-900-000-001",
        contactPhone: "+84-900-000-002",
        hostPhone: "+84-900-000-003",
        hostName: "Mallory",
        hostNameOverride: "Not Mallory",
      },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.payload.creatorId).toBeUndefined();
    expect(body.payload.creatorEmail).toBeUndefined();
    expect(body.payload.hostEmail).toBeUndefined();
    expect(body.payload.hostId).toBeUndefined();
    expect(body.payload.authId).toBeUndefined();
    expect(body.payload.creatorUserId).toBeUndefined();
    expect(body.payload.creator_id).toBeUndefined();
    expect(body.payload.creator_email).toBeUndefined();
    expect(body.payload.host_email).toBeUndefined();
    expect(body.payload.host_id).toBeUndefined();
    expect(body.payload.auth_id).toBeUndefined();
    expect(body.payload.creator).toBeUndefined();
    expect(body.payload.phone).toBeUndefined();
    expect(body.payload.phoneNumber).toBeUndefined();
    expect(body.payload.contactPhone).toBeUndefined();
    expect(body.payload.hostPhone).toBeUndefined();
    expect(body.payload.hostName).toBeUndefined();
    expect(body.payload.hostNameOverride).toBeUndefined();
    expect(body.payload.description).toBe("ok");
  });

  it("maps 409 to SLUG_CONFLICT", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "LISTING_SLUG_CONFLICT", message: "That public URL belongs to another creator." } }), { status: 409 })));
    await expect(publishBackendCourse({ slug: "s", title: "t", payload: {} })).rejects.toMatchObject({ code: "LISTING_SLUG_CONFLICT", status: 409 });
  });

  it("maps a missing error.code to SLUG_CONFLICT on 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "taken" } }), { status: 409 })));
    await expect(publishBackendCourse({ slug: "s", title: "t", payload: {} })).rejects.toMatchObject({ code: "SLUG_CONFLICT", status: 409 });
  });

  it("throws INVALID_RESPONSE when the success body shape is wrong", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 200 })));
    await expect(publishBackendCourse({ slug: "s", title: "t", payload: {} })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("does NOT touch the parent side", async () => {
    // Sanity: publishing only depends on the session token; the iframe never
    // sends the token itself.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, item: { id: "i", kind: "course", slug: "s", title: "t", payload: {}, publishedAt: "2026-01-01T00:00:00Z", status: "published", version: 1 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await publishBackendCourse({ slug: "s", title: "t", payload: {} });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("creatorId");
    expect(body).not.toHaveProperty("payload.creatorId");
  });
});

describe("BackendCourseApiError", () => {
  it("carries the status code", () => {
    const err = new BackendCourseApiError("INVALID", 400, "bad");
    expect(err.code).toBe("INVALID");
    expect(err.status).toBe(400);
    expect(err.message).toBe("bad");
    expect(err.name).toBe("BackendCourseApiError");
  });
});