import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionAccessTokenMock = vi.hoisted(() => vi.fn<() => string | null>(() => "access-token-1"));
const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => "http://api.example.com"));

vi.mock("@/lib/auth/session", () => ({
  getSessionAccessToken: getSessionAccessTokenMock,
}));

vi.mock("@/lib/auth/config", () => ({
  getApiBaseUrl: getApiBaseUrlMock,
}));

import { getMyTutorCv, getTutor, listTutors, publishMyTutorCv, saveMyTutorCv, type BackendTutorProfile } from "@/lib/tutor-cv-api";

const PROFILE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function profilePayload(): BackendTutorProfile {
  const record = flatOwnRecord();
  return {
    displayName: record.displayName,
    headline: record.headline,
    bio: record.bio,
    hourlyRateVnd: record.hourlyRateVnd,
    currency: "VND",
    teachingFormat: record.teachingFormat as BackendTutorProfile["teachingFormat"],
    subjects: record.subjects,
    levels: record.levels,
    regions: record.regions,
    languages: record.languages as BackendTutorProfile["languages"],
    availability: record.availability as BackendTutorProfile["availability"],
    education: [],
    experience: [],
  };
}

function flatOwnRecord() {
  return {
    id: PROFILE_ID,
    displayName: "Nguyen Van An",
    headline: "Patient math tutor",
    bio: "About text.",
    hourlyRateVnd: 300000,
    currency: "VND",
    teachingFormat: "both",
    subjects: ["mathematics"],
    levels: ["intermediate"],
    regions: ["Hoan Kiem, Ha Noi"],
    languages: [{ code: "vi", displayName: "Vietnamese", proficiency: "native" }],
    availability: [{ dayOfWeek: 3, startTime: "09:00", endTime: "10:00", timezone: "Asia/Bangkok" }],
    education: [],
    experience: [],
    publicationStatus: "published",
    publishedAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    version: 3,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("tutor-cv-api", () => {
  beforeEach(() => {
    getSessionAccessTokenMock.mockReturnValue("access-token-1");
    getApiBaseUrlMock.mockReturnValue("http://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses the flat own-CV record from /api/v1/me/tutor-cv", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, profile: flatOwnRecord() }));
    vi.stubGlobal("fetch", fetchMock);

    const record = await getMyTutorCv();
    expect(record).not.toBeNull();
    expect(record?.id).toBe(PROFILE_ID);
    expect(record?.version).toBe(3);
    expect(record?.publishedAt).toBe("2026-08-10T00:00:00.000Z");
    expect(record?.profile).toMatchObject({
      displayName: "Nguyen Van An",
      teachingFormat: "both",
      hourlyRateVnd: 300000,
      subjects: ["mathematics"],
    });
    expect(record?.profile.availability[0]).toMatchObject({ dayOfWeek: 3, timezone: "Asia/Bangkok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/v1/me/tutor-cv",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token-1" }),
        credentials: "omit",
      }),
    );
  });

  it("returns null when no CV exists (404 TUTOR_CV_NOT_FOUND)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ ok: false, error: { code: "TUTOR_CV_NOT_FOUND" } }, 404),
      ),
    );
    expect(await getMyTutorCv()).toBeNull();
  });

  it("maps backend errors to TutorCvApiError with code and status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: { code: "TUTOR_ROLE_REQUIRED" } }, 403)),
    );
    await expect(getMyTutorCv()).rejects.toMatchObject({ code: "TUTOR_ROLE_REQUIRED", status: 403 });
  });

  it("throws UNAUTHORIZED when no session token is available", async () => {
    getSessionAccessTokenMock.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getMyTutorCv()).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the profile and expected version on save", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, profile: { ...flatOwnRecord(), version: 4, publishedAt: null } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveMyTutorCv(profilePayload(), 3);
    expect(saved?.version).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/v1/me/tutor-cv",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ profile: profilePayload(), expectedVersion: 3 }),
      }),
    );
  });

  it("propagates version conflicts from publish", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: { code: "PROFILE_VERSION_CONFLICT" } }, 409)),
    );
    await expect(publishMyTutorCv(3)).rejects.toMatchObject({ code: "PROFILE_VERSION_CONFLICT", status: 409 });
  });

  it("rejects invalid own-CV payload shapes as INVALID_RESPONSE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: true, profile: { version: "nope" } })),
    );
    await expect(getMyTutorCv()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("fetches a public tutor detail by id with disclosure", async () => {
    const detail = {
      ...flatOwnRecord(),
      publicationStatus: undefined,
      updatedAt: undefined,
      version: undefined,
      disclosure: "Tutoria has not verified",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: true, profile: detail })),
    );
    const tutor = await getTutor(PROFILE_ID);
    expect(tutor.id).toBe(PROFILE_ID);
    expect(tutor.disclosure).toContain("has not verified");
    expect(tutor.displayName).toBe("Nguyen Van An");
  });

  it("lists published tutors with cursor", async () => {
    const items = [
      {
        id: PROFILE_ID,
        displayName: "Nguyen Van An",
        headline: "Patient math tutor",
        hourlyRateVnd: 300000,
        regions: ["Hoan Kiem, Ha Noi"],
        subjects: ["mathematics"],
        languages: [{ displayName: "Vietnamese", proficiency: "native" }],
        teachingFormat: "both",
        publishedAt: "2026-08-10T00:00:00.000Z",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: true, items, nextCursor: null })),
    );
    const result = await listTutors({ subject: "mathematics", limit: 24 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it("throws INVALID_RESPONSE when list items are malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: true, items: [{ id: "not-a-uuid", displayName: "X" }], nextCursor: null })),
    );
    await expect(listTutors()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
