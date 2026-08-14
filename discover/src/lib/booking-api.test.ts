import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionAccessTokenMock = vi.hoisted(() => vi.fn<() => string | null>(() => "learner-token"));
const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => "http://api.example.com"));

vi.mock("@/lib/auth/session", () => ({ getSessionAccessToken: getSessionAccessTokenMock }));
vi.mock("@/lib/auth/config", () => ({ getApiBaseUrl: getApiBaseUrlMock }));

import { createBooking, listBookableSessions } from "@/lib/booking-api";

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TUTOR_PROFILE_ID = "11111111-2222-4333-8444-555555555555";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("booking-api", () => {
  beforeEach(() => {
    getSessionAccessTokenMock.mockReturnValue("learner-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads bookable Sessions scoped to the public tutor profile", async () => {
    const session = {
      id: SESSION_ID,
      tutorProfileId: TUTOR_PROFILE_ID,
      status: "scheduled",
      startsAt: "2026-08-20T02:00:00.000Z",
      endsAt: "2026-08-20T03:00:00.000Z",
      minParticipants: null,
      maxParticipants: 1,
      hardReservedCapacity: 0,
      spotsLeft: 1,
      version: 1,
      hourlyRateVnd: 300000,
      currency: "VND",
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, sessions: [session] }));

    const result = await listBookableSessions(TUTOR_PROFILE_ID);

    expect(result).toEqual([session]);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://api.example.com/api/v1/sessions?tutorProfileId=${TUTOR_PROFILE_ID}`,
      expect.objectContaining({ credentials: "omit", cache: "no-store" }),
    );
  });

  it("creates a Booking with only the selected Session and participant count", async () => {
    const booking = {
      id: "99999999-8888-4777-8666-555555555555",
      sessionId: SESSION_ID,
      status: "requested",
      participantCount: 1,
      version: 1,
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
      pricing: null,
      session: { id: SESSION_ID, startsAt: "2026-08-20T02:00:00.000Z", endsAt: "2026-08-20T03:00:00.000Z" },
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, booking }));

    const result = await createBooking(SESSION_ID);

    expect(result).toMatchObject({ id: booking.id, status: "requested" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.com/api/v1/bookings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer learner-token" }),
        body: JSON.stringify({ sessionId: SESSION_ID, participantCount: 1 }),
      }),
    );
  });

  it("fails closed without a learner session", async () => {
    getSessionAccessTokenMock.mockReturnValue(null);
    const fetchMock = vi.mocked(fetch);

    await expect(createBooking(SESSION_ID)).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves sanitized backend conflict codes", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, error: { code: "SESSION_CAPACITY_EXHAUSTED" } }, 409));

    await expect(createBooking(SESSION_ID)).rejects.toMatchObject({ code: "SESSION_CAPACITY_EXHAUSTED", status: 409 });
  });
});
